import React, { useState, useEffect, useCallback } from "react";
import { 
  ComposedChart,
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { ApiService } from "../../services/api";
import type { Country, SimulationResponse, RiskScores } from "../../services/api";
import { Sliders, Save, RotateCcw, AlertTriangle, Activity } from "lucide-react";

const OVERLAY_COLORS = ["#a855f7", "#eab308", "#ec4899", "#3b82f6", "#10b981"];

export const Simulator: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("IND");
  
  // Slider states (percentage shifts)
  const [solarChange, setSolarChange] = useState<number>(0);
  const [evChange, setEvChange] = useState<number>(0);
  const [coalChange, setCoalChange] = useState<number>(0);

  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [baselineData, setBaselineData] = useState<SimulationResponse | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScores | null>(null);

  const [scenarioName, setScenarioName] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState<boolean>(false);

  // Scenario Comparison Overlays
  const [overlayScenarios, setOverlayScenarios] = useState<Record<number, boolean>>({});
  const [overlayData, setOverlayData] = useState<Record<number, SimulationResponse>>({});

  // Load saved scenarios
  const loadSavedScenarios = useCallback(async () => {
    try {
      setLoadingScenarios(true);
      const list = await ApiService.getSavedScenarios();
      setSavedScenarios(list);
    } catch (err: any) {
      console.error("Failed to load saved scenarios:", err);
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    loadSavedScenarios();
  }, [loadSavedScenarios]);

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

  // Fetch baseline forecasts and risk scores for baseline reference
  useEffect(() => {
    const loadBaselines = async () => {
      if (!selectedCountry) return;
      try {
        const [baseRes, riskRes] = await Promise.all([
          ApiService.simulate(selectedCountry, 0, 0, 0),
          ApiService.getRiskScores(selectedCountry)
        ]);
        setBaselineData(baseRes);
        setSimulationData(baseRes);
        setRiskScores(riskRes);
      } catch (err: any) {
        console.error("Failed to load baseline metrics:", err);
      }
    };
    loadBaselines();
    setSolarChange(0);
    setEvChange(0);
    setCoalChange(0);
    setOverlayScenarios({});
    setOverlayData({});
  }, [selectedCountry]);

  // Recalculate simulation data dynamically when sliders change
  const handleSimulationRun = useCallback(async () => {
    if (!selectedCountry) return;
    try {
      const simRes = await ApiService.simulate(selectedCountry, solarChange, evChange, coalChange);
      setSimulationData(simRes);
    } catch (err: any) {
      console.error("Simulation run failed:", err);
    }
  }, [selectedCountry, solarChange, evChange, coalChange]);

  useEffect(() => {
    handleSimulationRun();
  }, [solarChange, evChange, coalChange, handleSimulationRun]);

  const handleReset = () => {
    setSolarChange(0);
    setEvChange(0);
    setCoalChange(0);
  };

  const handleSaveScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioName.trim()) return;
    try {
      setSaving(true);
      await ApiService.saveScenario(scenarioName, solarChange, evChange, coalChange);
      setShowSaveModal(false);
      setScenarioName("");
      loadSavedScenarios();
      alert("Scenario configurations saved successfully!");
    } catch (err: any) {
      alert("Failed to save scenario: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadScenario = (s: any) => {
    setSolarChange(s.solar_change);
    setEvChange(s.ev_change);
    setCoalChange(s.coal_change);
  };

  const handleToggleOverlay = async (scenario: any) => {
    const sId = scenario.id;
    const isCurrentlyChecked = !!overlayScenarios[sId];
    
    setOverlayScenarios(prev => ({ ...prev, [sId]: !isCurrentlyChecked }));

    if (!isCurrentlyChecked) {
      if (!overlayData[sId]) {
        try {
          const resSim = await ApiService.simulate(selectedCountry, scenario.solar_change, scenario.ev_change, scenario.coal_change);
          setOverlayData(prev => ({ ...prev, [sId]: resSim }));
        } catch (err) {
          console.error("Failed to fetch overlay simulation data:", err);
        }
      }
    }
  };

  // Compile Chart data comparing Baseline vs Simulated Emissions
  const getEmissionsChartData = () => {
    if (!baselineData || !simulationData) return [];
    return baselineData.co2_emissions.map((b, i) => {
      const pt: any = {
        year: b.year,
        baseline: b.value,
        simulated: simulationData.co2_emissions[i]?.value || b.value
      };
      savedScenarios.forEach(s => {
        if (overlayScenarios[s.id] && overlayData[s.id]) {
          pt[`scenario_${s.id}`] = overlayData[s.id].co2_emissions[i]?.value || b.value;
        }
      });
      return pt;
    });
  };

  // Compile Chart data comparing Baseline vs Simulated Grid Load
  const getDemandChartData = () => {
    if (!baselineData || !simulationData) return [];
    return baselineData.electricity_demand.map((b, i) => {
      const pt: any = {
        year: b.year,
        baseline: b.value,
        simulated: simulationData.electricity_demand[i]?.value || b.value
      };
      savedScenarios.forEach(s => {
        if (overlayScenarios[s.id] && overlayData[s.id]) {
          pt[`scenario_${s.id}`] = overlayData[s.id].electricity_demand[i]?.value || b.value;
        }
      });
      return pt;
    });
  };

  // Compute reactive risk scores for the radar plot based on slider positions
  const getSimulatedRiskData = () => {
    if (!riskScores) return [];
    
    const simulatedSupply = Math.max(10, Math.min(95, riskScores.supply_risk + (evChange * 0.15) - (coalChange * 0.1)));
    const simulatedEmission = Math.max(10, Math.min(95, riskScores.emission_risk + (coalChange * 0.4) - (solarChange * 0.1)));
    const simulatedReadiness = Math.max(15, Math.min(95, riskScores.transition_readiness + (solarChange * 0.2)));

    return [
      { subject: 'Supply Risk', baseline: riskScores.supply_risk, simulated: simulatedSupply },
      { subject: 'Emissions Risk', baseline: riskScores.emission_risk, simulated: simulatedEmission },
      { subject: 'Transition Readiness', baseline: riskScores.transition_readiness, simulated: simulatedReadiness }
    ];
  };

  const emissionsChartData = getEmissionsChartData();
  const demandChartData = getDemandChartData();
  const radarData = getSimulatedRiskData();

  // Dynamic scorecard ratings
  const getScorecardMetrics = () => {
    if (!baselineData || !simulationData) return null;
    const baseEmissions = baselineData.co2_emissions;
    const simEmissions = simulationData.co2_emissions;
    const baseDemand = baselineData.electricity_demand;
    const simDemand = simulationData.electricity_demand;

    if (baseEmissions.length === 0 || simEmissions.length === 0) return null;

    const baseEndVal = baseEmissions[baseEmissions.length - 1].value;
    const simEndVal = simEmissions[simEmissions.length - 1].value;

    const reductionPct = ((baseEndVal - simEndVal) / (baseEndVal || 1.0)) * 100;

    let climateGrade = "D";
    let climateColor = "text-amber-400";
    if (reductionPct >= 40) {
      climateGrade = "A";
      climateColor = "text-neonGreen";
    } else if (reductionPct >= 20) {
      climateGrade = "B";
      climateColor = "text-[#00f2fe]";
    } else if (reductionPct >= 5) {
      climateGrade = "C";
      climateColor = "text-neonBlue";
    } else if (reductionPct >= 0) {
      climateGrade = "D";
      climateColor = "text-amber-400";
    } else {
      climateGrade = "F";
      climateColor = "text-neonRed";
    }

    let baseloadStatus = "Stable Margin";
    let baseloadColor = "text-neonGreen bg-neonGreen/10 border-neonGreen/20";
    let baseloadDesc = "Policy parameters are well-balanced. Carbon emissions drop without threatening the grid's baseload safety margins.";
    
    if (coalChange < -30 && solarChange < 20) {
      baseloadStatus = "Baseload Deficit";
      baseloadColor = "text-neonRed bg-neonRed/10 border-neonRed/20";
      baseloadDesc = `Reducing coal by ${Math.abs(coalChange)}% without adding equivalent solar capacity creates a grid reserve margin supply gap. High risk of load shedding.`;
    } else if (evChange > 50 && solarChange < 30) {
      baseloadStatus = "Congestion Hazard";
      baseloadColor = "text-neonRed bg-neonRed/10 border-neonRed/20";
      baseloadDesc = `High EV growth (+${evChange}%) raises peak load. Renewable generation and battery storage capacity must be expanded to prevent localized blackouts.`;
    } else if (coalChange < -15 || evChange > 30) {
      baseloadStatus = "Tight Margin";
      baseloadColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
      baseloadDesc = "Moderate capacity stress. Reserve margins are tight. Consider scheduling additional storage grid connection buffers.";
    }

    let capexIndex = "Low";
    let capexColor = "text-neonGreen";
    if (solarChange > 120) {
      capexIndex = "Aggressive";
      capexColor = "text-neonRed";
    } else if (solarChange > 40) {
      capexIndex = "Moderate";
      capexColor = "text-amber-450 text-amber-400";
    }

    return {
      reduction: reductionPct,
      grade: climateGrade,
      gradeColor: climateColor,
      baseload: baseloadStatus,
      baseloadColor,
      baseloadDesc,
      capex: capexIndex,
      capexColor,
      baseEmissionsEnd: baseEndVal,
      simEmissionsEnd: simEndVal,
      baseDemandEnd: baseDemand[baseDemand.length - 1].value,
      simDemandEnd: simDemand[simDemand.length - 1].value
    };
  };

  const scorecard = getScorecardMetrics();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Save Scenario Dialog Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveScenario} className="glass-panel p-6 max-w-md w-full space-y-4 border-neonBlue/30">
            <h3 className="font-bold text-lg text-white">Save Current Policy Scenario</h3>
            <p className="text-xs text-slate-400">Save this configuration to the database for later comparisons.</p>
            <input
              type="text"
              required
              placeholder="e.g., Green Grid 2030 Accelerator"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-darkBg border border-glassBorder rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-neonBlue"
            />
            <div className="flex gap-4 justify-end text-sm">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-glassBorder rounded-lg text-slate-400 hover:bg-glassBg/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-neonBlue text-darkBg font-semibold rounded-lg flex items-center gap-2"
              >
                {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Configuration</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 0. Enterprise Explainer Header Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-darkBg/60 to-neonBlue/5 border-neonBlue/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
            <Sliders className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              Scenario Simulation Sandbox (Policy Sandbox)
            </h2>
            <p className="text-xs text-slate-400">
              Stress-test energy grids by simulating solar buildout, EV sales adoption, and coal decommissioning rates.
            </p>
          </div>
        </div>

        {/* Informational Guidance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-glassBorder/40 text-xs">
          <div className="space-y-1">
            <span className="text-neonBlue font-bold block uppercase tracking-wider text-[10px]">🎯 What is it for? (Resembles: The Stress-Test Sandbox)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Stress-tests grid reliability and carbon goals under hypothetical solar capacity, EV adoption, and coal retirements.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-neonGreen font-bold block uppercase tracking-wider text-[10px]">⚙️ What does it do? (Energy Context)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Models simulated grid demand spikes and emissions curves dynamically using country-specific elasticity coefficients.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-purple-450 font-bold block uppercase tracking-wider text-[10px] text-purple-400">💼 Business Decisions Supported</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Determine grid battery storage sizing requirements and optimize coal plant decommissioning timelines.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Country Selector and Action Bar */}
      <div className="glass-panel p-6 flex flex-col md:flex-row gap-6 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Simulation Target</label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none w-full sm:w-56 font-semibold"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <button
            onClick={handleReset}
            className="flex-1 md:flex-none px-4 py-2.5 border border-glassBorder rounded-lg text-sm font-medium text-slate-300 flex items-center justify-center gap-2 hover:bg-glassBg/40 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" /> Reset Sliders
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-neonBlue text-darkBg font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-neon hover:brightness-110 transition-all duration-200"
          >
            <Save className="w-4 h-4" /> Save Scenario
          </button>
        </div>
      </div>

      {/* 2. Workspace Content Grid (Sliders on Left, Charts on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Hand Column (Sliders & Saved Scenarios) */}
        <div className="space-y-6 h-fit">
          {/* Sliders Card */}
          <div className="glass-panel p-6 space-y-8">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-neonBlue" /> Policy Sliders
            </h4>

            {/* Slider 1: Solar Capacity */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-medium">Solar Capacity</span>
                <span className="font-bold text-neonBlue">
                  {solarChange >= 0 ? `+${solarChange}` : solarChange}%
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="200"
                value={solarChange}
                onChange={(e) => setSolarChange(Number(e.target.value))}
                className="w-full accent-neonBlue h-1 bg-darkBg rounded-lg cursor-pointer"
              />
              <span className="text-xs text-slate-500 block">Accelerates renewable share, offsets emissions.</span>
            </div>

            {/* Slider 2: EV Adoption */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-medium">EV Adoption</span>
                <span className="font-bold text-neonBlue">
                  {evChange >= 0 ? `+${evChange}` : evChange}%
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="200"
                value={evChange}
                onChange={(e) => setEvChange(Number(e.target.value))}
                className="w-full accent-neonBlue h-1 bg-darkBg rounded-lg cursor-pointer"
              />
              <span className="text-xs text-slate-500 block">Increases total grid demand.</span>
            </div>

            {/* Slider 3: Coal Usage */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 font-medium">Coal Generation</span>
                <span className="font-bold text-neonBlue">
                  {coalChange >= 0 ? `+${coalChange}` : coalChange}%
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={coalChange}
                onChange={(e) => setCoalChange(Number(e.target.value))}
                className="w-full accent-neonBlue h-1 bg-darkBg rounded-lg cursor-pointer"
              />
              <span className="text-xs text-slate-500 block">Reduces emission levels but raises supply risk.</span>
            </div>
          </div>

          {/* Saved Configurations Card */}
          <div className="glass-panel p-6 space-y-4">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-neonGreen" /> Saved Configurations
            </h4>
            {loadingScenarios ? (
              <p className="text-xs text-slate-500">Loading configurations...</p>
            ) : savedScenarios.length === 0 ? (
              <p className="text-xs text-slate-500">No saved configurations found.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {savedScenarios.map((s) => (
                  <div key={s.id} className="border border-glassBorder/40 bg-darkBg/20 rounded-lg p-3 space-y-2 hover:border-neonGreen/30 transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs text-white block truncate max-w-[120px]">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!overlayScenarios[s.id]}
                            onChange={() => handleToggleOverlay(s)}
                            className="accent-neonBlue rounded border-glassBorder bg-darkBg"
                          />
                          Compare
                        </label>
                        <button
                          onClick={() => handleLoadScenario(s)}
                          className="text-[10px] bg-neonGreen/10 border border-neonGreen/20 hover:bg-neonGreen/20 text-neonGreen px-2 py-0.5 rounded transition-all duration-150 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span>☀️ Solar: <strong className="text-neonBlue">{s.solar_change >= 0 ? `+${s.solar_change}` : s.solar_change}%</strong></span>
                      <span>🚗 EV: <strong className="text-neonBlue">{s.ev_change >= 0 ? `+${s.ev_change}` : s.ev_change}%</strong></span>
                      <span>🔥 Coal: <strong className="text-neonBlue">{s.coal_change >= 0 ? `+${s.coal_change}` : s.coal_change}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Hand Charts & Scorecard Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Emission Impact Chart */}
            <div className="glass-panel p-6">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-bold text-white text-sm">Carbon Emission Projections (MT)</h5>
                <span className="text-[10px] text-neonRed font-semibold">CO2 Output Impact</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={emissionsChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <Tooltip 
                      contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="simulated" stroke="#ff416c" strokeWidth={2.5} dot={false} />
                    {savedScenarios.map((s, idx) => {
                      if (overlayScenarios[s.id]) {
                        return (
                          <Line
                            key={s.id}
                            type="monotone"
                            dataKey={`scenario_${s.id}`}
                            stroke={OVERLAY_COLORS[idx % OVERLAY_COLORS.length]}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            name={s.name}
                          />
                        );
                      }
                      return null;
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demand Impact Chart */}
            <div className="glass-panel p-6">
              <div className="flex justify-between items-center mb-4">
                <h5 className="font-bold text-white text-sm">Electricity Demand Projections (TWh)</h5>
                <span className="text-[10px] text-neonBlue font-semibold">Grid Load Impact</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={demandChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <Tooltip 
                      contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="simulated" stroke="#00f2fe" strokeWidth={2.5} dot={false} />
                    {savedScenarios.map((s, idx) => {
                      if (overlayScenarios[s.id]) {
                        return (
                          <Line
                            key={s.id}
                            type="monotone"
                            dataKey={`scenario_${s.id}`}
                            stroke={OVERLAY_COLORS[idx % OVERLAY_COLORS.length]}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            name={s.name}
                          />
                        );
                      }
                      return null;
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Interactive Scorecard Grid */}
          {scorecard && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Climate alignment */}
              <div className="glass-panel p-4 flex flex-col justify-between border-glassBorder/60 bg-darkBg/20 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Climate Alignment</span>
                <div className="my-2">
                  <div className={`text-4xl font-black ${scorecard.gradeColor} tracking-tight`}>{scorecard.grade}</div>
                  <span className="text-[10px] text-slate-450 block text-slate-400 mt-1">
                    {scorecard.reduction >= 0 
                      ? `${scorecard.reduction.toFixed(1)}% emissions reduction`
                      : `${Math.abs(scorecard.reduction).toFixed(1)}% emissions increase`
                    }
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold leading-tight">Calculated vs baseline 2045 emissions</span>
              </div>

              {/* Grid margin safety */}
              <div className="glass-panel p-4 flex flex-col justify-between border-glassBorder/60 bg-darkBg/20 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Baseload Margin Safety</span>
                <div className="my-2 flex flex-col items-center">
                  <div className="px-2.5 py-1 rounded-md text-xs font-bold w-fit bg-glassBg border border-glassBorder/60 text-slate-200">
                    {scorecard.baseload}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1.5 leading-snug">
                    Solar +{solarChange}% vs EV +{evChange}%
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold leading-tight">Supply risk limits and reserve margins</span>
              </div>

              {/* Capital intensity index */}
              <div className="glass-panel p-4 flex flex-col justify-between border-glassBorder/60 bg-darkBg/20 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Capital Expenditure (CapEx)</span>
                <div className="my-2">
                  <div className={`text-xl font-extrabold ${scorecard.capexColor}`}>{scorecard.capex}</div>
                  <span className="text-[10px] text-slate-400 block mt-1">Relative grid deployment cost</span>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold leading-tight">Based on solar expansion margins</span>
              </div>
            </div>
          )}

          {/* Risk Shift Radar Chart and Feasibility Warning */}
          <div className="glass-panel p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <h5 className="font-bold text-white text-sm mb-1">Simulated Risk &amp; Readiness Shifts</h5>
              <span className="text-xs text-slate-500 mb-4 block">Visualizing how your slider configuration shifts overall scores</span>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="subject" stroke="#475569" style={{ fontSize: '10px' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" style={{ fontSize: '8px' }} />
                    <Radar name="Baseline" dataKey="baseline" stroke="#64748b" fill="#64748b" fillOpacity={0.3} />
                    <Radar name="Simulated" dataKey="simulated" stroke="#39ff14" fill="#39ff14" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Qualitative Alerts Box */}
            <div className="space-y-4">
              <h5 className="font-bold text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-neonBlue" /> Policy Strategic Narrative
              </h5>
              
              {scorecard && (
                <div className={`p-4 rounded-lg text-xs border ${scorecard.baseloadColor} leading-relaxed`}>
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <span className="font-bold block uppercase tracking-wider text-[10px] mb-1">Grid Security Alert</span>
                      <span>{scorecard.baseloadDesc}</span>
                    </div>
                  </div>
                </div>
              )}

              {scorecard && (
                <p className="text-[11px] text-slate-400 leading-relaxed bg-darkBg/10 border border-glassBorder/30 p-3 rounded-lg">
                  By shifting Solar capacity by <strong className="text-white">{solarChange >= 0 ? `+${solarChange}` : solarChange}%</strong> and EV sales by <strong className="text-white">{evChange >= 0 ? `+${evChange}` : evChange}%</strong>, the grid emissions by 2045 are projected to shift from <strong className="text-white">{scorecard.baseEmissionsEnd.toFixed(1)} MT</strong> to <strong className="text-neonGreen">{scorecard.simEmissionsEnd.toFixed(1)} MT</strong>, representing a <span className="font-bold text-neonBlue">{scorecard.reduction.toFixed(1)}%</span> difference.
                </p>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
