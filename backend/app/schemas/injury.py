from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from app.models.injury import InjurySeverity


class InjuryBase(BaseModel):
    athlete_id: int
    description: str
    date: date
    severity: str = InjurySeverity.MINOR.value
    recovery_time: Optional[int] = None
    medical_notes: Optional[str] = None
    status: Optional[str] = "active"


class InjuryCreate(InjuryBase):
    pass


class InjuryUpdate(BaseModel):
    athlete_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[date] = None
    severity: Optional[str] = None
    recovery_time: Optional[int] = None
    medical_notes: Optional[str] = None
    status: Optional[str] = None


class InjuryResponse(InjuryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

