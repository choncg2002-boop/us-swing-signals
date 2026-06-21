from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.portfolio_routes import router as portfolio_router
from app.api.routes import router
from app.api.websocket_routes import router as ws_router
from app.config import get_settings
from app.portfolio.service import sync_order_history_day
from app.services.scheduler import start_scheduler, stop_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    loop = asyncio.get_running_loop()
    sync_order_history_day()
    start_scheduler(loop)
    yield
    stop_scheduler()


app = FastAPI(title=settings.app_name, version="1.1.0", lifespan=lifespan)

_cors = settings.cors_origins.strip()
if _cors == "*":
    _allow_origins = ["*"]
else:
    _allow_origins = [o.strip() for o in _cors.split(",") if o.strip()]
    _allow_origins.extend([
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1",
        "http://localhost",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_cors != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(portfolio_router)
app.include_router(ws_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "US Swing Signals API", "docs": "/docs", "ws": "/ws/prices"}
