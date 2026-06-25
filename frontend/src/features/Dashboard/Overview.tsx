import React, { useState, useEffect } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { ApiService } from "../../services/api";
import type { KPIData, FuelMixPoint, Country } from "../../services/api";
import { Zap, ShieldAlert, Sparkles, Globe, BarChart2, TrendingUp, Info } from "lucide-react";

export const Overview: React.FC = () => {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [mix, setMix] = useState<FuelMixPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User interaction state: Selected year for dynamic commentary
  const [selectedMixYear, setSelectedMixYear] = useState<number>(2024);

  // Correlation Matrix State
  const [countriesList, setCountriesList] = useState<Country[]>([]);
  const [corrMode, setCorrMode] = useState<"variables" | "countries">("variables");
  const [selectedSingleCountry, setSelectedSingleCountry] = useState<string>("IND");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["IND", "USA", "CHN", "DEU"]);
  const [selectedMetric, setSelectedMetric] = useState<string>("co2_emissions");
  const [corrResult, setCorrResult] = useState<{ mode: string; country?: string; labels: string[]; matrix: number[][] } | null>(null);
  const [corrLoading, setCorrLoading] = useState<boolean>(false);
  const [corrError, setCorrError] = useState<string | null>(null);

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        setLoading(true);
        const [kpiRes, mixRes, countryRes] = await Promise.all([
          ApiService.getKPIs(),
          ApiService.getGlobalMix(),
          ApiService.getCountries()
        ]);
        setKpis(kpiRes);
        setMix(mixRes);
        setCountriesList(countryRes);
        if (mixRes.length > 0) {
          const maxYear = Math.max(...mixRes.map(m => m.year));
          setSelectedMixYear(maxYear);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    loadOverviewData();
  }, []);

  useEffect(() => {
    const fetchCorrelation = async () => {
      setCorrLoading(true);
      setCorrError(null);
      try {
        if (corrMode === "variables") {
          const res = await ApiService.getCorrelation(selectedSingleCountry);
          setCorrResult(res);
        } else {
          if (selectedCountries.length < 2) {
            setCorrResult(null);
            return;
          }
          const res = await ApiService.getCorrelation(selectedCountries.join(","), selectedMetric);
          setCorrResult(res);
        }
      } catch (err: any) {
        setCorrError(err.message || "Failed to fetch correlation matrix");
      } finally {
        setCorrLoading(false);
      }
    };

    fetchCorrelation();
  }, [corrMode, selectedSingleCountry, selectedCountries, selectedMetric]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neonBlue"></div>
        <p className="text-slate-400 text-sm">Compiling global transition indicators...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel border-neonRed/30 p-8 flex items-center gap-4 text-neonRed max-w-xl mx-auto mt-12">
        <ShieldAlert className="w-8 h-8 flex-shrink-0" />
        <div>
          <h4 className="font-bold text-lg">Inbound API Connection Timeout</h4>
          <p className="text-sm text-slate-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Get active year data details
  const activeYearData = mix.find(m => m.year === selectedMixYear) || mix[mix.length - 1];
  const firstYearData = mix[0]; // Usually 1990

  // Calculations for active year
  const getYearSummary = (data: FuelMixPoint) => {
    if (!data) return { total: 0, clean: 0, fossil: 0, cleanPct: 0, fossilPct: 0 };
    const total = data.coal + data.gas + data.solar + data.wind + data.hydro + data.nuclear;
    const clean = data.solar + data.wind + data.hydro + data.nuclear;
    const fossil = data.coal + data.gas;
    return {
      total,
      clean,
      fossil,
      cleanPct: total > 0 ? (clean / total) * 100 : 0,
      fossilPct: total > 0 ? (fossil / total) * 100 : 0
    };
  };

  const activeStats = getYearSummary(activeYearData);
  const baselineStats = getYearSummary(firstYearData);

  const cleanShift = activeStats.cleanPct - baselineStats.cleanPct;

  // Find dominant source in selected year
  const getDominantSource = (data: FuelMixPoint) => {
    if (!data) return "N/A";
    const sources = [
      { name: "Coal", value: data.coal },
      { name: "Natural Gas", value: data.gas },
      { name: "Solar PV", value: data.solar },
      { name: "Wind", value: data.wind },
      { name: "Hydroelectric", value: data.hydro },
      { name: "Nuclear", value: data.nuclear }
    ];
    sources.sort((a, b) => b.value - a.value);
    return sources[0].name;
  };

  const dominantSource = getDominantSource(activeYearData);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 0. Enterprise Explainer Header Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-darkBg/60 to-neonBlue/5 border-neonBlue/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              Global Sovereign Transition Portal
            </h2>
            <p className="text-xs text-slate-400">
              Historical energy baseline aggregations, capacity monitoring, and macro emissions KPIs.
            </p>
          </div>
        </div>

        {/* Informational Guidance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-glassBorder/40 text-xs">
          <div className="space-y-1">
            <span className="text-neonBlue font-bold block uppercase tracking-wider text-[10px]">🎯 What is it for? (Resembles: The Grid Dashboard)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Establishes current baseline generation mixes (TWh) and emissions before modeling hypothetical future policies.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-neonGreen font-bold block uppercase tracking-wider text-[10px]">⚙️ What does it do? (Energy Context)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Aggregates global generation records, emissions baselines, and renewable share percentages since 1990.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-purple-450 font-bold block uppercase tracking-wider text-[10px] text-purple-400">💼 Business Decisions Supported</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Benchmark national grid capacities to prioritize green energy capital deployment and market entry.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Global KPI Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1: Total Generation */}
        <div className="glass-panel p-6 flex items-start justify-between relative overflow-hidden group hover:border-neonBlue/30 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Global Electricity Generation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white animate-pulse">
                {kpis?.global.electricity_generation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs font-semibold text-slate-400">TWh</span>
            </div>
            <p className="text-xs text-neonGreen">Yearly aggregate metrics</p>
          </div>
          <div className="bg-neonBlue/10 p-3 rounded-lg text-neonBlue">
            <Zap className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 2: Emissions */}
        <div className="glass-panel p-6 flex items-start justify-between relative overflow-hidden group hover:border-neonRed/30 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Carbon Emissions Output
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {kpis?.global.emissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs font-semibold text-slate-400">Million tonnes</span>
            </div>
            <p className="text-xs text-slate-400">Total Greenhouse Gases (CO2e)</p>
          </div>
          <div className="bg-neonRed/10 p-3 rounded-lg text-neonRed">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Metric Card 3: Renewable Share */}
        <div className="glass-panel p-6 flex items-start justify-between relative overflow-hidden group hover:border-neonGreen/30 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Renewable Energy Share
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {((kpis?.global.renewable_share || 0) * 100).toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-400">%</span>
            </div>
            <p className="text-xs text-neonGreen">Includes Solar, Wind, and Hydro</p>
          </div>
          <div className="bg-neonGreen/10 p-3 rounded-lg text-neonGreen">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Fuel Mix Chart + Dynamic Commentary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Fuel Mix Stacked Area Chart */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Global Electricity Fuel Mix Transition
              </h3>
              <span className="text-xs text-slate-400 block mt-0.5">
                Historical development of electricity generation mix (TWh) from 1990 to present
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#f59e0b]"></span> Solar</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#10b981]"></span> Wind</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#3b82f6]"></span> Hydro</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#64748b]"></span> Coal</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#f97316]"></span> Gas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#a855f7]"></span> Nuclear</span>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={mix} 
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                onClick={(state) => {
                  if (state && state.activePayload && state.activePayload.length > 0) {
                    const year = state.activePayload[0].payload.year;
                    setSelectedMixYear(year);
                  }
                }}
              >
                <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                <Tooltip 
                  contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px" }}
                  labelStyle={{ fontWeight: "bold", color: "#f3f4f6" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area type="monotone" dataKey="solar" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                <Area type="monotone" dataKey="wind" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="hydro" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="nuclear" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
                <Area type="monotone" dataKey="gas" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} />
                <Area type="monotone" dataKey="coal" stackId="1" stroke="#64748b" fill="#64748b" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="text-[10px] text-slate-500 italic text-center">
            💡 Tip: Click on any year's column in the chart to inspect its transition metrics dynamically.
          </div>
        </div>

        {/* Dynamic Global Pulse Card */}
        <div className="glass-panel p-6 flex flex-col justify-between border-glassBorder/60 bg-darkBg/20">
          <div className="space-y-4">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neonGreen animate-pulse" /> Yearly Transition Pulse
            </h4>

            {/* Selector Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Scrub Target Year:</span>
                <span className="text-neonBlue font-extrabold">{selectedMixYear}</span>
              </div>
              <input
                type="range"
                min={mix[0]?.year || 1990}
                max={mix[mix.length - 1]?.year || 2024}
                value={selectedMixYear}
                onChange={(e) => setSelectedMixYear(Number(e.target.value))}
                className="w-full accent-neonBlue h-1 bg-darkBg rounded-lg cursor-pointer"
              />
            </div>

            {/* Dynamic calculations list */}
            {activeYearData ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-darkBg/30 p-3 rounded-lg border border-glassBorder/20">
                    <span className="text-slate-450 block text-[10px] uppercase font-bold text-slate-500 mb-1">🌿 Low-Carbon</span>
                    <strong className="text-white text-sm">{activeStats.cleanPct.toFixed(1)}%</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{(activeStats.clean).toFixed(0)} TWh</span>
                  </div>
                  <div className="bg-darkBg/30 p-3 rounded-lg border border-glassBorder/20">
                    <span className="text-slate-450 block text-[10px] uppercase font-bold text-slate-500 mb-1">🔥 Fossil Fuels</span>
                    <strong className="text-white text-sm">{activeStats.fossilPct.toFixed(1)}%</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{(activeStats.fossil).toFixed(0)} TWh</span>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                    <span>Clean vs Fossil Generation Mix Share</span>
                  </div>
                  <div className="w-full h-2.5 bg-darkBg rounded-full overflow-hidden flex border border-glassBorder">
                    <div className="h-full bg-neonGreen shadow-neonGreen" style={{ width: `${activeStats.cleanPct}%` }} />
                    <div className="h-full bg-slate-500" style={{ width: `${activeStats.fossilPct}%` }} />
                  </div>
                </div>

                {/* Dynamic commentary paragraph */}
                <div className="space-y-2 text-xs text-slate-300 leading-relaxed border-t border-glassBorder/30 pt-3">
                  <p>
                    In <strong className="text-white">{selectedMixYear}</strong>, clean energy (Solar, Wind, Hydro, Nuclear) accounted for <span className="text-neonGreen font-bold">{activeStats.cleanPct.toFixed(1)}%</span> of the global grid mix, while fossil fuels accounted for <span className="text-slate-200">{activeStats.fossilPct.toFixed(1)}%</span>.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Compared to the 1990 baseline, the low-carbon share has shifted by <span className={`font-bold ${cleanShift >= 0 ? "text-neonGreen" : "text-neonRed"}`}>{cleanShift >= 0 ? "+" : ""}{cleanShift.toFixed(1)}%</span>.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    The dominant generation source for this year is <strong className="text-white">{dominantSource}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Select a year to view metrics.</p>
            )}
          </div>

          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block pt-4 mt-4 border-t border-glassBorder/30">
            EnerVision AI Analytical Pulse
          </span>
        </div>
      </div>

      {/* 3. National Spotlights Row */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white tracking-wide">
          🔑 Key Transition Countries Spotlight
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kpis?.countries.map((c) => (
            <div key={c.code} className="glass-panel p-6 space-y-4 hover:border-glassBorder/80 transition-all duration-300">
              <div className="flex items-center gap-3 border-b border-glassBorder pb-3">
                <Globe className="w-5 h-5 text-neonBlue" />
                <div>
                  <h4 className="font-bold text-white">{c.country}</h4>
                  <span className="text-xs text-slate-500 uppercase tracking-widest">{c.code}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">Total Generation</span>
                  <span className="font-bold text-slate-200">{c.electricity_generation.toFixed(1)} TWh</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">CO2 Emissions</span>
                  <span className="font-bold text-slate-200">{c.emissions.toFixed(1)} MT</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">Renewables Penetration</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-darkBg h-2 rounded-full overflow-hidden border border-glassBorder">
                      <div 
                        className="bg-neonGreen h-full rounded-full shadow-neonGreen" 
                        style={{ width: `${c.renewable_share * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-neonGreen">{(c.renewable_share * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Pearson Correlation Matrix Section */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-glassBorder pb-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-neonBlue" />
              Sovereign Pearson Correlation Analysis
            </h3>
            <span className="text-xs text-slate-400 block mt-0.5">
              Pearson Product-Moment Correlation Matrix (\(r\)) benchmarked over historical timeseries (1990-2024).
            </span>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-darkBg/60 border border-glassBorder rounded-lg p-1">
            <button
              onClick={() => setCorrMode("variables")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                corrMode === "variables"
                  ? "bg-neonBlue text-darkBg shadow-neon"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Variable Correlations (Single Country)
            </button>
            <button
              onClick={() => setCorrMode("countries")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                corrMode === "countries"
                  ? "bg-neonBlue text-darkBg shadow-neon"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cross-Sovereign Benchmark
            </button>
          </div>
        </div>

        {/* Configuration Controls & Heatmap Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Panel */}
          <div className="space-y-6 bg-darkBg/20 p-5 rounded-xl border border-glassBorder/40">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-neonBlue" /> Configuration Controls
            </h4>

            {corrMode === "variables" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">Select Target Sovereign:</label>
                  <select
                    value={selectedSingleCountry}
                    onChange={(e) => setSelectedSingleCountry(e.target.value)}
                    className="w-full bg-darkBg border border-glassBorder rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neonBlue cursor-pointer"
                  >
                    {countriesList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 text-xs text-slate-400 leading-relaxed bg-darkBg/40 p-3 rounded-lg border border-glassBorder/10">
                  <span className="font-bold text-white block mb-1">Variable Mode Explanation</span>
                  Analyzes how variables (GDP, CO2 Emissions, Renewable Share, Electricity Demand) correlate with one another over the selected country's timeline.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">Select Comparison Metric:</label>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className="w-full bg-darkBg border border-glassBorder rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neonBlue cursor-pointer"
                  >
                    <option value="co2_emissions">CO2 Emissions (MT)</option>
                    <option value="electricity_demand">Electricity Demand (TWh)</option>
                    <option value="renewable_share">Renewable share (%)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">Select Sovereigns (Min 2, Max 6):</label>
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-glassBorder/40 rounded-lg p-2 bg-darkBg/50">
                    {countriesList.map((c) => {
                      const isChecked = selectedCountries.includes(c.code);
                      return (
                        <label key={c.code} className="flex items-center gap-2 px-1.5 py-1 hover:bg-glassBg/10 rounded cursor-pointer text-xs text-slate-350 text-slate-350">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                if (selectedCountries.length > 2) {
                                  setSelectedCountries(selectedCountries.filter(code => code !== c.code));
                                }
                              } else {
                                if (selectedCountries.length < 6) {
                                  setSelectedCountries([...selectedCountries, c.code]);
                                }
                              }
                            }}
                            className="rounded border-glassBorder bg-darkBg text-neonBlue focus:ring-0 cursor-pointer"
                          />
                          <span>{c.name} ({c.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-slate-400 leading-relaxed bg-darkBg/40 p-3 rounded-lg border border-glassBorder/10">
                  <span className="font-bold text-white block mb-1">Cross-Sovereign Explanation</span>
                  Correlates timeseries patterns between countries for the chosen metric. Helpful for grouping similar policy behaviors or synchronization.
                </div>
              </div>
            )}

            {/* LaTeX Formula Block */}
            <div className="border-t border-glassBorder/30 pt-4 space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">Pearson Coefficient Formula</span>
              <div className="bg-darkBg/40 py-2.5 px-3 rounded-lg border border-glassBorder/10 text-center font-mono text-[10px] text-slate-300">
                {"r = \\frac{\\sum (x - \\bar{x})(y - \\bar{y})}{\\sqrt{\\sum (x - \\bar{x})^2 \\sum (y - \\bar{y})^2}}"}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Where \(x\) and \(y\) are sample means. Values range from \(-1.0\) (perfect inverse correlation) to \(+1.0\) (perfect positive correlation).
              </p>
            </div>
          </div>

          {/* Matrix Visualizer Area */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-6">
            {corrLoading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neonBlue"></div>
                <span className="text-xs text-slate-400">Recalculating Pearson matrices...</span>
              </div>
            ) : corrError ? (
              <div className="text-neonRed text-xs text-center py-12">{corrError}</div>
            ) : corrResult ? (
              <div className="space-y-6">
                {/* Responsive Matrix grid */}
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-[440px] max-w-[600px] mx-auto space-y-1.5">
                    {/* Matrix header row */}
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `90px repeat(${corrResult.labels.length}, 1fr)` }}>
                      <div className="h-10"></div>
                      {corrResult.labels.map((lbl, idx) => {
                        const short = lbl.toLowerCase() === "electricity_demand" ? "Demand" : 
                                      lbl.toLowerCase() === "co2_emissions" ? "Emissions" : 
                                      lbl.toLowerCase() === "renewable_share" ? "Renewables" : 
                                      lbl.toLowerCase() === "gdp_per_capita" ? "GDP/cap" : lbl;
                        return (
                          <div 
                            key={idx} 
                            className="text-center font-bold text-[10px] md:text-xs text-slate-400 flex items-center justify-center px-1 leading-tight"
                            title={lbl}
                          >
                            {short}
                          </div>
                        );
                      })}
                    </div>

                    {/* Matrix grid rows */}
                    {corrResult.matrix.map((rowVals, rIdx) => {
                      const rowLabel = corrResult.labels[rIdx];
                      const rowShort = rowLabel.toLowerCase() === "electricity_demand" ? "Demand" : 
                                       rowLabel.toLowerCase() === "co2_emissions" ? "Emissions" : 
                                       rowLabel.toLowerCase() === "renewable_share" ? "Renewables" : 
                                       rowLabel.toLowerCase() === "gdp_per_capita" ? "GDP/cap" : rowLabel;
                      return (
                        <div key={rIdx} className="grid gap-1.5" style={{ gridTemplateColumns: `90px repeat(${corrResult.labels.length}, 1fr)` }}>
                          {/* Row Header */}
                          <div 
                            className="h-12 font-bold text-[10px] md:text-xs text-slate-400 flex items-center justify-end pr-2.5 text-right leading-tight"
                            title={rowLabel}
                          >
                            {rowShort}
                          </div>

                          {/* Cells */}
                          {rowVals.map((val, cIdx) => {
                            // Background shading calculation
                            let bgStyle = {};
                            if (val > 0.02) {
                              bgStyle = { backgroundColor: `rgba(16, 185, 129, ${val * 0.85})`, color: "#ffffff" };
                            } else if (val < -0.02) {
                              bgStyle = { backgroundColor: `rgba(239, 68, 68, ${Math.abs(val) * 0.85})`, color: "#ffffff" };
                            } else {
                              bgStyle = { backgroundColor: "rgba(255, 255, 255, 0.03)", color: "rgba(255,255,255,0.4)" };
                            }

                            return (
                              <div
                                key={cIdx}
                                style={bgStyle}
                                className="h-12 border border-glassBorder/15 rounded-lg flex flex-col items-center justify-center text-xs font-black transition-all duration-200 hover:scale-105 hover:z-10 cursor-help shadow-xs"
                                title={`${corrResult.labels[rIdx]} vs ${corrResult.labels[cIdx]}: ${val.toFixed(4)}`}
                              >
                                <span>{val > 0 ? "+" : ""}{val.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Interpretability Guide */}
                <div className="bg-darkBg/20 border border-glassBorder/30 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-neonGreen" /> Energy Transition Decoupling Insights
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-450">
                    <div className="space-y-1">
                      <span className="text-neonGreen font-semibold block">Decoupling Target:</span>
                      <p className="leading-relaxed">
                        In Variable mode, look for negative correlation (\(r &lt; -0.5\)) between <strong>GDP</strong> and <strong>Emissions</strong>. This is the hallmark of structural decoupling, indicating economic expansion is achieved while absolute greenhouse outputs shrink.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neonBlue font-semibold block">Green Intensity:</span>
                      <p className="leading-relaxed">
                        A strong negative correlation between <strong>Renewables</strong> and <strong>Emissions</strong> (\(r &lt; -0.7\)) verifies that renewable capacity additions are actively displacing coal or gas baseloads rather than just serving load growth.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center py-12">No correlation data matches active parameters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
