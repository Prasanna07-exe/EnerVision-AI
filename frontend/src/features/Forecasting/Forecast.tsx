import React, { useState, useEffect } from "react";
import { 
  ComposedChart,
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { ApiService } from "../../services/api";
import type { Country, ForecastResponse } from "../../services/api";
import { ShieldCheck, Sparkles, HelpCircle, TrendingUp, AlertTriangle } from "lucide-react";

export const Forecast: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("IND");
  const [selectedMetric, setSelectedMetric] = useState<string>("electricity_demand");
  const [selectedModel, setSelectedModel] = useState<string>("ensemble");
  
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [shapData, setShapData] = useState<{ base_value: number; prediction_value: number; attributions: Record<string, number> } | null>(null);
  const [loadingShap, setLoadingShap] = useState<boolean>(false);

  const [attentionData, setAttentionData] = useState<{ years: number[]; attention: number[] } | null>(null);
  const [loadingAttention, setLoadingAttention] = useState<boolean>(false);

  // Fetch LSTM self-attention weights
  useEffect(() => {
    const fetchAttention = async () => {
      try {
        setLoadingAttention(true);
        const data = await ApiService.getLSTMAttention(selectedCountry);
        setAttentionData(data);
      } catch (err: any) {
        console.error("Failed to load LSTM attention data:", err);
        setAttentionData(null);
      } finally {
        setLoadingAttention(false);
      }
    };
    if (selectedCountry && selectedModel === "lstm") {
      fetchAttention();
    } else {
      setAttentionData(null);
    }
  }, [selectedCountry, selectedModel]);

  // User interactive state: Probed future milestone
  const [milestoneYear, setMilestoneYear] = useState<number>(2030);

  // Fetch SHAP explainability data
  useEffect(() => {
    const fetchShap = async () => {
      try {
        setLoadingShap(true);
        const data = await ApiService.getShapExplanation(selectedCountry, selectedMetric);
        setShapData(data);
      } catch (err: any) {
        console.error("Failed to load SHAP data:", err);
        setShapData(null);
      } finally {
        setLoadingShap(false);
      }
    };
    if (selectedCountry && selectedMetric) {
      fetchShap();
    }
  }, [selectedCountry, selectedMetric]);

  // Load country listings
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const list = await ApiService.getCountries();
        setCountries(list);
        if (list.length > 0) {
          const ind = list.find(c => c.code === "IND");
          setSelectedCountry(ind ? "IND" : list[0].code);
        }
      } catch (err: any) {
        console.error("Failed to load countries:", err);
      }
    };
    loadCountries();
  }, []);

  // Fetch forecast data on select changes
  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await ApiService.getForecast(selectedCountry, selectedMetric, selectedModel);
        setForecastData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load forecast");
      } finally {
        setLoading(false);
      }
    };
    if (selectedCountry) {
      fetchForecast();
    }
  }, [selectedCountry, selectedMetric, selectedModel]);

  // Merge historical and forecast arrays for Recharts composition
  const getChartData = () => {
    if (!forecastData) return [];
    
    const hist = forecastData.historical.map(h => ({
      year: h.year,
      historicalValue: h.value,
      forecastValue: null,
      confidence: [h.value, h.value]
    }));

    const fore = forecastData.forecast.map(f => ({
      year: f.year,
      historicalValue: null,
      forecastValue: f.value,
      confidence: [f.confidence_lower || f.value, f.confidence_upper || f.value]
    }));

    return [...hist, ...fore];
  };

  const chartData = getChartData();

  // Metric metadata
  const metricUnits: Record<string, string> = {
    electricity_demand: "TWh",
    co2_emissions: "Million tonnes CO2",
    renewable_share: "%"
  };

  const formatYAxis = (value: number) => {
    if (selectedMetric === "renewable_share") {
      return `${(value * 100).toFixed(0)}%`;
    }
    return value.toLocaleString();
  };

  // Milestone Probe calculations
  const getMilestoneAnalysis = () => {
    if (!forecastData || forecastData.historical.length === 0 || forecastData.forecast.length === 0) {
      return null;
    }

    const lastHist = forecastData.historical[forecastData.historical.length - 1];
    const milestonePoint = forecastData.forecast.find(f => f.year === milestoneYear) || forecastData.forecast[0];

    if (!milestonePoint) return null;

    const changePct = (((milestonePoint.value - lastHist.value) / (lastHist.value || 1.0)) * 100).toFixed(1);
    const unit = selectedMetric === "renewable_share" ? "%" : metricUnits[selectedMetric];

    const valStr = selectedMetric === "renewable_share" 
      ? `${(milestonePoint.value * 100).toFixed(1)}${unit}` 
      : `${milestonePoint.value.toFixed(1)} ${unit}`;
    
    const lowStr = selectedMetric === "renewable_share"
      ? `${((milestonePoint.confidence_lower || milestonePoint.value) * 100).toFixed(1)}${unit}`
      : `${(milestonePoint.confidence_lower || milestonePoint.value).toFixed(1)} ${unit}`;

    const highStr = selectedMetric === "renewable_share"
      ? `${((milestonePoint.confidence_upper || milestonePoint.value) * 100).toFixed(1)}${unit}`
      : `${(milestonePoint.confidence_upper || milestonePoint.value).toFixed(1)} ${unit}`;

    let statusType: "success" | "warning" | "error" = "success";
    let message = "";

    if (selectedMetric === "co2_emissions") {
      if (parseFloat(changePct) < -15) {
        statusType = "success";
        message = "On track. Emissions drop indicates active coal displacement and aggressive decarbonization.";
      } else if (parseFloat(changePct) < 0) {
        statusType = "warning";
        message = "Slow progress. Marginal emission reductions. Additional grid interventions are recommended.";
      } else {
        statusType = "error";
        message = "Danger. Rising emissions output. Fossil base loads are outpacing carbon reduction schemes.";
      }
    } else if (selectedMetric === "renewable_share") {
      if (parseFloat(changePct) > 15) {
        statusType = "success";
        message = "Rapid expansion. Fast low-carbon scaling. Interconnection parameters look favorable.";
      } else if (parseFloat(changePct) > 2) {
        statusType = "warning";
        message = "Steady growth. Renewables share is expanding slowly. Grid storage reserves must be bolstered.";
      } else {
        statusType = "error";
        message = "Stagnation. Clean installation rates are low. Heavy reliance on legacy baseline fuels.";
      }
    } else {
      if (parseFloat(changePct) > 30) {
        statusType = "warning";
        message = "High grid stress. Rapid electricity demand expansion. Planners must increase reserve margins.";
      } else {
        statusType = "success";
        message = "Manageable growth. Electricity grid loads are expanding within predictable limits.";
      }
    }

    return {
      value: valStr,
      lowerBound: lowStr,
      upperBound: highStr,
      change: changePct,
      status: statusType,
      explanation: message
    };
  };

  const milestoneInfo = getMilestoneAnalysis();

  const getDynamicAnalysis = () => {
    if (!forecastData || forecastData.historical.length === 0 || forecastData.forecast.length === 0) {
      return <span className="text-slate-500 italic">Select a country and metrics to load dynamic analysis.</span>;
    }

    const lastHist = forecastData.historical[forecastData.historical.length - 1];
    const endFore = forecastData.forecast[forecastData.forecast.length - 1];

    const projectedChange = (((endFore.value - lastHist.value) / (lastHist.value || 1.0)) * 100).toFixed(1);
    
    let peakVal = -Infinity;
    let peakYear = 2025;
    forecastData.forecast.forEach(f => {
      if (f.value > peakVal) {
        peakVal = f.value;
        peakYear = f.year;
      }
    });

    const metricName = selectedMetric === "electricity_demand" 
      ? "electricity demand" 
      : selectedMetric === "co2_emissions" 
      ? "carbon emissions" 
      : "renewable share";

    const unit = selectedMetric === "renewable_share" ? "%" : metricUnits[selectedMetric];
    
    const startValStr = selectedMetric === "renewable_share" ? `${(lastHist.value * 100).toFixed(1)}${unit}` : `${lastHist.value.toFixed(1)} ${unit}`;
    const endValStr = selectedMetric === "renewable_share" ? `${(endFore.value * 100).toFixed(1)}${unit}` : `${endFore.value.toFixed(1)} ${unit}`;
    const peakValStr = selectedMetric === "renewable_share" ? `${(peakVal * 100).toFixed(1)}${unit}` : `${peakVal.toFixed(1)} ${unit}`;

    let shapCommentary = "";
    if (shapData && Object.keys(shapData.attributions).length > 0) {
      let topPosKey = "";
      let topPosVal = -Infinity;
      let topNegKey = "";
      let topNegVal = Infinity;

      Object.entries(shapData.attributions).forEach(([key, val]) => {
        if (val > topPosVal) {
          topPosVal = val;
          topPosKey = key;
        }
        if (val < topNegVal) {
          topNegVal = val;
          topNegKey = key;
        }
      });

      const readableNames: Record<string, string> = {
        year: "Target Year (2025)",
        population: "Population Growth",
        gdp: "GDP Growth",
        gdp_per_capita: "GDP Per Capita",
        electricity_generation_lag_1: "Demand Momentum (1y Lag)",
        electricity_generation_lag_3: "Demand Momentum (3y Lag)",
        emissions_lag_1: "Emissions Momentum (1y Lag)",
        emissions_lag_3: "Emissions Momentum (3y Lag)",
        renewable_share_lag_1: "Renewables Momentum (1y Lag)",
        renewable_share_lag_3: "Renewables Momentum (3y Lag)",
        ev_sales_share: "EV Adoption"
      };

      const posDriver = readableNames[topPosKey] || topPosKey;
      const negDriver = readableNames[topNegKey] || topNegKey;

      shapCommentary = ` In addition, game-theoretic XAI feature attribution (SHAP) indicates that "${posDriver}" (+${topPosVal.toFixed(2)}) is pushing predictions up, while "${negDriver}" (${topNegVal.toFixed(2)}) pulls them down.`;
    }

    let coreCommentary = "";
    if (selectedMetric === "co2_emissions") {
      if (parseFloat(projectedChange) < 0) {
        coreCommentary = `The forecast indicates a downward trajectory in emissions. This structural decarbonization is highly correlated with clean capacity additions displacing thermal baseline output.`;
      } else {
        coreCommentary = `Emissions are projected to rise, signaling that clean capacity installations are currently outpaced by raw load demand expansion. Strategic interventions are required.`;
      }
    } else if (selectedMetric === "renewable_share") {
      if (parseFloat(projectedChange) > 10) {
        coreCommentary = `A robust renewable expansion is anticipated. Falling solar/wind installation costs and grid connection mandates are successfully accelerating renewable share gains.`;
      } else {
        coreCommentary = `Renewable share growth is stagnating. Grid integration constraints, base-load fossil dependencies, or lock-in effects are hindering the transition pace.`;
      }
    } else {
      coreCommentary = `Grid load demand is projected to expand. This requires planners to expand backup reserves and capacity margins to ensure grid security.`;
    }

    return (
      <div className="space-y-2">
        <p className="text-slate-300">
          The <span className="text-neonBlue font-bold">{forecastData.model.toUpperCase()}</span> engine projects that for <strong className="text-white">{forecastData.country}</strong>, {metricName} will shift from a baseline of <strong className="text-slate-200">{startValStr}</strong> (latest historical) to <strong className="text-white">{endValStr}</strong> by 2045.
        </p>
        <p className="text-slate-450 leading-relaxed text-[11px] mt-1 text-slate-450">
          This represents a <span className={`font-bold ${parseFloat(projectedChange) >= 0 ? 'text-neonRed' : 'text-neonGreen'}`}>{projectedChange}%</span> change over the 20-year horizon, with values peaking at <strong className="text-slate-300">{peakValStr}</strong> in the year <strong className="text-white">{peakYear}</strong>.
        </p>
        <p className="text-slate-450 leading-relaxed text-[11px] mt-1 text-slate-400">
          {coreCommentary}{shapCommentary}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 0. Enterprise Explainer Header Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-darkBg/60 to-neonBlue/5 border-neonBlue/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
            <TrendingUp className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              Long-term Predictive Forecasts
            </h2>
            <p className="text-xs text-slate-400">
              Decadal projections with neural network uncertainty bounds and cooperative SHAP explanations.
            </p>
          </div>
        </div>

        {/* Informational Guidance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-glassBorder/40 text-xs">
          <div className="space-y-1">
            <span className="text-neonBlue font-bold block uppercase tracking-wider text-[10px]">🎯 What is it for? (Resembles: The Weather Map)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Predicts long-term grid demand surges and emissions peak years using neural networks, before load-shedding crises happen.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-neonGreen font-bold block uppercase tracking-wider text-[10px]">⚙️ What does it do? (Energy Context)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Computes decadal projection curves (2025–2045) mapped with a 95% Bayesian credible envelope and SHAP feature drivers.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-purple-450 font-bold block uppercase tracking-wider text-[10px] text-purple-400">💼 Business Decisions Supported</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Plan utility battery capacity sizing timelines and verify if sovereign grids meet net-zero compliance windows.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Selection Header Control Bar */}
      <div className="glass-panel p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          {/* Country Select */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">Select Country</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-full font-medium"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Metric Select */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">Target Indicator</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-full font-medium"
            >
              <option value="electricity_demand">Electricity Demand (TWh)</option>
              <option value="co2_emissions">CO2 Emissions (MT)</option>
              <option value="renewable_share">Renewable Share (%)</option>
            </select>
          </div>

          {/* Model Select */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">Forecast Engine</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-full font-medium"
            >
              <option value="ensemble">🚀 Auto-Ensemble Router</option>
              <option value="xgboost">XGBoost Decision Trees</option>
              <option value="prophet">FB Prophet Time Series</option>
              <option value="lstm">🧠 PyTorch LSTM Deep Learning</option>
              <option value="linear_regression">Linear Regression Baseline</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Forecast Graphic Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Column */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Transition Forecast Path (1990 - 2045)
              </h3>
              <span className="text-xs text-slate-400">
                Plotting historical outputs alongside model forecasts with confidence intervals
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-neonBlue"></span> Historical</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-neonGreen"></span> Projection</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-neonGreen/10 border border-neonGreen/20"></span> 95% Confidence</span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-80 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neonGreen"></div>
              <p className="text-slate-400 text-xs">Processing prediction curves...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-80 text-neonRed text-sm">{error}</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '11px' }} />
                  <YAxis 
                    stroke="#475569" 
                    tickLine={false} 
                    style={{ fontSize: '11px' }} 
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px" }}
                    labelStyle={{ fontWeight: "bold", color: "#f3f4f6" }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(value: any, name: string) => {
                      if (name === "confidence") {
                        const low = selectedMetric === "renewable_share" ? `${(value[0]*100).toFixed(1)}%` : value[0].toFixed(1);
                        const high = selectedMetric === "renewable_share" ? `${(value[1]*100).toFixed(1)}%` : value[1].toFixed(1);
                        return [`[${low} - ${high}]`, "95% Range"];
                      }
                      const formatted = selectedMetric === "renewable_share" ? `${(value*100).toFixed(1)}%` : value.toFixed(1);
                      return [formatted, name === "historicalValue" ? "Historical" : "Forecast"];
                    }}
                  />
                  
                  {/* Shaded Confidence Interval Envelope */}
                  <Area 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="none" 
                    fill="rgba(57, 255, 20, 0.08)" 
                  />
                  
                  {/* Solid Historical Line */}
                  <Line 
                    type="monotone" 
                    dataKey="historicalValue" 
                    stroke="#00f2fe" 
                    strokeWidth={3} 
                    dot={false}
                    activeDot={{ r: 6 }} 
                  />
                  
                  {/* Dotted Forecast Line */}
                  <Line 
                    type="monotone" 
                    dataKey="forecastValue" 
                    stroke="#39ff14" 
                    strokeWidth={2.5} 
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 6 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* PyTorch LSTM Attention Heatmap Component */}
          {selectedModel === "lstm" && (
            <div className="border-t border-glassBorder/40 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">🧠 PyTorch Deep Learning Attention Heatmap:</span>
                  <span className="text-[10px] text-slate-500">
                    Self-attention weights reveal which historical lag years most heavily dictate decadal forecasts.
                  </span>
                </div>
                <span className="text-[9px] text-neonBlue bg-neonBlue/10 border border-neonBlue/20 px-2 py-0.5 rounded-md font-semibold">
                  {loadingAttention ? "Extracting Weights..." : "Self-Attention Layer Active"}
                </span>
              </div>
              
              {loadingAttention ? (
                <div className="flex justify-center items-center py-6 space-x-2 bg-darkBg/20 rounded-xl border border-glassBorder/20">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-neonBlue"></div>
                  <span className="text-[10px] text-slate-400">Loading LSTM attention weights...</span>
                </div>
              ) : attentionData ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  {attentionData.years.map((year, idx) => {
                    const attVal = attentionData.attention[idx] || 0.2;
                    const intensityPct = (attVal * 100).toFixed(1);
                    const bgOpacity = Math.min(0.8, Math.max(0.12, attVal * 3.0));
                    return (
                      <div 
                        key={year} 
                        className="p-3.5 rounded-xl border transition-all duration-200"
                        style={{
                          backgroundColor: `rgba(0, 242, 254, ${bgOpacity})`,
                          borderColor: `rgba(0, 242, 254, ${bgOpacity + 0.1})`,
                        }}
                      >
                        <strong className="text-white text-xs block font-extrabold">{year}</strong>
                        <span className="text-[10px] font-bold text-white block mt-1.5">{intensityPct}%</span>
                        <span className="text-[8px] text-slate-350 block uppercase tracking-wider text-[7px] mt-0.5">Weight</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic text-center py-4 bg-darkBg/20 rounded-xl border border-glassBorder/20">
                  No attention weight array found.
                </div>
              )}
            </div>
          )}

          {/* Decadal milestone selector probe */}
          <div className="border-t border-glassBorder/40 pt-4 flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">📍 Probe Target Year:</span>
              <div className="flex gap-1">
                {[2030, 2035, 2040, 2045].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setMilestoneYear(yr)}
                    className={`px-3 py-1.5 rounded-lg border font-bold transition-all duration-150 ${
                      milestoneYear === yr
                        ? "bg-neonBlue/15 text-neonBlue border-neonBlue shadow-neon"
                        : "bg-darkBg/30 border-glassBorder/40 text-slate-450 hover:text-slate-200"
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            
            {milestoneInfo && (
              <div className="flex-1 bg-darkBg/20 border border-glassBorder/40 p-3 rounded-lg flex items-center gap-3">
                {milestoneInfo.status === "success" && <ShieldCheck className="w-5 h-5 text-neonGreen flex-shrink-0" />}
                {milestoneInfo.status === "warning" && <HelpCircle className="w-5 h-5 text-amber-450 flex-shrink-0 text-amber-450" />}
                {milestoneInfo.status === "error" && <AlertTriangle className="w-5 h-5 text-neonRed flex-shrink-0" />}
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    Projected Value for {milestoneYear}: <strong className="text-white font-black">{milestoneInfo.value}</strong> 
                    <span className="ml-2 font-normal text-slate-400">({milestoneInfo.change}% shift)</span>
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{milestoneInfo.explanation}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Model Audit Diagnostics Info Column */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-neonGreen" /> Model Selection Metadata
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Engine:</span>
                <span className="font-bold text-neonBlue uppercase">{forecastData?.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Variable:</span>
                <span className="font-bold text-slate-200 capitalize">{selectedMetric.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unit:</span>
                <span className="font-bold text-slate-200">{metricUnits[selectedMetric]}</span>
              </div>
            </div>
            <div className="bg-glassBg/40 border border-glassBorder p-3 rounded-lg text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-neonBlue inline mr-1" />
              The Auto-Ensemble engine ranks and selects models based on cross-validation Mean Absolute Percentage Error (MAPE).
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <h4 className="font-bold text-white text-md flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neonGreen" /> AI Forecast Analyst Commentary
            </h4>
            <div className="text-xs text-slate-450 leading-relaxed">
              {loading ? (
                <p className="text-xs text-slate-500 italic">Computing analysis...</p>
              ) : (
                getDynamicAnalysis()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. XGBoost XAI Explainability Section */}
      <div className="glass-panel p-6 space-y-4">
        <h4 className="font-bold text-white text-md mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-neonBlue" /> XGBoost Feature Attribution (SHAP Explainability)
        </h4>
        <p className="text-xs text-slate-400 mb-6 max-w-3xl">
          SHAP values quantify how much each demographic and historical indicator contributes positively (neon red, pushing values up) or negatively (neon green, pulling values down) to push the 2025 forecast away from the historical baseline average.
        </p>
        
        {loadingShap ? (
          <div className="py-4 text-xs text-slate-500 animate-pulse">Calculating local feature attributions...</div>
        ) : !shapData ? (
          <p className="text-xs text-slate-500">Explainability attributions not available for this configuration.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary statistics */}
            <div className="flex flex-wrap gap-8 text-xs bg-darkBg/20 border border-glassBorder/40 p-4 rounded-xl w-fit">
              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">Historical Base Value</span>
                <strong className="text-white text-sm">
                  {selectedMetric === "renewable_share" ? `${(shapData.base_value * 100).toFixed(1)}%` : shapData.base_value.toFixed(1)} {metricUnits[selectedMetric]}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">Directional Push</span>
                <strong className={`text-sm ${shapData.prediction_value >= shapData.base_value ? 'text-neonRed' : 'text-neonGreen'}`}>
                  {shapData.prediction_value >= shapData.base_value ? '+' : ''}
                  {selectedMetric === "renewable_share" 
                    ? `${((shapData.prediction_value - shapData.base_value) * 100).toFixed(1)}%` 
                    : (shapData.prediction_value - shapData.base_value).toFixed(1)} {metricUnits[selectedMetric]}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase tracking-wider text-[10px]">2025 Model Forecast</span>
                <strong className="text-neonBlue text-sm">
                  {selectedMetric === "renewable_share" ? `${(shapData.prediction_value * 100).toFixed(1)}%` : shapData.prediction_value.toFixed(1)} {metricUnits[selectedMetric]}
                </strong>
              </div>
            </div>
            
            {/* Feature attribution bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl">
              {Object.entries(shapData.attributions)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .map(([key, val]) => {
                  const readableNames: Record<string, string> = {
                    year: "Target Year (2025)",
                    population: "Population Trend",
                    gdp: "Economic Growth (GDP)",
                    gdp_per_capita: "GDP Per Capita",
                    electricity_generation_lag_1: "Demand Momentum (1y Lag)",
                    electricity_generation_lag_3: "Demand Momentum (3y Lag)",
                    emissions_lag_1: "Emissions Momentum (1y Lag)",
                    emissions_lag_3: "Emissions Momentum (3y Lag)",
                    renewable_share_lag_1: "Renewables Momentum (1y Lag)",
                    renewable_share_lag_3: "Renewables Momentum (3y Lag)",
                    ev_sales_share: "EV Adoption Share"
                  };
                  const name = readableNames[key] || key;
                  const maxAbs = Math.max(...Object.values(shapData.attributions).map(Math.abs)) || 1.0;
                  const pct = Math.min(100, Math.max(3, (Math.abs(val) / maxAbs) * 100));
                  
                  return (
                    <div key={key} className="space-y-1 bg-darkBg/10 border border-glassBorder/20 p-2.5 rounded-lg">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">{name}</span>
                        <span className={val >= 0 ? "text-neonRed" : "text-neonGreen"}>
                          {val >= 0 ? `+` : ``}
                          {selectedMetric === "renewable_share" ? `${(val * 100).toFixed(2)}%` : val.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden flex">
                        {val >= 0 ? (
                          <div className="h-full bg-gradient-to-r from-neonRed/50 to-neonRed rounded-full" style={{ width: `${pct}%` }} />
                        ) : (
                          <div className="h-full bg-gradient-to-r from-neonGreen/50 to-neonGreen rounded-full" style={{ width: `${pct}%` }} />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
