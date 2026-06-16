import React from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Sliders, 
  Layers, 
  ShieldAlert, 
  MessageSquare,
  Zap
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "forecast", label: "Predictive Forecasts", icon: TrendingUp },
    { id: "simulator", label: "Scenario Simulator", icon: Sliders },
    { id: "clustering", label: "Regional Clustering", icon: Layers },
    { id: "risk", label: "Risk Assessments", icon: ShieldAlert },
    { id: "copilot", label: "AI Copilot Workspace", icon: MessageSquare },
  ];

  return (
    <aside className="w-64 bg-darkBg border-r border-glassBorder flex flex-col h-screen select-none">
      {/* Brand Logo Header */}
      <div className="p-6 border-b border-glassBorder flex items-center gap-3">
        <div className="bg-gradient-to-tr from-secondary-color to-neonBlue p-2 rounded-lg pulse-glow-blue">
          <Zap className="w-5 h-5 text-neonBlue" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            EnerVision AI
          </h1>
          <span className="text-xs text-cyanAccent uppercase tracking-widest font-semibold">
            Transition Engine
          </span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-glassBg text-neonBlue border-l-2 border-neonBlue shadow-neon"
                  : "text-slate-400 hover:bg-glassBg/40 hover:text-slate-100"
              }`}
            >
              <IconComponent 
                className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? "text-neonBlue" : "text-slate-400 group-hover:text-slate-200"
                }`} 
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status Info */}
      <div className="p-6 border-t border-glassBorder flex items-center justify-between text-xs text-slate-500">
        <span>System Version 1.0.0</span>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-neonGreen animate-pulse"></span>
          <span className="text-slate-400">Online</span>
        </div>
      </div>
    </aside>
  );
};
