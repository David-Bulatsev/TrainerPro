from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate, AttendanceResponse
from app.core.rbac import require_permission, set_current_user

router = APIRouter(
    prefix="/attendance",
    tags=["attendance"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[AttendanceResponse],
    dependencies=[Depends(require_permission("attendance:read"))],
)
def get_attendances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    athlete_id: Optional[int] = None,
    workout_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список отметок посещений"""
    query = db.query(Attendance)
    
    if athlete_id:
        query = query.filter(Attendance.athlete_id == athlete_id)
    if workout_id:
        query = query.filter(Attendance.workout_id == workout_id)
    if status:
        query = query.filter(Attendance.status == status)
    
    attendances = query.offset(skip).limit(limit).all()
    return attendances


@router.get(
    "/{attendance_id}",
    response_model=AttendanceResponse,
    dependencies=[Depends(require_permission("attendance:read"))],
)
def get_attendance(attendance_id: int, db: Session = Depends(get_db)):
    """Получить отметку посещения по ID"""
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    return attendance


@router.post(
    "/",
    response_model=AttendanceResponse,
    status_code=201,
    dependencies=[Depends(require_permission("attendance:write"))],
)
def create_attendance(attendance: AttendanceCreate, db: Session = Depends(get_db)):
    """Создать отметку посещения"""
    # Проверка существования спортсмена и тренировки
    from app.models.athlete import Athlete
    from app.models.workout import Workout
    
    athlete = db.query(Athlete).filter(Athlete.id == attendance.athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    workout = db.query(Workout).filter(Workout.id == attendance.workout_id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    # Проверка на дубликат
    existing = db.query(Attendance).filter(
        Attendance.athlete_id == attendance.athlete_id,
        Attendance.workout_id == attendance.workout_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Attendance already exists for this athlete and workout")
    
    db_attendance = Attendance(**attendance.model_dump())
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)
    return db_attendance


@router.put(
    "/{attendance_id}",
    response_model=AttendanceResponse,
    dependencies=[Depends(require_permission("attendance:write"))],
)
def update_attendance(
    attendance_id: int,
    attendance: AttendanceUpdate,
    db: Session = Depends(get_db)
):
    """Обновить отметку посещения"""
    db_attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not db_attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    
    update_data = attendance.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_attendance, field, value)
    
    db.commit()
    db.refresh(db_attendance)
    return db_attendance


@router.delete(
    "/{attendance_id}",
    status_code=204,
    dependencies=[Depends(require_permission("attendance:write"))],
)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    """Удалить отметку посещения"""
    db_attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not db_attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    
    db.delete(db_attendance)
    db.commit()
    return None

