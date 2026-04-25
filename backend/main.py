import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, auth, maps, trips, catalog
from database import create_tables
from services.health_metrics import record_request

app = FastAPI(
    title="AI Travel Planner API",
    version="1.0.0"
)

# Accept a comma-separated list via CORS_ORIGINS, with safe local defaults for mobile dev.
def get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    if raw.strip():
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1|10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(1[6-9]|2\\d|3[0-1])\\.\\d+\\.\\d+)(:\\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(maps.router)
app.include_router(catalog.router)
app.include_router(admin.router)


@app.middleware("http")
async def capture_request_metrics(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        record_request(500)
        raise
    record_request(response.status_code)
    return response


@app.on_event('startup')
def startup():
    create_tables()


@app.get('/')
def root():
    return {"message": "AI Travel Planner API is running!"}


# Run example:
# uvicorn main:app --reload --host 0.0.0.0 --port 8000
