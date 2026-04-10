from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.attendance import AttendanceStatus


class AttendanceBase(BaseModel):
    athlete_id: int
    workout_id: int
    status: str = AttendanceStatus.PRESENT.value
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    athlete_id: Optional[int] = None
    workout_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

