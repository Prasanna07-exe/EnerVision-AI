import React, { useState } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Sliders, 
  Layers, 
  ShieldAlert, 
  MessageSquare, 
  ArrowRight, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Globe,
  Coins,
  GraduationCap,
  Info
} from "lucide-react";

interface IntroductionProps {
  setActiveTab: (tab: string) => void;
}

export const Introduction: React.FC<IntroductionProps> = ({ setActiveTab }) => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeRole, setActiveRole] = useState<number>(0);
  
  // Interactive top-level guide toggle
  const [guideSection, setGuideSection] = useState<"concept" | "audience" | "comparison">("concept");

  const steps = [
    {
      id: "overview",
      title: "1. Global Baseline (Overview)",
      desc: "Analyze the current state of global grids, fuel generation mixes, and sovereign hotspots.",
      icon: BarChart3,
      color: "text-neonBlue bg-neonBlue/10 border-neonBlue/20",
      for: "Establish a historical and current global benchmark of fuel mixes and carbon outputs.",
      does: "Aggregates global generation records (TWh), emissions (MT CO2), and renewable shares, highlighting major spotlight countries (USA, China, India).",
      observe: [
        "How solar, wind, and hydro generation have grown relative to coal and gas since 1990.",
        "The overall carbon intensity footprint of major grid systems.",
        "The latest baseline KPIs representing global electricity progress."
      ],
      model: "Statistical Baseline Aggregations"
    },
    {
      id: "forecast",
      title: "2. Long-term Forecasts (Predictive Forecasts)",
      desc: "Inspect decadal projection curves (2025–2045) with 95% uncertainty bands, and audit drivers via SHAP.",
      icon: TrendingUp,
      color: "text-neonGreen bg-neonGreen/10 border-neonGreen/20",
      for: "Map future sovereign grid trajectories and identify drivers pushing forecasts up or down.",
      does: "Uses deep learning PyTorch LSTMs, Prophet, and XGBoost models to project demand and emissions through 2045, calculating 95% uncertainty bands and game-theoretic SHAP attributions.",
      observe: [
        "The decadal growth envelope and 95% confidence limits of future electricity demands.",
        "Whether a nation is heading toward an emissions peak or structural decline.",
        "Which features (like GDP growth or EV sales) are the primary force drivers behind the forecast model's choices."
      ],
      model: "PyTorch LSTM + XGBoost SHAP"
    },
    {
      id: "simulator",
      title: "3. Policy Sandbox (Scenario Simulator)",
      desc: "Stress-test grids by simulating EV growth, solar capacity, and coal retirements using dynamic local elasticities.",
      icon: Sliders,
      color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
      for: "Stress-test policy adjustments and quantify their impacts on grid reliability and carbon goals.",
      does: "Calculates simulated emissions and demand profiles on-the-fly based on slider shifts, utilizing country-specific elasticity coefficients.",
      observe: [
        "Grid feasibility scorecards showing Climate Alignment grades and Baseload Margin safety.",
        "Grid supply vulnerabilities arising when coal is retired faster than clean capacity is installed.",
        "The peak grid demand shifts driven by aggressive EV adoption."
      ],
      model: "Country-Specific Elasticity Engine"
    },
    {
      id: "clustering",
      title: "4. Temporal Clustering (Regional Clustering)",
      desc: "Play KMeans animations from 1990 to 2045 to track how countries migrate from fossil baselines to transition leaders.",
      icon: Layers,
      color: "text-cyanAccent bg-cyanAccent/10 border-cyanAccent/20",
      for: "Segment global economies into categories to study transition patterns and migrations.",
      does: "Executes a global KMeans algorithm across historical and forecasted years to segment countries into 3 distinct energy clusters.",
      observe: [
        "Sovereign migrations where countries transition from fossil-dependent baselines into transition leaders.",
        "The changing distribution of clusters over time, indicating global decarbonization speed.",
        "The relationship between a country's wealth (GDP per capita) and its clean energy penetration rate."
      ],
      model: "Unified KMeans Temporal Clustering"
    },
    {
      id: "risk",
      title: "5. Vulnerability Audits (Risk Assessments)",
      desc: "Review circular risk gauges (supply volatility and emissions intensity) and readiness footprints.",
      icon: ShieldAlert,
      color: "text-neonRed bg-neonRed/10 border-neonRed/20",
      for: "Identify national grid vulnerabilities and compile customized mitigation portfolios.",
      does: "Evaluates import dependency, emissions trajectories, and GDP capital readiness to score supply, emissions, and readiness indicators.",
      observe: [
        "A country's primary transition threat vector (Supply Volatility vs. Emissions Intensity).",
        "The readiness gap representing whether a nation possesses the capital to absorb transition costs.",
        "Custom, three-tiered policy action briefs outlining short, medium, and long-term targets."
      ],
      model: "Sovereign Vulnerability Indices"
    },
    {
      id: "copilot",
      title: "6. Strategic Briefing (AI Copilot)",
      desc: "Converse with a RAG transition analyst, visualize metrics inline, and download professional PDF briefs.",
      icon: MessageSquare,
      color: "text-neonBlue bg-neonBlue/10 border-neonBlue/20",
      for: "Perform natural language grid audits and generate publication-quality PDF dossiers.",
      does: "Connects an AI Copilot to database context, enabling natural language questions, inline metric visualization, and compiled ReportLab PDF brief downloads.",
      observe: [
        "Detailed answers to complex qualitative and quantitative policy questions.",
        "AI-injected charts visualizing queried database statistics dynamically.",
        "Generated, comprehensive PDF briefing reports highlighting national grid assets and recommendations."
      ],
      model: "Database RAG + LLM Orchestrator"
    }
  ];

  const roles = [
    {
      title: "Grid Operations & Planners",
      icon: Zap,
      why: "Safeguard grid stability during the transition from thermal base loads to clean energy systems.",
      questions: [
        "Will aggressive electric vehicle (EV) growth cause grid load shedding by 2030?",
        "How much solar headroom exists before battery storage is required?"
      ],
      gain: [
        "Baseload safety margins (TWh) calculated against simulated load spikes.",
        "Worst-case demand peak indicators under a 95% Bayesian credible envelope.",
        "Country-specific elasticity parameters showing demand response thresholds."
      ],
      color: "text-neonBlue bg-neonBlue/10 border-neonBlue/20"
    },
    {
      title: "Climate Policy Officers",
      icon: Globe,
      why: "Enforce carbon reduction commitments with concrete, data-backed grid infrastructure benchmarks.",
      questions: [
        "Are renewable installation rates outrunning macro industrial demand growth?",
        "When is the sovereign nation projected to reach peak greenhouse gas emissions?"
      ],
      gain: [
        "Decadal greenhouse gas emissions pathways (MT CO2) from 2025 to 2045.",
        "Transition velocity scorecards showing clean energy displacement rates.",
        "Target alignment ratings indicating compliance against international climate protocols."
      ],
      color: "text-neonGreen bg-neonGreen/10 border-neonGreen/20"
    },
    {
      title: "Infrastructure Financiers",
      icon: Coins,
      why: "De-risk capital allocation and optimize green fund deployment across developmental profiles.",
      questions: [
        "Which regional markets possess the GDP buffers to absorb clean technology capital expenditure?",
        "Which grid systems present high import dependency risks?"
      ],
      gain: [
        "Circular sovereign vulnerability ratings tracking import volatility risk.",
        "Dynamic CapEx intensity metrics scaling with solar and battery targets.",
        "Comparative country indicators benchmarking clean energy cost curves."
      ],
      color: "text-purple-400 bg-purple-400/10 border-purple-400/20"
    },
    {
      title: "Academic & ML Researchers",
      icon: GraduationCap,
      why: "Audit, verify, and extend transition patterns with mathematically rigorous frameworks.",
      questions: [
        "What features have the highest attribution weight for future demand trends?",
        "How do sovereign grids cluster and migrate over multi-decade timelines?"
      ],
      gain: [
        "Game-theoretic SHAP feature attributions explaining model choices.",
        "Unified temporal KMeans coordinates preventing label swaps across history and forecasts.",
        "Auto-ensemble cross-validation MAPE comparisons proving forecast accuracy."
      ],
      color: "text-cyanAccent bg-cyanAccent/10 border-cyanAccent/20"
    }
  ];

  const handleNextStep = () => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  };

  const handlePrevStep = () => {
    setActiveStep((prev) => (prev - 1 + steps.length) % steps.length);
  };

  const currentStep = steps[activeStep];
  const StepIcon = currentStep.icon;

  return (
    <div className="space-y-10 animate-fade-in pb-12">
      {/* 1. Hero Splash Banner */}
      <div className="glass-panel p-8 bg-gradient-to-r from-darkBg/60 via-neonBlue/5 to-neonGreen/5 border-neonBlue/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neonBlue/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-neonGreen/5 rounded-full blur-3xl -z-10" />
        
        <div className="max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neonBlue/10 border border-neonBlue/20 text-neonBlue text-[10px] font-bold uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 animate-pulse" /> Enterprise sovereign analytics
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Predicting and Navigating the <span className="bg-clip-text text-transparent bg-gradient-to-r from-neonBlue via-cyanAccent to-neonGreen">Clean Energy Transition</span>
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Welcome to <strong className="text-white">EnerVision AI</strong> — a standalone transition intelligence and decision-support portal. Designed for national planners, academic researchers, and energy analysts, the platform integrates recurrent neural networks, Bayesian uncertainty quantification, and explainable AI to map sovereign decarbonization pathways.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={() => setActiveTab("overview")}
              className="bg-neonBlue hover:brightness-110 text-darkBg font-extrabold px-6 py-3 rounded-xl flex items-center gap-2 shadow-neon transition-all duration-200"
            >
              Enter Portal <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab("copilot")}
              className="bg-glassBg hover:bg-glassBg/60 text-slate-200 border border-glassBorder px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200"
            >
              Consult AI Copilot
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Guide Section Toggle Switcher (Creative UI) */}
      <div className="space-y-6">
        <div className="flex justify-center border-b border-glassBorder/40 pb-2">
          <div className="flex bg-darkBg/60 border border-glassBorder/60 p-1.5 rounded-xl gap-2">
            <button
              onClick={() => setGuideSection("concept")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                guideSection === "concept" 
                  ? "bg-neonBlue/15 text-neonBlue border border-neonBlue/30 shadow-neon" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🛩️ Platform Concept
            </button>
            <button
              onClick={() => setGuideSection("audience")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                guideSection === "audience" 
                  ? "bg-neonBlue/15 text-neonBlue border border-neonBlue/30 shadow-neon" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              👥 Who Is It For?
            </button>
            <button
              onClick={() => setGuideSection("comparison")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                guideSection === "comparison" 
                  ? "bg-neonBlue/15 text-neonBlue border border-neonBlue/30 shadow-neon" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📊 Existing vs. Ours
            </button>
          </div>
        </div>

        {/* Dynamic Guides display */}
        {guideSection === "concept" && (
          <div className="space-y-8 animate-fade-in">
            {/* Analogy & Core Problem/Solution cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Problem Statement */}
              <div className="glass-panel p-6 border-l-4 border-neonRed/60 bg-gradient-to-r from-darkBg/60 to-neonRed/5 space-y-3">
                <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-neonRed" /> The Grid Problem
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Decarbonizing energy grids requires balancing the complex <strong className="text-white font-semibold">Energy Trilemma</strong>: sustainability (mitigating greenhouse gases), security (ensuring grid baseload margin safety), and affordability (managing capital investments). 
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Making policy decisions (e.g., decommissioning coal, adopting EVs) triggers highly non-linear, unpredictable grid feedbacks. Policy planners lack predictive, uncertainty-aware, and explainable models, risking localized blackouts or emissions target failures.
                </p>
              </div>

              {/* The Solution */}
              <div className="glass-panel p-6 border-l-4 border-neonGreen/60 bg-gradient-to-r from-darkBg/60 to-neonGreen/5 space-y-3">
                <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-neonGreen" /> The Grid Flight Simulator
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">EnerVision AI</strong> acts as a <strong className="text-white">Flight Simulator for electricity grids</strong>. Planners can test energy policies, EV adoption volumes, and grid investments in a safe, simulated playground before executing them in the real world.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  By coupling deep-learning PyTorch LSTMs, Monte Carlo Bayesian Dropout, and cooperative SHAP explanations with local scenario elasticities, the platform renders transparent, risk-aware trajectories.
                </p>
              </div>
            </div>

            {/* What resembles what table/list */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-glassBorder pb-3">
                <Info className="w-4 h-4 text-neonBlue" /> What Resembles What in Real Life?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs text-slate-400">
                <div className="space-y-1.5 p-3 rounded-lg bg-darkBg/30 border border-glassBorder/20">
                  <span className="font-bold text-neonBlue block">📊 Overview</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">The Dashboard</span>
                  <p className="text-[11px] leading-relaxed">Checks current grid health, active generation fuel mixes, and carbon baselines.</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-darkBg/30 border border-glassBorder/20">
                  <span className="font-bold text-neonGreen block">📈 Forecasts</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">The Weather Map</span>
                  <p className="text-[11px] leading-relaxed">Predicts future load demand surges and emissions peaks using deep neural networks.</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-darkBg/30 border border-glassBorder/20">
                  <span className="font-bold text-purple-400 block">🎛️ Simulator</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">The Stress-Test Sandbox</span>
                  <p className="text-[11px] leading-relaxed">Drags EV, solar, and coal dials to stress-test capacity limits and check for blackout margins.</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-darkBg/30 border border-glassBorder/20">
                  <span className="font-bold text-cyanAccent block">👥 Clustering</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Peer Benchmarking</span>
                  <p className="text-[11px] leading-relaxed">Segments economies and tracks developmental migrations to copy clean energy peer success paths.</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-darkBg/30 border border-glassBorder/20">
                  <span className="font-bold text-neonRed block">🛡️ Risk Audits</span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Due Diligence Brief</span>
                  <p className="text-[11px] leading-relaxed">Audits grid resilience and recommends suited commercial developers (Tesla, Tata Power, NIO).</p>
                </div>
              </div>
            </div>

            {/* What, How, What For checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-5 rounded-xl flex flex-col justify-between">
                <div className="space-y-1.5">
                  <strong className="text-neonBlue block font-bold uppercase tracking-wider text-[10px]">🔎 What You Understand</strong>
                  <ul className="list-disc list-inside space-y-1 text-slate-350 text-slate-300">
                    <li>Emissions peak and decline years.</li>
                    <li>Worst-case grid demand margins.</li>
                    <li>Sovereign vulnerability risk vectors.</li>
                  </ul>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Insights unlocked</span>
              </div>
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-5 rounded-xl flex flex-col justify-between">
                <div className="space-y-1.5">
                  <strong className="text-neonGreen block font-bold uppercase tracking-wider text-[10px]">⚙️ How You Understand It</strong>
                  <ul className="list-disc list-inside space-y-1 text-slate-350 text-slate-300">
                    <li>Dynamic slider stress-tests.</li>
                    <li>Bayesian confidence intervals.</li>
                    <li>XAI (SHAP) feature attributions.</li>
                  </ul>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Methods employed</span>
              </div>
              <div className="space-y-2 bg-darkBg/30 border border-glassBorder/30 p-5 rounded-xl flex flex-col justify-between">
                <div className="space-y-1.5">
                  <strong className="text-purple-400 block font-bold uppercase tracking-wider text-[10px]">💼 What For (Decisions)</strong>
                  <ul className="list-disc list-inside space-y-1 text-slate-350 text-slate-300">
                    <li>Scheduling coal shutdowns.</li>
                    <li>Sizing grid battery storage margins.</li>
                    <li>Deploying EV charging networks.</li>
                  </ul>
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block pt-2 border-t border-glassBorder/20">Business utility</span>
              </div>
            </div>
          </div>
        )}

        {/* Toggle 1: Who is it for? */}
        {guideSection === "audience" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-fade-in">
            {/* Left role selection */}
            <div className="lg:col-span-4 flex flex-col gap-2">
              {roles.map((r, rIdx) => {
                const Icon = r.icon;
                return (
                  <button
                    key={rIdx}
                    onClick={() => setActiveRole(rIdx)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all duration-200 ${
                      activeRole === rIdx
                        ? "bg-glassBg text-neonBlue border-neonBlue shadow-neon"
                        : "bg-darkBg/20 border-glassBorder/40 text-slate-400 hover:text-slate-200 hover:border-glassBorder/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4.5 h-4.5" />
                      <span>{r.title}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activeRole === rIdx ? "translate-x-1" : ""}`} />
                  </button>
                );
              })}
            </div>

            {/* Right role details */}
            <div className="lg:col-span-8 glass-panel p-6 flex flex-col justify-between border-glassBorder/60 bg-darkBg/30">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg border ${roles[activeRole].color}`}>
                    {React.createElement(roles[activeRole].icon, { className: "w-6 h-6" })}
                  </div>
                  <h4 className="font-extrabold text-white text-md tracking-wide">
                    Strategic Value for {roles[activeRole].title}
                  </h4>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">💡 Why use EnerVision AI?</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">{roles[activeRole].why}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">❓ Key Questions Answered</span>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    {roles[activeRole].questions.map((q, qIdx) => (
                      <li key={qIdx} className="leading-snug">{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">📊 What Information You Gain</span>
                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside font-medium">
                    {roles[activeRole].gain.map((g, gIdx) => (
                      <li key={gIdx} className="leading-snug">{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggle 2: Existing Systems vs. Ours */}
        {guideSection === "comparison" && (
          <div className="glass-panel p-6 space-y-4 animate-fade-in overflow-x-auto">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-glassBorder pb-3">
              <Sparkles className="w-4 h-4 text-neonBlue" /> How We Differ from Legacy Platforms
            </h3>
            <table className="w-full text-xs text-slate-300 border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-glassBorder/60 text-slate-400 text-left">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Benchmark Dimension</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Existing Systems</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-neonBlue">EnerVision AI (Ours)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glassBorder/30">
                <tr>
                  <td className="py-4 px-4 font-semibold text-white">Temporal Scope</td>
                  <td className="py-4 px-4 text-slate-400">Static, historical sheets only.</td>
                  <td className="py-4 px-4 font-medium text-slate-200">Interactive, predictive decadal forecasts through 2045.</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-white">Uncertainty Handling</td>
                  <td className="py-4 px-4 text-slate-400">No confidence ranges. Vulnerable to load spikes.</td>
                  <td className="py-4 px-4 font-medium text-slate-200">95% Bayesian Credible Intervals (Monte Carlo Dropout).</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-white">Simulation Engine</td>
                  <td className="py-4 px-4 text-slate-400">Generic, global multipliers applied to all grids.</td>
                  <td className="py-4 px-4 font-medium text-slate-200">Dynamic scenario stress-tests using local country elasticities.</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-white">Explainability (XAI)</td>
                  <td className="py-4 px-4 text-slate-400">Black-box models with no visibility into drivers.</td>
                  <td className="py-4 px-4 font-medium text-slate-200">Game-theoretic SHAP feature attributions.</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-white">Commercial Value</td>
                  <td className="py-4 px-4 text-slate-400">Pure scientific indices. No developer support.</td>
                  <td className="py-4 px-4 font-medium text-slate-200">EV grid suitability ratings and target developer matching.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Onboarding Tour Guide */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide">
            🧭 Step-by-Step Simulation &amp; Decision Flow
          </h3>
          <span className="text-xs text-slate-400">
            Click on the features below to tour the logic sequence of the simulator.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left index navigation */}
          <div className="lg:col-span-4 flex flex-col gap-2">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all duration-200 ${
                    activeStep === idx
                      ? "bg-glassBg text-neonBlue border-neonBlue shadow-neon"
                      : "bg-darkBg/20 border-glassBorder/40 text-slate-400 hover:text-slate-200 hover:border-glassBorder/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{step.title.split(". ")[1]}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${activeStep === idx ? "translate-x-1" : ""}`} />
                </button>
              );
            })}
          </div>

          {/* Right step details */}
          <div className="lg:col-span-8 glass-panel p-6 flex flex-col justify-between border-glassBorder/60 bg-darkBg/30 relative">
            <div className="absolute top-4 right-4 text-[10px] uppercase font-bold text-neonBlue bg-neonBlue/10 border border-neonBlue/20 px-2.5 py-1 rounded-md">
              Engine: {currentStep.model}
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg border ${currentStep.color}`}>
                  <StepIcon className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-white text-md tracking-wide">
                  {currentStep.title}
                </h4>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {currentStep.desc}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">🎯 What is it for?</span>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">{currentStep.for}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">⚙️ What does it do?</span>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">{currentStep.does}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">🔍 What can you observe from it?</span>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400 list-disc list-inside">
                  {currentStep.observe.map((obs, oIdx) => (
                    <li key={oIdx} className="leading-snug">{obs}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-glassBorder/40 pt-6 mt-6">
              <div className="flex gap-2">
                <button
                  onClick={handlePrevStep}
                  className="p-2 border border-glassBorder hover:bg-glassBg/40 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextStep}
                  className="p-2 border border-glassBorder hover:bg-glassBg/40 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setActiveTab(currentStep.id)}
                className="bg-neonBlue/15 hover:bg-neonBlue/25 border border-neonBlue/30 text-neonBlue text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-150"
              >
                Go to Feature <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Mathematical Engine Overview with HTML styled formulas */}
      <div className="glass-panel p-6 space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 border-b border-glassBorder pb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neonBlue" /> 🧬 Mathematical & Machine Learning Foundations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LSTM */}
          <div className="space-y-3 bg-darkBg/10 border border-glassBorder/20 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-2">
              <strong className="text-slate-200 block text-xs uppercase tracking-wider">PyTorch LSTM + Attention</strong>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Models temporal dependencies across historical sequences. A self-attention layer assigns weights to historical inputs based on current state projections:
              </p>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-darkBg/60 p-4 rounded-xl border border-glassBorder/40 my-3 min-h-[70px]">
              <div className="font-mono text-sm text-neonBlue flex items-center gap-1">
                <span className="italic">a</span><sub><span className="italic">t</span></sub>
                <span>=</span>
                <span>softmax(</span>
                <span className="italic">W</span><sub><span className="italic">a</span></sub>
                <span className="italic">h</span><sub><span className="italic">t</span></sub>
                <span>)</span>
              </div>
            </div>

            <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
              Applies multi-step dynamic auto-regressive decoding to predict the 20-year horizon.
            </span>
          </div>

          {/* KMeans */}
          <div className="space-y-3 bg-darkBg/10 border border-glassBorder/20 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-2">
              <strong className="text-slate-200 block text-xs uppercase tracking-wider">KMeans Clustering Objective</strong>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Groups countries by minimizing the sum of squared distances between data points (GDP and renewables share) and their corresponding cluster centroids:
              </p>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-darkBg/60 p-4 rounded-xl border border-glassBorder/40 my-3 min-h-[70px]">
              <div className="font-mono text-xs text-neonGreen flex items-center gap-1 overflow-x-auto max-w-full">
                <span className="text-sm font-bold">J</span>
                <span>=</span>
                <div className="flex flex-col items-center text-[10px] mx-1">
                  <span className="text-[9px]">k</span>
                  <span className="text-lg leading-none font-serif font-black">∑</span>
                  <span className="text-[9px]">j=1</span>
                </div>
                <div className="flex flex-col items-center text-[10px] mx-1">
                  <span className="text-[9px]">n</span>
                  <span className="text-lg leading-none font-serif font-black">∑</span>
                  <span className="text-[9px]">i=1</span>
                </div>
                <span>‖</span>
                <span className="italic">x</span><sub><span className="italic">i</span></sub><sup>(<span className="italic">j</span>)</sup>
                <span>−</span>
                <span className="italic">c</span><sub><span className="italic">j</span></sub>
                <span>‖</span>
                <sup>2</sup>
              </div>
            </div>

            <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
              Fits globally across all decades to preserve category definitions and prevent label swapping.
            </span>
          </div>

          {/* SHAP */}
          <div className="space-y-3 bg-darkBg/10 border border-glassBorder/20 p-5 rounded-xl flex flex-col justify-between">
            <div className="space-y-2">
              <strong className="text-slate-200 block text-xs uppercase tracking-wider">Cooperative SHAP Attributions</strong>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Distributes forecast deviations from baseline expectations among input indicators using game-theoretic Shapley values:
              </p>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-darkBg/60 p-4 rounded-xl border border-glassBorder/40 my-3 min-h-[70px]">
              <div className="font-mono text-[10px] text-purple-400 flex items-center gap-1 overflow-x-auto max-w-full">
                <span>φ</span><sub><span className="italic">i</span></sub><span>(</span><span className="italic">v</span><span>)</span>
                <span>=</span>
                <div className="flex flex-col items-center text-[8px] mr-1">
                  <span className="text-lg leading-none font-serif font-black">∑</span>
                  <span>S ⊆ N \ {"{i}"}</span>
                </div>
                <div className="flex flex-col items-center mx-1">
                  <span className="border-b border-purple-400 pb-0.5 px-1 leading-none">|S|! (|N| − |S| − 1)!</span>
                  <span className="pt-0.5 px-1 leading-none">|N|!</span>
                </div>
                <span>(</span>
                <span className="italic">v</span><span>(</span><span className="italic">S</span><span> ∪ {`{i}`}</span><span>)</span>
                <span>−</span>
                <span className="italic">v</span><span>(</span><span className="italic">S</span><span>)</span>
                <span>)</span>
              </div>
            </div>

            <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
              Quantifies whether demographic trends or renewable growth have pushed forecasts up or down.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
