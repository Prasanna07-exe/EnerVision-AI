import React, { useState, useEffect } from "react";
import { 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer
} from "recharts";
import { ApiService } from "../../services/api";
import type { Country, RiskScores } from "../../services/api";
import { Sparkles, HelpCircle, ShieldAlert, TrendingUp, Zap } from "lucide-react";

export const Risk: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("IND");
  const [scores, setScores] = useState<RiskScores | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
        console.error("Failed to load risk scores:", err);
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
      if (score >= 70) return "text-neonGreen border-neonGreen/30";
      if (score >= 40) return "text-amber-400 border-amber-400/30";
      return "text-neonRed border-neonRed/30";
    } else {
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

  // Strategic Brief Calculations
  const getPolicyBrief = () => {
    if (!scores) return null;
    const { supply_risk, emission_risk, transition_readiness } = scores;

    // 1. Primary threat vector
    const primaryThreat = supply_risk > emission_risk ? "Supply Volatility" : "Emissions Intensity";
    const threatDesc = supply_risk > emission_risk
      ? "Risk is concentrated in grid reliability, backup reserve margins, and fuel import pricing dependencies."
      : "Risk is concentrated in carbon output levels, heavy reliance on thermal coal base loads, and industrial carbon intensity.";

    // 2. Readiness Gap
    const gap = transition_readiness - Math.max(supply_risk, emission_risk);
    let gapStatus = "Adequate Financial Cushion";
    let gapColor = "text-neonGreen border-neonGreen/20 bg-neonGreen/5";
    
    if (gap < -10) {
      gapStatus = "Critical Capital Exposure";
      gapColor = "text-neonRed border-neonRed/20 bg-neonRed/5";
    } else if (gap < 10) {
      gapStatus = "Moderate Financial Strain";
      gapColor = "text-amber-400 border-amber-400/20 bg-amber-400/5";
    }

    // 3. Structured Policy Blueprint
    let blueprint = {
      short: "Secure multilateral climate finance grants and deploy decentralized solar microgrids to stabilize municipal grids.",
      medium: "Construct grid interconnectors with regional neighbors to lower supply volatility risks and manage load peaks.",
      long: "Decommission regional oil generators in favor of integrated solar + battery storage backup assets."
    };

    if (transition_readiness >= 65) {
      blueprint = {
        short: "Expedite capital allocation for utility-scale battery storage and upgrade regional transmission interconnections.",
        medium: "Introduce carbon border adjustments (CBAM) and enforce carbon capture mandates for heavy chemical/steel industries.",
        long: "Mandate complete grid net-zero transition and establish export-oriented clean technology supply chains."
      };
    } else if (transition_readiness >= 40) {
      blueprint = {
        short: "Implement public-private clean capacity auctions and mandate backup battery reserves for major commercial zones.",
        medium: "Enforce electric vehicle charging mandates, develop hydrogen pilot programs, and incentivize residential solar PV grids.",
        long: "Retire legacy baseline thermal coal plants and establish national clean energy generation mandates."
      };
    }

    return {
      threat: primaryThreat,
      threatDesc,
      gap: gapStatus,
      gapColor,
      gapVal: gap.toFixed(0),
      blueprint
    };
  };

  const brief = getPolicyBrief();

  // Dynamic EV & Investment Suitability Calculations
  const getInvestmentDossier = () => {
    if (!scores) return null;
    const { code, transition_readiness, supply_risk } = scores;

    // Calculate grid resilience withstand capacity
    const resilience = Math.max(10, Math.min(95, transition_readiness - (supply_risk * 0.4)));
    let withstandRating = "Low Resiliency";
    let withstandColor = "text-neonRed border-neonRed/20 bg-neonRed/5";
    let withstandDesc = "Fossil-heavy generation mix and import exposure limit immediate grid capacity. Rapid EV charging deployment may require local grid upgrades in high-demand urban clusters.";
    
    if (resilience >= 75) {
      withstandRating = "High Resiliency";
      withstandColor = "text-neonGreen border-neonGreen/20 bg-neonGreen/5";
      withstandDesc = "The grid possesses strong capital buffers and stable capacity margins to absorb rapid EV charging infrastructure demand spikes.";
    } else if (resilience >= 45) {
      withstandRating = "Moderate Resiliency";
      withstandColor = "text-amber-400 border-amber-400/20 bg-amber-400/5";
      withstandDesc = "Grid is capable of basic EV adoption but highly vulnerable to localized congestion at peak hours. Demands smart-charging management and targeted peak-shaving storage.";
    }

    // Suitability Class and expansion logic
    let suitClass = "Class C: Infrastructure Constrained Zone";
    let suitStrategy = "Focus on donor-funded solar microgrid depots, light 2-wheeler charging stations, and battery-as-a-service (BaaS) platforms to avoid overloading thermal baseline generators.";
    
    if (transition_readiness >= 65) {
      suitClass = "Class A: Mature Commercial Deployment Zone";
      suitStrategy = "Ideal for rapid commercial deployment of high-power DC fast-charging networks (150kW+), vehicle-to-grid (V2G) integrations, and capital-intensive corridor projects.";
    } else if (transition_readiness >= 40) {
      suitClass = "Class B: High-Growth Expansion Zone";
      suitStrategy = "High market expansion potential. Prioritize smart public charging hubs, battery swapping stations for fleet fleets, and local solar-tied commercial parking zones.";
    }

    // Recommended deployment developers lookup
    let companies = [
      { name: "Tesla Supercharger / ChargePoint", role: "Primary fast-charging networks" },
      { name: "ABB E-mobility / EVgo", role: "Hardware and fleet depot solutions" },
      { name: "Shell Recharge / Ionity", role: "Highway charging corridor installations" }
    ];

    if (code === "IND") {
      companies = [
        { name: "Tata Power EZ Charge", role: "Strong Recommendation - Dominant public and residential charging grid developer" },
        { name: "Ather Energy Grid", role: "Highly Relevant - Nationwide fast-charging corridors for electric two-wheelers" },
        { name: "Ola Electric Charging Network", role: "Highly Relevant - Rapidly expanding hypercharger network for urban two-wheelers" }
      ];
    } else if (code === "CHN") {
      companies = [
        { name: "State Grid Corporation of China (SGCC)", role: "National high-voltage grid utility and major highway operator" },
        { name: "TGOOD / Star Charge", role: "Largest private destination charging operators" },
        { name: "NIO Power Swapping Stations", role: "Automated robotic battery swapping network infrastructure" }
      ];
    } else if (code === "USA") {
      companies = [
        { name: "Tesla Supercharger Network", role: "Largest proprietary fast-charging grid" },
        { name: "ChargePoint / EVgo", role: "Commercial parking and fleet depot charging integration" },
        { name: "Electrify America", role: "Open-standards DC fast charger networks across interstate corridors" }
      ];
    } else if (transition_readiness < 40) {
      companies = [
        { name: "Engie Energy Access / M-KOPA", role: "Decentralized off-grid mini-solar operators" },
        { name: "Multilateral Development Banks (MDBs)", role: "Concessional capital providers for green grids" },
        { name: "Solarise Africa / Local Cooperatives", role: "Commercial battery swapping and mini-depot developers" }
      ];
    }

    return {
      resilience: resilience.toFixed(0),
      withstandRating,
      withstandColor,
      withstandDesc,
      suitClass,
      suitStrategy,
      companies
    };
  };

  const dossier = getInvestmentDossier();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 0. Enterprise Explainer Header Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-darkBg/60 to-neonBlue/5 border-neonBlue/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              Sovereign Risk Assessments &amp; Vulnerability Audits
            </h2>
            <p className="text-xs text-slate-400">
              Circular vulnerability indicators mapping security threats, emissions speed, and capital readiness.
            </p>
          </div>
        </div>

        {/* Informational Guidance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-glassBorder/40 text-xs">
          <div className="space-y-1">
            <span className="text-neonBlue font-bold block uppercase tracking-wider text-[10px]">🎯 What is it for? (Resembles: Investment Due Diligence)</span>
            <p className="text-slate-455 text-slate-400 leading-relaxed">
              Audits baseline grid security, emissions intensity compliance levels, and financial capacity parameters.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-neonGreen font-bold block uppercase tracking-wider text-[10px]">⚙️ What does it do? (Energy Context)</span>
            <p className="text-slate-455 text-slate-400 leading-relaxed">
              Computes circular vulnerability ratings tracking import dependencies, coal share risks, and GDP investment readiness.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-purple-450 font-bold block uppercase tracking-wider text-[10px] text-purple-400">💼 Business Decisions Supported</span>
            <p className="text-slate-455 text-slate-400 leading-relaxed">
              De-risk capital allocation by choosing matching charging network developers (e.g. Tata Power, Ather, Star Charge) and grid deployment strategies.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Country Selection Header */}
      <div className="glass-panel p-6 flex items-center justify-between flex-wrap gap-4">
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
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-white text-md mb-2 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-neonBlue" /> Risk Footprint
            </h4>
            <span className="text-xs text-slate-400 mb-6">Radar visualization of the risk profile</span>
          </div>
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

      {/* Dynamic Strategic Policy Recommendations Brief */}
      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Diagnostic Card */}
          <div className="glass-panel p-6 space-y-4 border-glassBorder/60 bg-darkBg/20 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sovereign Vulnerability Diagnosis</span>
              <div className="mt-3 space-y-3 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 block font-semibold">Primary Transition Threat Vector</span>
                  <strong className="text-neonRed text-sm flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-neonRed" /> {brief.threat}
                  </strong>
                  <p className="text-[11px] text-slate-400 leading-snug">{brief.threatDesc}</p>
                </div>
                <div className="space-y-1 pt-2 border-t border-glassBorder/20">
                  <span className="text-slate-400 block font-semibold">Readiness-to-Risk Cushion</span>
                  <div className={`px-2 py-1.5 rounded-lg border font-bold text-[11px] text-center mt-1 ${brief.gapColor}`}>
                    {brief.gap} ({brief.gapVal}% spread)
                  </div>
                </div>
              </div>
            </div>
            <span className="text-[9px] text-slate-500 font-bold block pt-4 border-t border-glassBorder/20">
              EnerVision Vulnerability Diagnostics
            </span>
          </div>

          {/* Recommendations Card */}
          <div className="lg:col-span-2 glass-panel p-6 space-y-4 border-glassBorder/60 bg-darkBg/20">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-neonGreen" /> Custom Strategic Action Blueprint
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-4 rounded-xl flex flex-col justify-between">
                <div className="space-y-1">
                  <strong className="text-neonBlue block font-bold uppercase tracking-wider text-[10px]">Short-Term (1-3 yrs)</strong>
                  <p className="text-slate-300 text-[11px] leading-snug">{brief.blueprint.short}</p>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Immediate mitigation</span>
              </div>
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-4 rounded-xl flex flex-col justify-between">
                <div className="space-y-1">
                  <strong className="text-neonGreen block font-bold uppercase tracking-wider text-[10px]">Medium-Term (3-10 yrs)</strong>
                  <p className="text-slate-300 text-[11px] leading-snug">{brief.blueprint.medium}</p>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Infrastructure scale</span>
              </div>
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-4 rounded-xl flex flex-col justify-between">
                <div className="space-y-1">
                  <strong className="text-purple-400 block font-bold uppercase tracking-wider text-[10px]">Long-Term (10+ yrs)</strong>
                  <p className="text-slate-300 text-[11px] leading-snug">{brief.blueprint.long}</p>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Full decarbonization</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic EV & Investment Suitability Dossier */}
      {dossier && (
        <div className="glass-panel p-6 space-y-6 border-glassBorder/60 bg-darkBg/20">
          <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-neonBlue animate-pulse" /> EV &amp; Clean Tech Investment Suitability Dossier
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Grid resilience withstand card */}
            <div className="glass-panel p-5 bg-darkBg/30 border border-glassBorder/40 flex flex-col justify-between">
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Grid Withstand Resilience</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    parseFloat(dossier.resilience) >= 75 ? "text-neonGreen border-neonGreen/30 bg-neonGreen/10" :
                    parseFloat(dossier.resilience) >= 45 ? "text-amber-400 border-amber-400/30 bg-amber-400/10" :
                    "text-neonRed border-neonRed/30 bg-neonRed/10"
                  }`}>
                    {dossier.withstandRating}
                  </span>
                  <strong className="text-white text-sm font-extrabold">{dossier.resilience}% Capacity</strong>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug mt-1.5">{dossier.withstandDesc}</p>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block pt-2 border-t border-glassBorder/20 mt-3">
                Resilience rating based on readiness vs. supply risk
              </span>
            </div>

            {/* Suitability Classification card */}
            <div className="glass-panel p-5 bg-darkBg/30 border border-glassBorder/40 flex flex-col justify-between">
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Investment Zone Class</span>
                <strong className="text-neonBlue text-sm block font-extrabold">{dossier.suitClass}</strong>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5">{dossier.suitStrategy}</p>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block pt-2 border-t border-glassBorder/20 mt-3">
                Strategic strategy recommendations
              </span>
            </div>

            {/* Recommended Developers list */}
            <div className="glass-panel p-5 bg-darkBg/30 border border-glassBorder/40 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-2">Recommended Deployment Developers</span>
                <div className="space-y-2.5">
                  {dossier.companies.map((c, cIdx) => (
                    <div key={cIdx} className="text-xs bg-darkBg/40 border border-glassBorder/20 p-2 rounded-lg leading-snug">
                      <strong className="text-white block font-bold">{c.name}</strong>
                      <span className="text-[10px] text-slate-400">{c.role}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block pt-2 border-t border-glassBorder/20 mt-3">
                Best-fit actors for sovereign grid profile
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
