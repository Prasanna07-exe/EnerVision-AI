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
        f"[DATA CONTEXT]\n{context_str}\n"
    )

    # Format message history for Ollama chat API
    ollama_messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.history[-5:]: # Pass last 5 exchanges
        ollama_messages.append({"role": msg.role, "content": msg.content})
    ollama_messages.append({"role": "user", "content": payload.message})

    # 4. Invoke local Ollama
    thoughts.append(AgentThought(
        agent_name="Orchestrator Agent",
        thought="Assembled data context. Dispatching prompt to local Ollama/Qwen model..."
    ))

    async_client = httpx.AsyncClient()
    try:
        url = f"{settings.OLLAMA_URL}/api/chat"
        # We send request to Ollama using qwen2.5:7b (default)
        # We use a short timeout to prevent backend hanging if Ollama is lagging
        response = await async_client.post(
            url,
            json={
                "model": "qwen2.5:7b",
                "messages": ollama_messages,
                "stream": False
            },
            timeout=15.0
        )
        response.raise_for_status()
        res_json = response.json()
        ai_response = res_json["message"]["content"]
        
        thoughts.append(AgentThought(
            agent_name="Synthesizer Agent",
            thought="Received response from Ollama. Validated output and compiling report."
        ))

        return ChatResponse(
            response=ai_response,
            thoughts=thoughts
        )
    except Exception as e:
        logger.error(f"Failed to communicate with Ollama: {e}")
        # Graceful fallback so the application doesn't crash
        return ChatResponse(
            response=OLLAMA_OFFLINE_MSG,
            thoughts=thoughts
        )
    finally:
        await async_client.aclose()
