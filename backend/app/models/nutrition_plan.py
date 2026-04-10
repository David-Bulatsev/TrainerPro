from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class NutritionPlan(Base):
    __tablename__ = "nutrition_plans"

    id = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False, index=True)
    plan_type = Column(String(100), nullable=True)  # bulking, cutting, maintenance, etc.
    meals = Column(Text, nullable=True)  # JSON данные с приемами пищи
    restrictions = Column(Text, nullable=True)  # Аллергии, диетические ограничения
    calories = Column(Integer, nullable=True)
    macros = Column(Text, nullable=True)  # JSON с белками, жирами, углеводами
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    athlete = relationship("Athlete", back_populates="nutrition_plans")

