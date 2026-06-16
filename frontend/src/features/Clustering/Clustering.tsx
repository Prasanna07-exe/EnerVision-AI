import React, { useState, useEffect } from "react";
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { ApiService, ClusterPoint } from "../../services/api";
import { Layers, Globe } from "lucide-react";

const CLUSTER_COLORS = ["#00f2fe", "#39ff14", "#ff416c"];
const CLUSTER_NAMES = [
  "Industrialized Transition Leaders",
  "Rapid-Growth Developing Economies",
  "Fossil-Dependent Baseline Grids"
];

export const Clustering: React.FC = () => {
  const [points, setPoints] = useState<ClusterPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClusters = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getClusters();
        setPoints(data);
      } catch (err: any) {
        setError(err.message || "Failed to load clusters");
      } finally {
        setLoading(false);
      }
    };
    fetchClusters();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-neonBlue"></div>
        <p className="text-slate-400 text-xs font-medium">Running KMeans segmentation algorithms...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-neonRed text-sm text-center mt-12">{error}</div>;
  }

  // Group countries by their cluster ID for table lists
  const clustersGrouped: Record<number, ClusterPoint[]> = { 0: [], 1: [], 2: [] };
  points.forEach(p => {
    if (clustersGrouped[p.cluster]) {
      clustersGrouped[p.cluster].push(p);
    }
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main 2D Scatter Chart Column */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Global Regional Energy Segments
              </h3>
              <span className="text-xs text-slate-400">
                KMeans clustering based on GDP per capita (X) and Renewable Share (Y)
              </span>
            </div>
            <div className="flex flex-col gap-1 items-end text-[10px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#00f2fe]"></span> Cluster 0: Leaders</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#39ff14]"></span> Cluster 1: Rapid Growth</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-[#ff416c]"></span> Cluster 2: Fossil Dependents</span>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
                <XAxis 
                  type="number" 
                  dataKey="gdp_per_capita" 
                  name="GDP Per Capita" 
                  unit=" USD" 
                  stroke="#475569"
                  tickLine={false}
                  style={{ fontSize: '10px' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="renewable_share" 
                  name="Renewables" 
                  stroke="#475569"
                  tickLine={false}
                  style={{ fontSize: '10px' }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                {/* ZAxis maps bubble size to total annual emissions */}
                <ZAxis 
                  type="number" 
                  dataKey="emissions" 
                  range={[50, 400]} 
                  name="Emissions" 
                  unit=" MT" 
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }}
                  formatter={(value: any, name: string) => {
                    if (name === "Renewables") return [`${(value * 100).toFixed(1)}%`, "Renewables Share"];
                    if (name === "GDP Per Capita") return [`$${value.toLocaleString()}`, "GDP Per Capita"];
                    return [value, name];
                  }}
                />
                <Scatter name="Countries" data={points}>
                  {points.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CLUSTER_COLORS[entry.cluster]} 
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cluster Class Descriptions */}
        <div className="glass-panel p-6 space-y-6">
          <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-neonBlue" /> Cluster Definitions
          </h4>
          <div className="space-y-4">
            {CLUSTER_NAMES.map((name, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <span className="font-bold flex items-center gap-2" style={{ color: CLUSTER_COLORS[idx] }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[idx] }}></span>
                  {name} (Cluster {idx})
                </span>
                <p className="text-slate-400 leading-relaxed">
                  {idx === 0 
                    ? "Highly developed nations with high GDP per capita and accelerated solar/wind deployment tracks."
                    : idx === 1 
                    ? "Developing economies with rapid electricity demand expansion. Characterized by rising renewables alongside fossil baseline growth."
                    : "Grids reliant primarily on legacy coal and gas base loads, with low relative GDP capabilities for transition investments."
                  }
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 2. Country Listings inside Groups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((clusterId) => (
          <div key={clusterId} className="glass-panel p-6 space-y-4 max-h-96 overflow-y-auto">
            <h4 className="font-bold text-sm border-b border-glassBorder pb-2 uppercase tracking-wider" style={{ color: CLUSTER_COLORS[clusterId] }}>
              {CLUSTER_NAMES[clusterId]} ({clustersGrouped[clusterId].length})
            </h4>
            <ul className="space-y-2">
              {clustersGrouped[clusterId].map((c) => (
                <li key={c.code} className="flex justify-between items-center text-xs bg-darkBg/40 border border-glassBorder/40 p-2.5 rounded-lg">
                  <span className="font-medium text-slate-200 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-500" /> {c.country}
                  </span>
                  <span className="font-bold text-slate-500">{c.code}</span>
                </li>
              ))}
              {clustersGrouped[clusterId].length === 0 && (
                <li className="text-xs text-slate-500 italic">No countries in this segment</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
