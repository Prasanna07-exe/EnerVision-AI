const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface Country {
  id: number;
  code: string;
  name: string;
  region: string;
}

export interface KPIData {
  year: number | null;
  global: {
    electricity_generation: number;
    emissions: number;
    renewable_share: number;
  };
  countries: Array<{
    country: string;
    code: string;
    electricity_generation: number;
    emissions: number;
    renewable_share: number;
  }>;
}

export interface FuelMixPoint {
  year: number;
  coal: number;
  gas: number;
  solar: number;
  wind: number;
  hydro: number;
  nuclear: number;
}

export interface MapPoint {
  code: string;
  name: string;
  emissions: number;
  renewable_share: number;
}

export interface ForecastPoint {
  year: number;
  value: number;
  confidence_lower?: number;
  confidence_upper?: number;
}

export interface ForecastResponse {
  country: string;
  metric: string;
  model: string;
  historical: Array<{ year: number; value: number }>;
  forecast: Array<ForecastPoint>;
}

export interface SimulationResponse {
  country: string;
  code: string;
  electricity_demand: Array<{ year: number; value: number }>;
  renewable_share: Array<{ year: number; value: number }>;
  co2_emissions: Array<{ year: number; value: number }>;
}

export interface RiskScores {
  country: string;
  code: string;
  year: number | null;
  supply_risk: number;
  emission_risk: number;
  transition_readiness: number;
}

export interface ClusterPoint {
  country: string;
  code: string;
  gdp_per_capita: number;
  renewable_share: number;
  emissions: number;
  cluster: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentThought {
  agent_name: string;
  thought: string;
}

export interface ChatResponse {
  response: string;
  thoughts: AgentThought[];
}

export const ApiService = {
  async getCountries(): Promise<Country[]> {
    const res = await fetch(`${API_BASE_URL}/countries`);
    if (!res.ok) throw new Error("Failed to fetch countries");
    return res.json();
  },

  async getKPIs(): Promise<KPIData> {
    const res = await fetch(`${API_BASE_URL}/dashboard/kpis`);
    if (!res.ok) throw new Error("Failed to fetch KPIs");
    return res.json();
  },

  async getGlobalMix(): Promise<FuelMixPoint[]> {
    const res = await fetch(`${API_BASE_URL}/dashboard/mix`);
    if (!res.ok) throw new Error("Failed to fetch global mix");
    return res.json();
  },

  async getMapData(): Promise<MapPoint[]> {
    const res = await fetch(`${API_BASE_URL}/dashboard/map`);
    if (!res.ok) throw new Error("Failed to fetch map data");
    return res.json();
  },

  async getForecast(
    countryCode: string,
    metric: string,
    model: string = "ensemble"
  ): Promise<ForecastResponse> {
    const res = await fetch(
      `${API_BASE_URL}/forecast/${countryCode}?metric=${metric}&model=${model}`
    );
    if (!res.ok) throw new Error("Failed to fetch forecast");
    return res.json();
  },

  async simulate(
    countryCode: string,
    solarChange: number,
    evChange: number,
    coalChange: number
  ): Promise<SimulationResponse> {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country_code: countryCode,
        solar_change: solarChange,
        ev_change: evChange,
        coal_change: coalChange
      })
    });
    if (!res.ok) throw new Error("Failed to run simulation");
    return res.json();
  },

  async saveScenario(
    name: string,
    solarChange: number,
    evChange: number,
    coalChange: number
  ): Promise<{ status: string; id: number }> {
    const res = await fetch(`${API_BASE_URL}/simulate/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        solar_change: solarChange,
        ev_change: evChange,
        coal_change: coalChange
      })
    });
    if (!res.ok) throw new Error("Failed to save scenario");
    return res.json();
  },

  async getSavedScenarios(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/simulate/saved`);
    if (!res.ok) throw new Error("Failed to fetch saved scenarios");
    return res.json();
  },

  async getRiskScores(countryCode: string): Promise<RiskScores> {
    const res = await fetch(`${API_BASE_URL}/risk/${countryCode}`);
    if (!res.ok) throw new Error("Failed to fetch risk scores");
    return res.json();
  },

  async getClusters(): Promise<ClusterPoint[]> {
    const res = await fetch(`${API_BASE_URL}/cluster`);
    if (!res.ok) throw new Error("Failed to fetch clusters");
    return res.json();
  },

  async chat(
    message: string,
    history: ChatMessage[]
  ): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/copilot/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });
    if (!res.ok) throw new Error("Failed to chat with Copilot");
    return res.json();
  }
};
