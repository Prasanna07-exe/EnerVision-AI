from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import dashboard, forecast, simulate, risk, cluster, countries, copilot

app = FastAPI(
    title="EnerVision AI Gateway",
    description="Enterprise API engine for forecasting, simulations, and multi-agent energy transition insights.",
    version="1.0.0"
)

# Configure CORS Middleware to allow requests from the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under api/v1 namespace
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(forecast.router, prefix="/api/v1")
app.include_router(simulate.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")
app.include_router(cluster.router, prefix="/api/v1")
app.include_router(countries.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "EnerVision AI API Gateway is active",
        "environment": settings.ENV
    }
