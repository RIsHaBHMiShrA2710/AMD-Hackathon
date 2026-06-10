from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import items, health
from app.db.session import engine, Base

# Automatically create tables in SQLite on application startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Clean, modular template for FastAPI and React-Vite dashboard development.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS middleware configuration
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_headers=["*"],
        allow_methods=["*"],
    )

# Include API Routers
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(items.router, prefix=f"{settings.API_V1_STR}/items", tags=["items"])


@app.get("/")
def read_root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "health_check": f"{settings.API_V1_STR}/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
