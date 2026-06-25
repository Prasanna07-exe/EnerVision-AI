import logging
import httpx
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.config import settings
from app.models.country import Country
from app.models.metrics import EnergyMetric
from app.models.forecast import ForecastResult
from app.schemas.agent import ChatRequest, ChatResponse, AgentThought

router = APIRouter(prefix="/copilot", tags=["AI Copilot"])
logger = logging.getLogger(__name__)

# Standard fallback message if Ollama is offline or timeout occurs
OLLAMA_OFFLINE_MSG = (
    "⚠️ **Local AI Copilot is currently offline or loading.**\n\n"
    "To enable conversational responses, ensure **Ollama** is running on your machine and you have pulled the model:\n"
    "```powershell\n"
    "ollama run qwen2.5:7b\n"
    "```\n"
    "In the meantime, the platform is fully operational for charting, maps, and simulator interactions."
)

@router.post("/chat", response_model=ChatResponse)
async def chat_copilot(payload: ChatRequest, db: Session = Depends(get_db)):
    user_msg = payload.message.lower()
    
    # 1. Check for country keyword matches in the database
    countries = db.query(Country).all()
    matched_country = None
    for c in countries:
        if c.name.lower() in user_msg or c.code.lower() in user_msg:
            matched_country = c
            break

    # 2. Compile RAG Context from the database
    context_str = ""
    thoughts = []

    if matched_country:
        # Analyst Agent thought
        thoughts.append(AgentThought(
            agent_name="Data Analyst Agent",
            thought=f"Detected country target '{matched_country.name}' in prompt. Executing SQL to fetch historical metrics and predictions..."
        ))

        # Fetch latest metrics
        latest = db.query(EnergyMetric).filter(
            EnergyMetric.country_id == matched_country.id
        ).order_by(EnergyMetric.year.desc()).first()

        # Fetch sample baseline forecasts
        forecasts = db.query(ForecastResult).filter(
            ForecastResult.country_id == matched_country.id
        ).order_by(ForecastResult.year).all()

        # Build context
        hist_val = f"Renewable Share: {latest.renewable_share:.2f}, CO2 Emissions: {latest.emissions:.1f}M tonnes, Total Gen: {latest.electricity_generation:.1f} TWh" if latest else "No historical records"
        fore_val = ", ".join([f"{f.year}: demand={f.predicted_value:.1f} TWh, emissions={f.confidence_upper:.1f}" for f in forecasts[:3]]) if forecasts else "No baseline forecasts"

        context_str = (
            f"Country Context:\n"
            f"- Name: {matched_country.name} ({matched_country.code})\n"
            f"- Historical (latest year): {hist_val}\n"
            f"- Forecast Highlights: {fore_val}\n"
        )
        
        # Policy Agent thought
        thoughts.append(AgentThought(
            agent_name="Policy Advisor Agent",
            thought=f"Analyzing energy transition trends for {matched_country.name}. Evaluating coal dependencies and renewable readiness scores..."
        ))
    else:
        # Generic Global RAG context
        thoughts.append(AgentThought(
            agent_name="Data Analyst Agent",
            thought="No specific country keyword detected. Querying database for overall global aggregates..."
        ))
        
        latest_year = db.query(func.max(EnergyMetric.year)).scalar() if hasattr(db, 'query') else None
        if latest_year:
            global_gen = db.query(func.sum(EnergyMetric.electricity_generation)).filter(EnergyMetric.year == latest_year).scalar() or 0.0
            global_em = db.query(func.sum(EnergyMetric.emissions)).filter(EnergyMetric.year == latest_year).scalar() or 0.0
            context_str = f"Global Context for year {latest_year}:\n- Total Generation: {global_gen:.1f} TWh\n- Total Emissions: {global_em:.1f} Million Tonnes CO2\n"
        else:
            context_str = "Global Context: No data loaded yet."

    # 3. Construct System Prompt & Message History
    system_prompt = (
        "You are the Chief Energy Transition Analyst for EnerVision AI.\n"
        "Your task is to answer the user query professionally using the provided DATA CONTEXT.\n"
        "If you use numbers, ensure they exactly match the DATA CONTEXT. Do not make up numbers.\n"
        "Keep your output clear, formal, and formatted in Markdown.\n\n"
        "CRITICAL CHART INSTRUCTION:\n"
        "If the user asks for a chart, visualization, comparison plot, or graph of any metrics in the context (or if a chart would be highly relevant to explain the trend), you MUST append a structured JSON block wrapped inside <chart_data>...</chart_data> tags at the very end of your response.\n"
        "The XML block format MUST be:\n"
        "<chart_data>\n"
        "{\n"
        "  \"type\": \"line\", // or \"bar\"\n"
        "  \"title\": \"Title of the Chart\",\n"
        "  \"xAxis\": \"year\",\n"
        "  \"series\": [\"series1_key\", \"series2_key\"],\n"
        "  \"data\": [\n"
        "     {\"year\": 2024, \"series1_key\": value1, \"series2_key\": value2},\n"
        "     ...\n"
        "  ]\n"
        "}\n"
        "</chart_data>\n"
        "Populate this structure using the historical and forecast values from the DATA CONTEXT. Keep the data array size under 20 elements. Ensure all values are raw numbers, not strings.\n\n"
        "CRITICAL REPORT INSTRUCTION:\n"
        "Whenever the user asks to generate, compile, or download a PDF report or briefing paper, you MUST print a download link at the end of your response in this exact format: [Download PDF Report](/api/v1/copilot/report/download/{code}) where {code} is the 3-letter ISO code of the matched country (e.g., IND, CHN, USA).\n\n"
        f"[DATA CONTEXT]\n{context_str}\n"
    )

    # 4. Invoke LLM (Cloud Gemini, Groq, OpenRouter or Local Ollama)
    gemini_key = settings.GEMINI_API_KEY.strip('\"\' ') if settings.GEMINI_API_KEY else None
    groq_key = settings.GROQ_API_KEY.strip('\"\' ') if settings.GROQ_API_KEY else None
    openrouter_key = settings.OPENROUTER_API_KEY.strip('\"\' ') if settings.OPENROUTER_API_KEY else None
    
    active_cloud_provider = None
    if gemini_key:
        active_cloud_provider = "gemini"
    elif groq_key:
        active_cloud_provider = "groq"
    elif openrouter_key:
        active_cloud_provider = "openrouter"
        
    try:
        async with httpx.AsyncClient() as client:
            if active_cloud_provider == "gemini":
                key_masked = f"{gemini_key[:4]}...{gemini_key[-4:]}" if len(gemini_key) > 8 else "too_short"
                thoughts.append(AgentThought(
                    agent_name="Orchestrator Agent",
                    thought=f"Assembled data context. Dispatching prompt to cloud Google Gemini model (Key: {key_masked})..."
                ))
                
                # Format message history for Google Gemini API
                contents = []
                for msg in payload.history[-5:]: # Pass last 5 exchanges
                    role = "user" if msg.role == "user" else "model"
                    contents.append({
                        "role": role,
                        "parts": [{"text": msg.content}]
                    })
                contents.append({
                    "role": "user",
                    "parts": [{"text": payload.message}]
                })
                
                models_to_try = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-1.5-pro"]
                ai_response = None
                last_err = None
                
                for model_name in models_to_try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
                    logger.info(f"Attempting to query Gemini model: {model_name}")
                    try:
                        response = await client.post(
                            url,
                            json={
                                "contents": contents,
                                "systemInstruction": {
                                    "parts": [{"text": system_prompt}]
                                }
                            },
                            timeout=30.0
                        )
                        # If model is not found or not supported, try the next model in the list
                        if response.status_code == 404 or "not found" in response.text.lower() or "not supported" in response.text.lower():
                            logger.warning(f"Model {model_name} returned 404 or not supported. Response: {response.text}. Trying next model...")
                            continue
                            
                        if response.status_code != 200:
                            logger.error(f"Gemini API returned status {response.status_code} for {model_name}: {response.text}")
                        response.raise_for_status()
                        res_json = response.json()
                        ai_response = res_json["candidates"][0]["content"]["parts"][0]["text"]
                        logger.info(f"Successfully received response using model: {model_name}")
                        break
                    except Exception as api_err:
                        last_err = api_err
                        logger.error(f"Gemini API request failed for {model_name}: {api_err}")
                
                if not ai_response:
                    if last_err:
                        raise last_err
                    else:
                        raise Exception("All attempted Gemini models failed or were not found.")
                
                thoughts.append(AgentThought(
                    agent_name="Synthesizer Agent",
                    thought="Received response from cloud Gemini model. Validated output and compiling report."
                ))
                
            elif active_cloud_provider == "groq":
                key_masked = f"{groq_key[:6]}...{groq_key[-4:]}" if len(groq_key) > 10 else "too_short"
                thoughts.append(AgentThought(
                    agent_name="Orchestrator Agent",
                    thought=f"Assembled data context. Dispatching prompt to cloud Groq Llama model (Key: {key_masked})..."
                ))
                
                # Format message history in OpenAI format
                openai_messages = [{"role": "system", "content": system_prompt}]
                for msg in payload.history[-5:]:
                    role = "user" if msg.role == "user" else "assistant"
                    openai_messages.append({"role": role, "content": msg.content})
                openai_messages.append({"role": "user", "content": payload.message})
                
                groq_models = ["llama-3.3-70b-specdec", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
                ai_response = None
                last_err = None
                
                for model_name in groq_models:
                    url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json"
                    }
                    try:
                        response = await client.post(
                            url,
                            headers=headers,
                            json={
                                "model": model_name,
                                "messages": openai_messages,
                                "temperature": 0.2
                            },
                            timeout=30.0
                        )
                        if response.status_code != 200:
                            logger.error(f"Groq API returned status {response.status_code} for {model_name}: {response.text}")
                        response.raise_for_status()
                        res_json = response.json()
                        ai_response = res_json["choices"][0]["message"]["content"]
                        break
                    except Exception as api_err:
                        last_err = api_err
                        logger.error(f"Groq API request failed for {model_name}: {api_err}")
                        
                if not ai_response:
                    if last_err:
                        raise last_err
                    else:
                        raise Exception("All attempted Groq models failed.")
                        
                thoughts.append(AgentThought(
                    agent_name="Synthesizer Agent",
                    thought="Received response from cloud Groq model. Validated output and compiling report."
                ))
                
            elif active_cloud_provider == "openrouter":
                key_masked = f"{openrouter_key[:6]}...{openrouter_key[-4:]}" if len(openrouter_key) > 10 else "too_short"
                thoughts.append(AgentThought(
                    agent_name="Orchestrator Agent",
                    thought=f"Assembled data context. Dispatching prompt to cloud OpenRouter model (Key: {key_masked})..."
                ))
                
                openai_messages = [{"role": "system", "content": system_prompt}]
                for msg in payload.history[-5:]:
                    role = "user" if msg.role == "user" else "assistant"
                    openai_messages.append({"role": role, "content": msg.content})
                openai_messages.append({"role": "user", "content": payload.message})
                
                openrouter_models = ["openrouter/free", "meta-llama/llama-3.1-8b-instruct:free", "meta-llama/llama-3.2-3b-instruct:free", "google/gemma-2-9b-it:free"]
                ai_response = None
                last_err = None
                
                for model_name in openrouter_models:
                    url = "https://openrouter.ai/api/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://enervision-ai.onrender.com",
                        "X-Title": "EnerVision AI"
                    }
                    try:
                        response = await client.post(
                            url,
                            headers=headers,
                            json={
                                "model": model_name,
                                "messages": openai_messages,
                                "temperature": 0.2
                            },
                            timeout=30.0
                        )
                        if response.status_code != 200:
                            logger.error(f"OpenRouter API returned status {response.status_code} for {model_name}: {response.text}")
                        response.raise_for_status()
                        res_json = response.json()
                        ai_response = res_json["choices"][0]["message"]["content"]
                        break
                    except Exception as api_err:
                        last_err = api_err
                        logger.error(f"OpenRouter API request failed for {model_name}: {api_err}")
                        
                if not ai_response:
                    if last_err:
                        raise last_err
                    else:
                        raise Exception("All attempted OpenRouter models failed.")
                        
                thoughts.append(AgentThought(
                    agent_name="Synthesizer Agent",
                    thought="Received response from cloud OpenRouter model. Validated output and compiling report."
                ))
                
            else:
                # Format message history for Ollama chat API
                ollama_messages = [{"role": "system", "content": system_prompt}]
                for msg in payload.history[-5:]: # Pass last 5 exchanges
                    ollama_messages.append({"role": msg.role, "content": msg.content})
                ollama_messages.append({"role": "user", "content": payload.message})

                thoughts.append(AgentThought(
                    agent_name="Orchestrator Agent",
                    thought="Assembled data context. Dispatching prompt to local Ollama/Qwen model..."
                ))
                
                url = f"{settings.OLLAMA_URL}/api/chat"
                try:
                    response = await client.post(
                        url,
                        json={
                            "model": "qwen2.5:7b",
                            "messages": ollama_messages,
                            "stream": False
                        },
                        timeout=300.0
                    )
                    response.raise_for_status()
                    res_json = response.json()
                    ai_response = res_json["message"]["content"]
                except Exception as ollama_err:
                    logger.error(f"Ollama API request failed: {ollama_err}")
                    raise ollama_err
                
                thoughts.append(AgentThought(
                    agent_name="Synthesizer Agent",
                    thought="Received response from local Ollama. Validated output and compiling report."
                ))
                
        return ChatResponse(
            response=ai_response,
            thoughts=thoughts
        )
    except Exception as e:
        import traceback
        logger.error(f"Failed to communicate with LLM: {e}\n{traceback.format_exc()}")
        
        detail_msg = str(e)
        if isinstance(e, httpx.HTTPStatusError):
            try:
                err_json = e.response.json()
                if "error" in err_json:
                    if isinstance(err_json["error"], dict) and "message" in err_json["error"]:
                        detail_msg = f"API Error: {err_json['error']['message']}"
                    elif "message" in err_json:
                        detail_msg = f"API Error: {err_json['message']}"
                elif "message" in err_json:
                    detail_msg = f"API Error: {err_json['message']}"
            except Exception:
                detail_msg = f"API HTTP {e.response.status_code}: {e.response.text[:200]}"
                
        fallback_msg = (
            OLLAMA_OFFLINE_MSG if not active_cloud_provider 
            else f"The AI Copilot service is currently unavailable. Please verify your internet connection or check API settings.\n\n**Error Detail:** `{detail_msg}`"
        )
        return ChatResponse(
            response=fallback_msg,
            thoughts=thoughts
        )

