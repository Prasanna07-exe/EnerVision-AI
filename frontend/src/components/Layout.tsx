import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  return (
    <div className="flex h-screen overflow-hidden bg-darkBg text-slate-100 font-sans relative">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSidebarOpen(false); // Close drawer on selection
        }} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Panel Content Window */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Top bar header */}
        <header className="h-16 border-b border-glassBorder flex items-center justify-between px-4 md:px-8 bg-darkBg/40 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="md:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-glassBg/40 rounded-lg transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm md:text-lg font-semibold tracking-wide text-slate-200 truncate">
              {activeTab === "introduction"
                ? "Welcome & Onboarding Guide"
                : activeTab === "overview" 
                ? "Global Energy Overview" 
                : activeTab === "forecast" 
                ? "Predictive Projections" 
                : activeTab === "simulator" 
                ? "Scenario Simulation Sandbox" 
                : activeTab === "clustering" 
                ? "Regional Energy Clustering"
                : activeTab === "risk" 
                ? "Transition Risk Metrics" 
                : "Energy Copilot AI Workspace"
              }
            </h2>
          </div>
        </header>

        {/* Dynamic Inner Body (Vertical scrolling restricted to inside this div) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-darkBg/10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
