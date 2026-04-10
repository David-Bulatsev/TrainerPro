from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TrainingPlanBase(BaseModel):
    name: str
    description: Optional[str] = None
    weeks: int = 1
    plan_data: Optional[str] = None  # JSON строка


class TrainingPlanCreate(TrainingPlanBase):
    pass


class TrainingPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    weeks: Optional[int] = None
    plan_data: Optional[str] = None


class TrainingPlanResponse(TrainingPlanBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

