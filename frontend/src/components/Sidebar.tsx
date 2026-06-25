import { 
  BarChart3, 
  TrendingUp, 
  Sliders, 
  Layers, 
  ShieldAlert, 
  MessageSquare,
  Zap,
  Info,
  X
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen = false, onClose }) => {
  const menuItems = [
    { id: "introduction", label: "Guide & Portal Info", icon: Info },
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "forecast", label: "Predictive Forecasts", icon: TrendingUp },
    { id: "simulator", label: "Scenario Simulator", icon: Sliders },
    { id: "clustering", label: "Regional Clustering", icon: Layers },
    { id: "risk", label: "Risk Assessments", icon: ShieldAlert },
    { id: "copilot", label: "AI Copilot Workspace", icon: MessageSquare },
  ];

  return (
    <aside className={`w-64 bg-darkBg border-r border-glassBorder flex flex-col h-screen select-none fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    }`}>
      {/* Brand Logo Header */}
      <div className="p-6 border-b border-glassBorder flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center bg-slate-900/60 border border-slate-700/40 p-2.5 rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.12)]">
            <Zap className="w-4 h-4 text-neonBlue animate-pulse" />
            <div className="absolute inset-0 bg-neonBlue/10 blur-md rounded-xl -z-10"></div>
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center">
              EnerVision<span className="text-neonBlue ml-0.5">AI</span>
            </h1>
            <span className="text-[9px] text-cyanAccent uppercase tracking-[0.22em] font-bold block mt-0.5">
              Planning Portal
            </span>
          </div>
        </div>
        {/* Close Button on Mobile */}
        <button 
          onClick={onClose} 
          className="md:hidden p-1.5 text-slate-450 hover:text-slate-100 hover:bg-glassBg/40 rounded-lg transition-colors text-slate-400"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
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
                  ? "bg-gradient-to-r from-neonBlue/10 to-cyanAccent/5 text-neonBlue border-l-4 border-neonBlue shadow-neon font-semibold"
                  : "text-slate-400 hover:bg-glassBg/35 hover:text-slate-100 hover:translate-x-1"
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
