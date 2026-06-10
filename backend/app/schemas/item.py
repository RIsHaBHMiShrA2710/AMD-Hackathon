from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, examples=["Set up project template"])
    description: Optional[str] = Field(None, max_length=500, examples=["Initialize React frontend and FastAPI backend"])
    status: str = Field("pending", examples=["pending", "in-progress", "completed"])


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None)


class ItemInDBBase(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Schema to return in API responses
class Item(ItemInDBBase):
    pass
