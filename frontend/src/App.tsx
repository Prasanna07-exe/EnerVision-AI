import { useState } from "react";
import { Layout } from "./components/Layout";
import { Overview } from "./features/Dashboard/Overview";
import { Forecast } from "./features/Forecasting/Forecast";
import { Simulator } from "./features/Simulator/Simulator";
import { Clustering } from "./features/Clustering/Clustering";
import { Risk } from "./features/Risk/Risk";
import { Copilot } from "./features/Copilot/Copilot";

function App() {
  // Manage the selected nav section tab
  const [activeTab, setActiveTab] = useState<string>("overview");

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "overview" && <Overview />}
      {activeTab === "forecast" && <Forecast />}
      {activeTab === "simulator" && <Simulator />}
      {activeTab === "clustering" && <Clustering />}
      {activeTab === "risk" && <Risk />}
      {activeTab === "copilot" && <Copilot />}
    </Layout>
  );
}

export default App;
