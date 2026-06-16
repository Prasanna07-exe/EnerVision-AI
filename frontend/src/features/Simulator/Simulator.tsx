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
import { ApiService, Country, SimulationResponse, RiskScores } from "../../services/api";
import { Sliders, Save, RotateCcw, AlertTriangle, ShieldCheck } from "lucide-react";

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
        // Run simulator at 0% change to get baselines
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
    // Reset sliders on country change
    setSolarChange(0);
    setEvChange(0);
    setCoalChange(0);
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

  // Trigger recalculation on slide change (using release trigger or slight debounce, we'll run on slider changes directly)
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
      alert("Scenario configurations saved successfully!");
    } catch (err: any) {
      alert("Failed to save scenario: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Compile Chart data comparing Baseline vs Simulated Emissions
  const getEmissionsChartData = () => {
    if (!baselineData || !simulationData) return [];
    return baselineData.co2_emissions.map((b, i) => ({
      year: b.year,
      baseline: b.value,
      simulated: simulationData.co2_emissions[i]?.value || b.value
    }));
  };

  // Compile Chart data comparing Baseline vs Simulated Grid Load
  const getDemandChartData = () => {
    if (!baselineData || !simulationData) return [];
    return baselineData.electricity_demand.map((b, i) => ({
      year: b.year,
      baseline: b.value,
      simulated: simulationData.electricity_demand[i]?.value || b.value
    }));
  };

  // Compute reactive risk scores for the radar plot based on slider positions
  const getSimulatedRiskData = () => {
    if (!riskScores) return [];
    
    // Solar growth drops emission risk (-0.1 per %) and improves readiness (+0.2 per %)
    // Coal reduction drops emissions risk (-0.4 per %) but can raise supply risk slightly (+0.1 per %)
    // EV growth increases supply risk (+0.15 per %) due to grid load
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

      {/* 1. Country Selector and Action Bar */}
      <div className="glass-panel p-6 flex flex-wrap gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Simulation Target</label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="bg-darkBg border border-glassBorder text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none w-56 font-semibold"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 border border-glassBorder rounded-lg text-sm font-medium text-slate-300 flex items-center gap-2 hover:bg-glassBg/40 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2.5 bg-neonBlue text-darkBg font-bold rounded-lg text-sm flex items-center gap-2 shadow-neon hover:brightness-110 transition-all duration-200"
          >
            <Save className="w-4 h-4" /> Save Scenario
          </button>
        </div>
      </div>

      {/* 2. Workspace Content Grid (Sliders on Left, Charts on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Hand Sliders Panel */}
        <div className="glass-panel p-6 space-y-8 h-fit">
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

        {/* Right Hand Charts Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Emission Impact Chart */}
            <div className="glass-panel p-6">
              <h5 className="font-bold text-white text-sm mb-4">Carbon Emission Projections (MT)</h5>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={emissionsChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <Tooltip 
                      contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="simulated" stroke="#ff416c" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demand Impact Chart */}
            <div className="glass-panel p-6">
              <h5 className="font-bold text-white text-sm mb-4">Electricity Demand Projections (TWh)</h5>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={demandChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '10px' }} />
                    <Tooltip 
                      contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }}
                    />
                    <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="simulated" stroke="#00f2fe" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

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
              <h5 className="font-bold text-white text-sm">⚠️ Transition Feasibility Analysis</h5>
              
              {coalChange < -30 && solarChange < 20 ? (
                <div className="flex gap-3 bg-neonRed/10 border border-neonRed/20 p-4 rounded-lg text-xs text-neonRed">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Fossil Import Baseload Shortage</span>
                    <span>Reducing coal by {Math.abs(coalChange)}% without adding equivalent solar capacity creates a grid reserve margin supply gap. High risk of load shedding.</span>
                  </div>
                </div>
              ) : evChange > 50 && solarChange < 30 ? (
                <div className="flex gap-3 bg-neonRed/10 border border-neonRed/20 p-4 rounded-lg text-xs text-neonRed">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Grid Congestion &amp; Charger Overload</span>
                    <span>High EV growth (+{evChange}%) raises peak load. Renewable generation and battery storage capacity must be expanded to prevent localized blackouts.</span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 bg-neonGreen/10 border border-neonGreen/20 p-4 rounded-lg text-xs text-neonGreen">
                  <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Stable Transition Configuration</span>
                    <span>Policy parameters are well-balanced. Carbon emissions drop without threatening the grid's baseload safety margins.</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
