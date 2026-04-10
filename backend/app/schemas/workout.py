from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class WorkoutBase(BaseModel):
    date: datetime
    time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    training_plan_id: Optional[int] = None


class WorkoutCreate(WorkoutBase):
    pass


class WorkoutUpdate(BaseModel):
    date: Optional[datetime] = None
    time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    training_plan_id: Optional[int] = None


class WorkoutResponse(WorkoutBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

