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
import { ApiService } from "../../services/api";
import type { ClusterPoint } from "../../services/api";
import { Layers, Globe, Play, Pause, Sparkles, TrendingUp } from "lucide-react";

const CLUSTER_COLORS = ["#ff416c", "#39ff14", "#00f2fe"];
const CLUSTER_NAMES = [
  "Fossil-Intensive Grid Systems",
  "Expanding & Transitioning Energy Systems",
  "Low-Carbon & Renewable-Driven Grid Systems"
];

export const Clustering: React.FC = () => {
  const [points, setPoints] = useState<ClusterPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [timelineData, setTimelineData] = useState<Record<string, ClusterPoint[]>>({});
  const [activeYear, setActiveYear] = useState<string>("2024");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(600); // ms per frame
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedSimilarityCountry, setSelectedSimilarityCountry] = useState<string>("IND");
  const [showMath, setShowMath] = useState<boolean>(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getClusterTimeline();
        setTimelineData(data);
        const years = Object.keys(data).sort();
        setAvailableYears(years);
        if (years.length > 0) {
          const defaultYear = years.includes("2024") ? "2024" : years[0];
          setActiveYear(defaultYear);
          setPoints(data[defaultYear] || []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load clustering timeline data");
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  // Interval player for timeline playback
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && availableYears.length > 0) {
      interval = setInterval(() => {
        setActiveYear(current => {
          const currentIndex = availableYears.indexOf(current);
          const nextIndex = (currentIndex + 1) % availableYears.length;
          const nextYear = availableYears[nextIndex];
          setPoints(timelineData[nextYear] || []);
          return nextYear;
        });
      }, playSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, availableYears, timelineData, playSpeed]);

  const handleYearChange = (year: string) => {
    setIsPlaying(false);
    setActiveYear(year);
    setPoints(timelineData[year] || []);
  };

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

  // Calculate cluster share percentages
  const totalPointsCount = points.length || 1;
  const clusterShares = [0, 1, 2].map(cId => {
    const count = clustersGrouped[cId].length;
    const share = (count / totalPointsCount) * 100;
    
    // Average GDP and Renewable Share in this year for the cluster
    const clusterPoints = clustersGrouped[cId];
    const avgGdp = clusterPoints.length > 0 
      ? clusterPoints.reduce((acc, curr) => acc + curr.gdp_per_capita, 0) / clusterPoints.length
      : 0;
    const avgRenewables = clusterPoints.length > 0 
      ? clusterPoints.reduce((acc, curr) => acc + curr.renewable_share, 0) / clusterPoints.length
      : 0;

    return {
      id: cId,
      count,
      share,
      avgGdp,
      avgRenewables
    };
  });

  // Calculate country migrations in the active year
  const getMigrations = () => {
    const currentIndex = availableYears.indexOf(activeYear);
    if (currentIndex <= 0) return [];
    const prevYear = availableYears[currentIndex - 1];
    
    const currentPoints = timelineData[activeYear] || [];
    const prevPoints = timelineData[prevYear] || [];

    const prevMap = new Map(prevPoints.map(p => [p.code, p.cluster]));
    const list: Array<{ country: string; code: string; oldCluster: number; newCluster: number }> = [];

    currentPoints.forEach(p => {
      const oldCluster = prevMap.get(p.code);
      if (oldCluster !== undefined && oldCluster !== p.cluster) {
        list.push({
          country: p.country,
          code: p.code,
          oldCluster,
          newCluster: p.cluster
        });
      }
    });

    return list;
  };

  const currentMigrations = getMigrations();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 0. Enterprise Explainer Header Card */}
      <div className="glass-panel p-6 bg-gradient-to-r from-darkBg/60 to-neonBlue/5 border-neonBlue/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
            <Layers className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">
              Regional Energy Clustering (Temporal Segments)
            </h2>
            <p className="text-xs text-slate-400">
              KMeans segmentation tracks country transitions and sovereign energy migrations over a 56-year timeline.
            </p>
          </div>
        </div>

        {/* Informational Guidance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-glassBorder/40 text-xs">
          <div className="space-y-1">
            <span className="text-neonBlue font-bold block uppercase tracking-wider text-[10px]">🎯 What is it for? (Resembles: Peer Group Benchmarking)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Segments global grid profiles over the entire 56-year horizon to study transition patterns and identify regional peer milestones.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-neonGreen font-bold block uppercase tracking-wider text-[10px]">⚙️ What does it do? (Energy Context)</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Groups 200+ countries using a global KMeans algorithm on GDP per capita vs. renewables share parameters.
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-purple-450 font-bold block uppercase tracking-wider text-[10px] text-purple-400">💼 Business Decisions Supported</span>
            <p className="text-slate-450 text-slate-400 leading-relaxed">
              Select geographic expansion target regions for international clean technology deployments based on benchmarked peer groupings.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main 2D Scatter Chart Column */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Global Regional Energy Segments
              </h3>
              <span className="text-xs text-slate-400 block">
                KMeans clustering based on GDP per capita (X) and Renewable Share (Y)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] font-semibold text-slate-400">
              <div className="flex flex-col gap-1 items-end">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#ff416c]"></span> Cluster 0: Fossil Baseline</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#39ff14]"></span> Cluster 1: Rapid Growth</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#00f2fe]"></span> Cluster 2: Transition Leaders</span>
              </div>
            </div>
          </div>

          {/* Timeline Animation Controller Panel */}
          <div className="bg-darkBg/30 border border-glassBorder/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="bg-neonBlue/15 hover:bg-neonBlue/25 border border-neonBlue/30 text-neonBlue p-2.5 rounded-lg transition-all duration-150 flex items-center justify-center shadow-neon"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-neonBlue" /> : <Play className="w-4 h-4 fill-neonBlue" />}
              </button>
              <div className="text-xs">
                <span className="text-slate-500 block uppercase tracking-wider text-[9px] font-bold">Active Year</span>
                <strong className="text-white text-md font-extrabold">{activeYear}</strong>
                <span className="text-[10px] text-slate-400 ml-1.5 font-semibold">
                  {parseInt(activeYear) >= 2025 ? "🔮 Projection" : "📊 Historical"}
                </span>
              </div>
            </div>
            
            {/* Year slider */}
            <div className="flex-1 max-w-sm w-full mx-4 space-y-1">
              <input
                type="range"
                min={availableYears[0] || "1990"}
                max={availableYears[availableYears.length - 1] || "2045"}
                value={activeYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full accent-neonBlue h-1 bg-darkBg rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                <span>1990</span>
                <span>2024</span>
                <span>2045</span>
              </div>
            </div>

            {/* Play Speed selector */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Speed</span>
              <select
                value={playSpeed}
                onChange={(e) => setPlaySpeed(Number(e.target.value))}
                className="bg-darkBg border border-glassBorder text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none"
              >
                <option value="1200">0.5x</option>
                <option value="600">1.0x</option>
                <option value="300">2.0x</option>
              </select>
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
                  domain={[0, 80000]}
                  allowDataOverflow={true}
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
                  itemStyle={{ color: "#fff" }}
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

        {/* Temporal Segment Migration & Cluster Pulse Panel */}
        <div className="glass-panel p-6 flex flex-col justify-between border-glassBorder/60 bg-darkBg/20">
          <div className="space-y-4">
            <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neonBlue animate-pulse" /> Temporal Cluster Pulse
            </h4>

            {/* Distribution metrics */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Cluster Distribution ({activeYear})</span>
              <div className="space-y-2 text-xs">
                {clusterShares.map((c) => (
                  <div key={c.id} className="space-y-1 bg-darkBg/30 border border-glassBorder/20 p-2.5 rounded-lg">
                    <div className="flex justify-between font-bold">
                      <span style={{ color: CLUSTER_COLORS[c.id] }}>{CLUSTER_NAMES[c.id]}</span>
                      <span className="text-white">{c.share.toFixed(1)}% <span className="text-slate-500 font-normal">({c.count})</span></span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Avg GDP: ${Math.round(c.avgGdp).toLocaleString()}</span>
                      <span>Avg Renewables: ${(c.avgRenewables * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sovereign Migrations Live Log */}
            <div className="space-y-2 border-t border-glassBorder/30 pt-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-neonGreen" /> Migrations in {activeYear}
              </span>
              <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5 text-[10px]">
                {currentMigrations.map((m, idx) => (
                  <div key={idx} className="bg-neonGreen/5 border border-neonGreen/10 p-2 rounded-lg text-slate-300 leading-snug flex items-start gap-1.5">
                    <span>🚀</span>
                    <div>
                      <strong className="text-white">{m.country}</strong> transitioned from <strong style={{ color: CLUSTER_COLORS[m.oldCluster] }}>Cluster {m.oldCluster}</strong> to <strong style={{ color: CLUSTER_COLORS[m.newCluster] }}>Cluster {m.newCluster}</strong>.
                    </div>
                  </div>
                ))}
                {currentMigrations.length === 0 && (
                  <div className="text-slate-500 italic py-2 text-center bg-darkBg/10 border border-glassBorder/20 rounded-lg">
                    No sovereign migrations recorded in this year.
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block pt-4 border-t border-glassBorder/30">
            EnerVision KMeans Segment Engine
          </span>
        </div>

      </div>

      {/* Sovereign Peer Similarity Explorer Card */}
      {(() => {
        const targetPoint = points.find(p => p.code === selectedSimilarityCountry);
        
        // Find max values for normalization
        const maxGdp = Math.max(...points.map(p => p.gdp_per_capita)) || 1;
        const maxRenewables = Math.max(...points.map(p => p.renewable_share)) || 1;

        const similarityPeers = points
          .filter(p => p.code !== selectedSimilarityCountry)
          .map(p => {
            const gdpDiff = (p.gdp_per_capita - (targetPoint?.gdp_per_capita || 0)) / maxGdp;
            const renDiff = (p.renewable_share - (targetPoint?.renewable_share || 0)) / maxRenewables;
            const distance = Math.sqrt(gdpDiff * gdpDiff + renDiff * renDiff);
            const similarity = Math.max(0, 100 * (1 - distance));
            return {
              country: p.country,
              code: p.code,
              cluster: p.cluster,
              gdp: p.gdp_per_capita,
              renewables: p.renewable_share,
              similarity
            };
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5);

        const uniqueCountriesForSimilarity = [...points].sort((a, b) => a.country.localeCompare(b.country));

        return (
          <div className="glass-panel p-6 space-y-6 border-glassBorder/60 bg-darkBg/20">
            {/* Header containing title and target dropdown */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-glassBorder pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-neonBlue/10 p-2.5 rounded-lg text-neonBlue">
                  <Globe className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    Sovereign Peer Proximity Explorer
                  </h3>
                  <p className="text-xs text-slate-400">
                    Benchmarking relative distance in 2D normalized feature space (GDP per capita vs. Clean Energy Share).
                  </p>
                </div>
              </div>

              {/* Selector next to Title */}
              <div className="flex items-center gap-3 bg-darkBg/40 border border-glassBorder rounded-xl p-2 max-w-sm w-full md:w-auto self-start md:self-auto">
                <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold whitespace-nowrap">Target Sovereign:</label>
                <select
                  value={selectedSimilarityCountry}
                  onChange={(e) => setSelectedSimilarityCountry(e.target.value)}
                  className="bg-darkBg border border-glassBorder/60 text-slate-100 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neonBlue font-semibold w-full md:w-48 cursor-pointer"
                >
                  {uniqueCountriesForSimilarity.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.country} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-Header Actions */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Top 5 Nearest sovereign neighbors ({activeYear})
              </span>
              <button
                onClick={() => setShowMath(!showMath)}
                className="text-xs text-neonBlue hover:underline flex items-center gap-1.5 font-semibold transition-all"
              >
                {showMath ? "Hide Math Modeling" : "View Math Modeling"}
              </button>
            </div>

            {/* Collapsible Math Modeling Explanation */}
            {showMath && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-darkBg/40 border border-glassBorder/30 p-5 rounded-xl text-xs text-slate-400 animate-fade-in">
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Proximity Math Modeling</span>
                  <p className="leading-relaxed">Features are normalized against maximum values to compute the normalized Euclidean distance:</p>
                  <div className="bg-darkBg/60 border border-glassBorder/25 p-3 rounded-lg font-mono text-center text-neonBlue text-[11px] my-1">
                    {"d(p, q) = \\sqrt{ (\\Delta GDP_{norm})^2 + (\\Delta Renewables)^2 }"}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Percentage Similarity Mapping</span>
                  <p className="leading-relaxed">Proximity is mapped into a percentage match gauge:</p>
                  <div className="bg-darkBg/60 border border-glassBorder/25 p-3 rounded-lg font-mono text-center text-neonGreen text-[11px] my-1">
                    Similarity = max(0, 100 × (1 - d))%
                  </div>
                </div>
              </div>
            )}

            {/* 5 Neighbors Cards spanning Full Width */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {similarityPeers.map((peer, idx) => {
                const gdpDiff = peer.gdp - (targetPoint?.gdp_per_capita || 0);
                const renDiff = (peer.renewables - (targetPoint?.renewable_share || 0)) * 100;

                return (
                  <div 
                    key={peer.code} 
                    className="glass-panel p-4 bg-darkBg/20 border border-glassBorder/30 rounded-xl flex flex-col justify-between space-y-4 relative hover:border-neonBlue/40 transition-all duration-150"
                  >
                    <span className="absolute -top-2.5 -right-2 bg-neonBlue/15 text-neonBlue text-[9px] font-black px-2 py-0.5 rounded-md border border-neonBlue/30 shadow-neon">
                      #{idx + 1}
                    </span>

                    <div className="space-y-1">
                      <strong className="text-white block text-xs truncate" title={peer.country}>{peer.country}</strong>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block">{peer.code}</span>
                      
                      <span 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border block text-center w-full truncate mt-1.5"
                        style={{ 
                          borderColor: `${CLUSTER_COLORS[peer.cluster]}30`, 
                          color: CLUSTER_COLORS[peer.cluster], 
                          backgroundColor: `${CLUSTER_COLORS[peer.cluster]}05` 
                        }}
                      >
                        {CLUSTER_NAMES[peer.cluster].split(" ")[0]}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-glassBorder/20 pt-2 text-[9px] leading-relaxed">
                      <div className="space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-400">Match</span>
                          <span className="text-neonGreen">{peer.similarity.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-darkBg h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-neonGreen h-full" 
                            style={{ width: `${peer.similarity}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5 text-slate-400 font-mono text-[8px]">
                        <div className="flex justify-between">
                          <span>ΔGDP</span>
                          <span className={gdpDiff >= 0 ? "text-neonGreen" : "text-neonRed"}>
                            {gdpDiff >= 0 ? "+" : ""}${Math.round(gdpDiff).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>ΔRenew</span>
                          <span className={renDiff >= 0 ? "text-neonGreen" : "text-neonRed"}>
                            {renDiff >= 0 ? "+" : ""}{renDiff.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {similarityPeers.length === 0 && (
                <div className="col-span-5 text-center text-slate-500 italic py-6">
                  No matching peer neighbors found
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cluster Class Descriptions */}
      <div className="glass-panel p-6 space-y-4">
        <h4 className="font-bold text-white text-md border-b border-glassBorder pb-3 flex items-center gap-2">
          <Layers className="w-5 h-5 text-neonBlue" /> Cluster Definitions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CLUSTER_NAMES.map((name, idx) => (
            <div key={idx} className="space-y-2 text-xs bg-darkBg/10 border border-glassBorder/20 p-4 rounded-xl">
              <span className="font-bold flex items-center gap-2" style={{ color: CLUSTER_COLORS[idx] }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[idx] }}></span>
                {name}
              </span>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                {idx === 2 
                  ? "Highly developed or resource-rich nations with high renewable share (hydro, wind, solar) leading the transition."
                  : idx === 1 
                  ? "Developing economies with rapid electricity demand expansion. Characterized by rising renewables alongside fossil baseline growth."
                  : "Developed or wealthy economies reliant primarily on legacy fossil base loads (coal/gas/oil) with low relative renewable shares."
                }
              </p>
            </div>
          ))}
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
