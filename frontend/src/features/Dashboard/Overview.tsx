import React, { useState, useEffect } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { ApiService, KPIData, FuelMixPoint } from "../../services/api";
import { Zap, ShieldAlert, Sparkles, Globe } from "lucide-react";

export const Overview: React.FC = () => {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [mix, setMix] = useState<FuelMixPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        setLoading(true);
        const [kpiRes, mixRes] = await Promise.all([
          ApiService.getKPIs(),
          ApiService.getGlobalMix()
        ]);
        setKpis(kpiRes);
        setMix(mixRes);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    loadOverviewData();
  }, []);

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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Global KPI Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric Card 1: Total Generation */}
        <div className="glass-panel p-6 flex items-start justify-between relative overflow-hidden group hover:border-neonBlue/30 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Global Electricity Generation
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
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

      {/* 2. Generation Fuel Mix Stacked Area Chart */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              Global Electricity Fuel Mix Transition
            </h3>
            <span className="text-xs text-slate-400">
              Historical development of electricity generation mix (TWh) from 1990 to present
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Solar</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Wind</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span> Hydro</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-500"></span> Coal</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-500"></span> Gas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-500"></span> Nuclear</span>
          </div>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mix} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" stroke="#475569" tickLine={false} style={{ fontSize: '11px' }} />
              <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '11px' }} />
              <Tooltip 
                contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)", borderRadius: "8px" }}
                labelStyle={{ fontWeight: "bold", color: "#f3f4f6" }}
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
    </div>
  );
};