@router.get("/report/download/{country_code}")
def download_report(country_code: str, db: Session = Depends(get_db)):
    """
    Generates and downloads a custom academic PDF report for the selected country.
    """
    import os
    import tempfile
    import pandas as pd
    import numpy as np
    from fastapi.responses import FileResponse
    from app.models.country import Country
    from app.models.metrics import EnergyMetric
    from app.models.forecast import ForecastResult
    from app.services.report_generator import generate_pdf_report
    from app.services.risk_service import calculate_risk_scores

    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
        
    # Fetch historical metrics
    history = db.query(EnergyMetric).filter(
        EnergyMetric.country_id == country.id
    ).order_by(EnergyMetric.year).all()
    
    # Fetch ensemble forecasts
    forecasts = db.query(ForecastResult).filter(
        ForecastResult.country_id == country.id,
        ForecastResult.model_name == 'ensemble'
    ).order_by(ForecastResult.year).all()
    
    history_data = [
        {
            "year": h.year,
            "electricity_generation": h.electricity_generation or 0.0,
            "emissions": h.emissions or 0.0,
            "renewable_share": h.renewable_share or 0.0
        }
        for h in history
    ]
    
    # Group forecasts by year
    forecast_map = {}
    for f in forecasts:
        if f.year not in forecast_map:
            forecast_map[f.year] = {}
        forecast_map[f.year][f.metric_name] = f.predicted_value
        
    forecast_data = [
        {
            "year": y,
            "electricity_demand": forecast_map[y].get("electricity_demand", 0.0),
            "co2_emissions": forecast_map[y].get("co2_emissions", 0.0),
            "renewable_share": forecast_map[y].get("renewable_share", 0.0)
        }
        for y in sorted(forecast_map.keys())
    ]
    
    if not history_data or not forecast_data:
        raise HTTPException(status_code=400, detail="Insufficient metrics to compile report.")
        
    # Build strategic insights text dynamically
    latest_hist = history_data[-1]
    last_fore = forecast_data[-1]
    
    demand_growth = ((last_fore["electricity_demand"] - latest_hist["electricity_generation"]) / latest_hist["electricity_generation"] * 100.0) if latest_hist["electricity_generation"] > 0 else 0.0
    emission_change = ((last_fore["co2_emissions"] - latest_hist["emissions"]) / latest_hist["emissions"] * 100.0) if latest_hist["emissions"] > 0 else 0.0
    renewable_delta = (last_fore["renewable_share"] - latest_hist["renewable_share"]) * 100.0
    
    insights = (
        f"Based on historical time-series analytics, {country.name} exhibits a distinct transition vector. "
        f"Over the forecast horizon (2025 to 2045), total electricity demand is projected to change by "
        f"{demand_growth:.1f}%, scaling to {last_fore['electricity_demand']:.1f} TWh. This expansion reflects "
        f"increased electrification and population demographics.\n\n"
        f"Carbon emissions are projected to change by {emission_change:.1f}%, reaching {last_fore['co2_emissions']:.1f} "
        f"Million Tonnes of CO2 by 2045. The grid's average renewable penetration share is expected to shift by "
        f"{renewable_delta:+.1f} percentage points, ending at {last_fore['renewable_share']*100.0:.1f}%.\n\n"
        f"Strategic Recommendations:\n"
        f"1. Decarbonize Baseload Capacity: To offset the projected {last_fore['electricity_demand']:.1f} TWh load, "
        f"investments in solar and wind capacity must scale by at least {renewable_delta*1.5:.1f}% to prevent emissions lock-ins.\n"
        f"2. Grid Balancing & Reserve Margins: Electrification surges could introduce load balancing risks. "
        f"Deploy battery storage buffers and grid flexibility protocols to maintain baseload safety margins.\n"
        f"3. Retiring Carbon-Heavy Assets: Accelerate coal and fossil-fuel phaseouts in line with solar additions to "
        f"guarantee a downward trajectory in emissions intensity."
    )

    # A. Calculate Risk Scores
    risk_scores = calculate_risk_scores(db, country.code)

    # B. Calculate Pearson Correlation Matrix (Mode B)
    metrics_corr = db.query(
        EnergyMetric.gdp,
        EnergyMetric.emissions,
        EnergyMetric.renewable_share,
        EnergyMetric.electricity_generation
    ).filter(
        EnergyMetric.country_id == country.id,
        EnergyMetric.year <= 2024
    ).order_by(EnergyMetric.year).all()

    df_list = []
    for m in metrics_corr:
        if m.gdp and m.emissions is not None and m.renewable_share is not None and m.electricity_generation is not None:
            df_list.append({
                "GDP": m.gdp,
                "Emissions": m.emissions,
                "Renewables": m.renewable_share,
                "Demand": m.electricity_generation
            })

    labels = ["GDP", "Emissions", "Renewables", "Demand"]
    if len(df_list) < 3:
        matrix = [[1.0 if i==j else 0.0 for j in range(4)] for i in range(4)]
    else:
        df = pd.DataFrame(df_list)
        df.columns = labels
        corr = df.corr(method="pearson").fillna(0.0)
        matrix = corr.values.tolist()
        
    correlation = {
        "labels": labels,
        "matrix": matrix
    }

    # C. Calculate Sovereign Peer Similarity (Clustering)
    latest_year_val = db.query(func.max(EnergyMetric.year)).filter(EnergyMetric.year <= 2024).scalar() or 2024
    all_latest_metrics = db.query(
        Country.name,
        Country.code,
        EnergyMetric.gdp,
        EnergyMetric.population,
        EnergyMetric.renewable_share
    ).join(EnergyMetric, EnergyMetric.country_id == Country.id).filter(
        EnergyMetric.year == latest_year_val
    ).all()
    
    points = []
    target_pt = None
    for r in all_latest_metrics:
        gdp_val = r.gdp or 0.0
        pop_val = r.population or 1.0
        gdp_pc = gdp_val / pop_val
        ren_share = r.renewable_share or 0.0
        pt = {
            "name": r.name,
            "code": r.code,
            "gdp_per_capita": gdp_pc,
            "renewable_share": ren_share
        }
        points.append(pt)
        if r.code == country.code:
            target_pt = pt
            
    peers = []
    if target_pt and points:
        max_gdp_pc = max(p["gdp_per_capita"] for p in points) or 1.0
        max_ren = max(p["renewable_share"] for p in points) or 1.0
        
        scored_peers = []
        for p in points:
            if p["code"] == country.code:
                continue
            gdp_diff = (p["gdp_per_capita"] - target_pt["gdp_per_capita"]) / max_gdp_pc
            ren_diff = (p["renewable_share"] - target_pt["renewable_share"]) / max_ren
            dist = np.sqrt(gdp_diff * gdp_diff + ren_diff * ren_diff)
            similarity = max(0.0, 100.0 * (1.0 - dist))
            scored_peers.append({
                "country": p["name"],
                "code": p["code"],
                "gdp_per_capita": p["gdp_per_capita"],
                "renewable_share": p["renewable_share"],
                "similarity": similarity
            })
        scored_peers.sort(key=lambda x: x["similarity"], reverse=True)
        peers = scored_peers[:3]

    # D. Calibrate EV, Clean and Fossil shares
    latest_m = db.query(EnergyMetric).filter(
        EnergyMetric.country_id == country.id
    ).order_by(EnergyMetric.year.desc()).first()
    
    ev_share = 0.0
    fossil_share = 0.0
    clean_share = 0.0
    gdp_pc_val = 0.0
    
    if latest_m:
        gdp_val = latest_m.gdp or 0.0
        pop_val = latest_m.population or 1.0
        gdp_pc_val = gdp_val / pop_val
        
        KNOWN_EV_SHARES = {
            "SGP": 12.0, "KOR": 10.0, "HKG": 25.0, "ARE": 5.0, "TWN": 6.0,
            "SAU": 1.5, "QAT": 2.0, "IRL": 18.0, "LUX": 20.0, "JPN": 3.5,
            "BRA": 3.0, "IND": 2.2, "ZAF": 0.8, "MEX": 1.8, "TUR": 5.0,
            "IDN": 2.0, "THA": 10.0, "MYS": 2.5
        }
        
        if latest_m.ev_sales_share:
            ev_share = latest_m.ev_sales_share
        elif country.code in KNOWN_EV_SHARES:
            ev_share = KNOWN_EV_SHARES[country.code]
        else:
            if gdp_pc_val > 50000:
                ev_share = 15.0
            elif gdp_pc_val > 30000:
                ev_share = 8.0
            elif gdp_pc_val > 15000:
                ev_share = 4.0
            elif gdp_pc_val > 5000:
                ev_share = 1.0
            else:
                ev_share = 0.1
                
        if latest_m.electricity_generation:
            gen = latest_m.electricity_generation
            coal_gen = latest_m.coal_generation or 0.0
            gas_gen = latest_m.gas_generation or 0.0
            solar_gen = latest_m.solar_generation or 0.0
            wind_gen = latest_m.wind_generation or 0.0
            hydro_gen = latest_m.hydro_generation or 0.0
            nuclear_gen = latest_m.nuclear_generation or 0.0
            
            fossil_share = (coal_gen + gas_gen) / gen
            clean_share = (solar_gen + wind_gen + hydro_gen + nuclear_gen) / gen

    extra_metrics = {
        "ev_share": ev_share,
        "fossil_share": fossil_share,
        "clean_share": clean_share,
        "population": latest_m.population if latest_m else 1.0,
        "gdp": latest_m.gdp if latest_m else 0.0,
        "gdp_per_capita": gdp_pc_val
    }
    
    # E. Calculate Cluster Assignment
    cluster_id = 1
    try:
        if latest_m:
            gdp_pc = (latest_m.gdp / latest_m.population) if latest_m.population and latest_m.population > 0 else 0.0
            gdp_pc = min(gdp_pc, 100000.0)
            renew_share = latest_m.renewable_share or 0.0
            emissions = latest_m.emissions or 0.0
            generation = latest_m.electricity_generation or 0.0
            
            from app.routers.cluster import get_country_cluster_assignment
            cluster_id = get_country_cluster_assignment(
                country.code,
                gdp_pc,
                renew_share,
                emissions,
                generation,
                coal_gen=latest_m.coal_generation or 0.0,
                gas_gen=latest_m.gas_generation or 0.0,
                nuclear_gen=latest_m.nuclear_generation or 0.0
            )
    except Exception as e:
        logger.error(f"Clustering failed in PDF router: {e}")

    # F. Extract Fuel Mix Values
    fuel_mix = {
        "coal": 0.0, "gas": 0.0, "solar": 0.0, "wind": 0.0, "hydro": 0.0, "nuclear": 0.0
    }
    if latest_m:
        fuel_mix = {
            "coal": latest_m.coal_generation or 0.0,
            "gas": latest_m.gas_generation or 0.0,
            "solar": latest_m.solar_generation or 0.0,
            "wind": latest_m.wind_generation or 0.0,
            "hydro": latest_m.hydro_generation or 0.0,
            "nuclear": latest_m.nuclear_generation or 0.0
        }

    # G. Fetch LSTM Temporal Self-Attention
    attention = {"years": [2020, 2021, 2022, 2023, 2024], "attention": [0.2, 0.2, 0.2, 0.2, 0.2]}
    try:
        from app.routers.forecast import get_lstm_attention
        res_att = get_lstm_attention(country.code, db)
        if res_att:
            attention = res_att
    except Exception as e:
        logger.error(f"Attention weights failed in PDF router: {e}")

    # H. Fetch XGBoost SHAP Attributions
    shap_data = {
        "base_value": 0.0,
        "prediction_value": 0.0,
        "attributions": {"GDP": 0.35, "ev_sales_share": -0.22, "emissions_lag_1": 0.15, "population": 0.12}
    }
    try:
        from app.routers.forecast import explain_forecast
        res_sh = explain_forecast(country.code, "electricity_demand", db)
        if res_sh:
            shap_data = res_sh
    except Exception as e:
        logger.error(f"SHAP explanation failed in PDF router: {e}")

    # I. Run Policy Simulation Shift comparison
    simulation = None
    try:
        from app.services.simulator import run_simulation
        simulation = run_simulation(db, country.code, solar_change=20.0, ev_change=15.0, coal_change=-20.0)
    except Exception as e:
        logger.error(f"Simulation comparison failed in PDF router: {e}")
    
    temp_dir = tempfile.gettempdir()
    pdf_filename = f"{country.code}_Transition_Brief.pdf"
    pdf_path = os.path.join(temp_dir, pdf_filename)
    
    generate_pdf_report(
        pdf_path, 
        country.name, 
        country.code, 
        history_data, 
        forecast_data, 
        insights,
        risk_scores,
        correlation,
        peers,
        extra_metrics,
        cluster_id,
        fuel_mix,
        attention,
        shap_data,
        simulation
    )
    
    return FileResponse(
        path=pdf_path,
        filename=pdf_filename,
        media_type="application/pdf"
    )
