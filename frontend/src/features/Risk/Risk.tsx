import React, { useState, useEffect } from "react";
import { 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from "recharts";
import { ApiService, Country, RiskScores } from "../../services/api";
import { ShieldCheck, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";

export const Risk: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("IND");
  const [scores, setScores] = useState<RiskScores | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch risk scores on selector change
  useEffect(() => {
    const fetchScores = async () => {
      try {
        setLoading(true);
        const res = await ApiService.getRiskScores(selectedCountry);
        setScores(res);
      } catch (err: any) {
        setError(err.message || "Failed to load risk scores");
      } finally {
        setLoading(false);
      }
    };
    if (selectedCountry) {
      fetchScores();
    }
  }, [selectedCountry]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neonBlue"></div>
        <p className="text-slate-400 text-xs font-medium">Computing vulnerability index gauges...</p>
      </div>
    );
  }

  const getRadarData = () => {
    if (!scores) return [];
    return [
      { subject: 'Supply Risk', score: scores.supply_risk },
      { subject: 'Emissions Risk', score: scores.emission_risk },
      { subject: 'Transition Readiness', score: scores.transition_readiness }
    ];
  };

  const radarData = getRadarData();

  const getRiskColor = (score: number, invert: boolean = false) => {
    if (invert) {
      // For readiness, high is green, low is red
      if (score >= 70) return "text-neonGreen border-neonGreen/30";
      if (score >= 40) return "text-amber-400 border-amber-400/30";
      return "text-neonRed border-neonRed/30";
    } else {
      // For risks, high is red, low is green
      if (score >= 70) return "text-neonRed border-neonRed/30";
      if (score >= 40) return "text-amber-400 border-amber-400/30";
      return "text-neonGreen border-neonGreen/30";
    }
  };

  const getRiskProgressColor = (score: number, invert: boolean = false) => {
    if (invert) {
      if (score >= 70) return "stroke-neonGreen";
      if (score >= 40) return "stroke-amber-400";
      return "stroke-neonRed";
    } else {
      if (score >= 70) return "stroke-neonRed";
      if (score >= 40) return "stroke-amber-400";
      return "stroke-neonGreen";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Country Selection Header */}
      <div className="glass-panel p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Risk Entity</label>
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
        <span className="text-xs text-slate-400 bg-glassBg/40 px-3 py-1.5 rounded-lg border border-glassBorder">
          Latest Assessed Metrics: {scores?.year || "N/A"}
        </span>
      </div>

      {/* 2. Gauges & Radar Plot Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Three circular progress gauges */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Supply Risk Gauge */}
            <div className={`glass-panel p-6 flex flex-col items-center justify-center text-center border ${getRiskColor(scores?.supply_risk || 50)}`}>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">Supply Volatility</span>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="50" className="stroke-darkBg fill-none" strokeWidth="8" />
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="50" 
                    className={`fill-none ${getRiskProgressColor(scores?.supply_risk || 50)}`} 
                    strokeWidth="8" 
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - (scores?.supply_risk || 50) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-2xl font-black text-white">{scores?.supply_risk}%</span>
              </div>
              <span className="text-xs text-slate-400 mt-4 leading-snug">Grid reliability, fuel import dependencies</span>
            </div>

            {/* Emission Risk Gauge */}
            <div className={`glass-panel p-6 flex flex-col items-center justify-center text-center border ${getRiskColor(scores?.emission_risk || 50)}`}>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">Emissions Intensity</span>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="50" className="stroke-darkBg fill-none" strokeWidth="8" />
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="50" 
                    className={`fill-none ${getRiskProgressColor(scores?.emission_risk || 50)}`} 
                    strokeWidth="8" 
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - (scores?.emission_risk || 50) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-2xl font-black text-white">{scores?.emission_risk}%</span>
              </div>
              <span className="text-xs text-slate-400 mt-4 leading-snug">Baseload coal dependency, per-capita emissions</span>
            </div>

            {/* Transition Readiness Gauge */}
            <div className={`glass-panel p-6 flex flex-col items-center justify-center text-center border ${getRiskColor(scores?.transition_readiness || 50, true)}`}>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-4">Transition Readiness</span>
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="50" className="stroke-darkBg fill-none" strokeWidth="8" />
                  <circle 
                    cx="64" 
                    cy="64" 
                    r="50" 
                    className={`fill-none ${getRiskProgressColor(scores?.transition_readiness || 50, true)}`} 
                    strokeWidth="8" 
                    strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={2 * Math.PI * 50 * (1 - (scores?.transition_readiness || 50) / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-2xl font-black text-white">{scores?.transition_readiness}%</span>
              </div>
              <span className="text-xs text-slate-400 mt-4 leading-snug">GDP per capita, clean energy installations speed</span>
            </div>

          </div>

          {/* Detailed Sub-Metrics Explanations */}
          <div className="glass-panel p-6 space-y-4">
            <h4 className="font-bold text-white text-sm border-b border-glassBorder pb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neonBlue" /> Strategic Risk Summary
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supply risk measures the system's reliance on fuel inputs and grid diversity. Concentrated fossil setups create exposure to global pricing volatility. Emissions risk models carbon density, tracking carbon generation share relative to national targets. Transition readiness grades the financial capacity (GDP) and speed of deployment to absorb transition shocks.
            </p>
          </div>
        </div>

        {/* Radar Profile Plot Column */}
        <div className="glass-panel p-6 flex flex-col">
          <h4 className="font-bold text-white text-md mb-2 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-neonBlue" /> Risk Footprint
          </h4>
          <span className="text-xs text-slate-400 mb-6">Radar visualization of the risk profile</span>
          <div className="h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis dataKey="subject" stroke="#475569" style={{ fontSize: '10px' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" style={{ fontSize: '8px' }} />
                <Radar 
                  name="Metrics" 
                  dataKey="score" 
                  stroke="#00f2fe" 
                  fill="#00f2fe" 
                  fillOpacity={0.4} 
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
