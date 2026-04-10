from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NutritionPlanBase(BaseModel):
    athlete_id: int
    plan_type: Optional[str] = None
    meals: Optional[str] = None  # JSON строка
    restrictions: Optional[str] = None
    calories: Optional[int] = None
    macros: Optional[str] = None  # JSON строка
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class NutritionPlanCreate(NutritionPlanBase):
    pass


class NutritionPlanUpdate(BaseModel):
    athlete_id: Optional[int] = None
    plan_type: Optional[str] = None
    meals: Optional[str] = None
    restrictions: Optional[str] = None
    calories: Optional[int] = None
    macros: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class NutritionPlanResponse(NutritionPlanBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

