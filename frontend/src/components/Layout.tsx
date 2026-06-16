import React from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-darkBg text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Panel Content Window */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar header */}
        <header className="h-16 border-b border-glassBorder flex items-center justify-between px-8 bg-darkBg/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold tracking-wide text-slate-200">
              {activeTab === "overview" 
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
        <div className="flex-1 overflow-y-auto p-8 bg-darkBg/10">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
