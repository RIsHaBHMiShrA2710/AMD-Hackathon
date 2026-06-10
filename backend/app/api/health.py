import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db

router = APIRouter()


@router.get("/health", tags=["system"])
def check_health(db: Session = Depends(get_db)):
    start_time = time.time()
    
    # Test DB connection
    db_status = "unhealthy"
    items_count = 0
    try:
        # Check database connection by executing a simple query
        db.execute(text("SELECT 1"))
        db_status = "healthy"
        
        # Get count of items
        from app.models.item import Item
        items_count = db.query(Item).count()
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    latency = round((time.time() - start_time) * 1000, 2)
    
    return {
        "status": "online",
        "database": db_status,
        "items_count": items_count,
        "latency_ms": latency,
        "environment": "development"
    }
