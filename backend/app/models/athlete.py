from sqlalchemy import Column, Integer, String, Date, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Athlete(Base):
    __tablename__ = "athletes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    photo = Column(String(255), nullable=True)  # Путь к фото или URL
    contact_info = Column(Text, nullable=True)  # JSON строка или текст
    birth_date = Column(Date, nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    attendances = relationship("Attendance", back_populates="athlete", cascade="all, delete-orphan")
    injuries = relationship("Injury", back_populates="athlete", cascade="all, delete-orphan")
    nutrition_plans = relationship("NutritionPlan", back_populates="athlete", cascade="all, delete-orphan")

