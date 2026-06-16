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
import { ShieldCheck, Sparkles } from "lucide-react";

export const Forecast: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("IND");
  const [selectedMetric, setSelectedMetric] = useState<string>("electricity_demand");
  const [selectedModel, setSelectedModel] = useState<string>("ensemble");
  
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load country listings
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const list = await ApiService.getCountries();
        setCountries(list);
        if (list.length > 0) {
          // Default to India (IND) if available, or first country
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
      confidence: [h.value, h.value] // Collapses envelope on line
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Selection Header Control Bar */}
      <div className="glass-panel p-6 flex flex-wrap gap-6 items-end justify-between">
        <div className="flex flex-wrap gap-6 flex-1">
          {/* Country Select */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold block">Select Country</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-48 font-medium"
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
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-56 font-medium"
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
              className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-neonBlue w-48 font-medium"
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
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
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

          <div className="glass-panel p-6 space-y-3">
            <h4 className="font-bold text-white text-md">🧠 Model Validator Insights</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Based on historical trends and economic metrics, the forecast projects a steady transition pattern. 
              {selectedMetric === "renewable_share" 
                ? " Renewable share gains accelerate over time as installation cost curves decrease relative to fossil base loads."
                : selectedMetric === "co2_emissions" 
                ? " Emissions trajectories are highly correlated with industrial growth rates and coal retirements."
                : " Power demand is projected to scale alongside GDP and urbanization lags."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
