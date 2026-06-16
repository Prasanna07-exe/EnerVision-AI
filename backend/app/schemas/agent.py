from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SimulationRequestSchema(BaseModel):
    country_code: str
    solar_change: float  # Percentage, e.g. 30.0
    ev_change: float     # Percentage, e.g. 50.0
    coal_change: float    # Percentage, e.g. -20.0

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class AgentThought(BaseModel):
    agent_name: str
    thought: str

class ChatResponse(BaseModel):
    response: str
    thoughts: List[AgentThought] = []
    data: Optional[Dict[str, Any]] = None
