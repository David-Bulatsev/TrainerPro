from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, date, timedelta
import json
from app.database import get_db
from app.models.report import Report, ReportType
from app.models.attendance import Attendance, AttendanceStatus
from app.models.injury import Injury
from app.models.athlete import Athlete
from app.schemas.report import ReportResponse
from app.core.rbac import require_permission, set_current_user

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[ReportResponse],
    dependencies=[Depends(require_permission("reports:read"))],
)
def get_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    report_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список отчетов"""
    query = db.query(Report)
    
    if report_type:
        query = query.filter(Report.type == report_type)
    
    reports = query.order_by(Report.generated_date.desc()).offset(skip).limit(limit).all()
    return reports


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports:read"))],
)
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Получить отчет по ID"""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get(
    "/generate/{report_type}",
    response_model=ReportResponse,
    dependencies=[Depends(require_permission("reports:generate"))],
)
def generate_report(
    report_type: str,
    athlete_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Генерировать отчет по типу"""
    
    if report_type == ReportType.ATTENDANCE.value:
        return _generate_attendance_report(db, athlete_id, start_date, end_date)
    elif report_type == ReportType.INJURIES.value:
        return _generate_injuries_report(db, athlete_id, start_date, end_date)
    elif report_type == ReportType.PROGRESS.value:
        return _generate_progress_report(db, athlete_id, start_date, end_date)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")


def _generate_attendance_report(
    db: Session,
    athlete_id: Optional[int],
    start_date: Optional[date],
    end_date: Optional[date]
) -> Report:
    """Генерация отчета по посещаемости"""
    query = db.query(Attendance)
    
    if athlete_id:
        query = query.filter(Attendance.athlete_id == athlete_id)
    
    # Фильтр по дате через workout
    if start_date or end_date:
        from app.models.workout import Workout
        query = query.join(Workout)
        if start_date:
            query = query.filter(func.date(Workout.date) >= start_date)
        if end_date:
            query = query.filter(func.date(Workout.date) <= end_date)
    
    attendances = query.all()
    
    total = len(attendances)
    present = len([a for a in attendances if a.status == AttendanceStatus.PRESENT.value])
    absent = len([a for a in attendances if a.status == AttendanceStatus.ABSENT.value])
    late = len([a for a in attendances if a.status == AttendanceStatus.LATE.value])
    excused = len([a for a in attendances if a.status == AttendanceStatus.EXCUSED.value])
    
    attendance_rate = (present / total * 100) if total > 0 else 0
    
    data = {
        "total_workouts": total,
        "present": present,
        "absent": absent,
        "late": late,
        "excused": excused,
        "attendance_rate": round(attendance_rate, 2),
        "period": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }
    
    parameters = {
        "athlete_id": athlete_id,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None
    }
    
    report = Report(
        type=ReportType.ATTENDANCE.value,
        title=f"Attendance Report",
        data=json.dumps(data),
        parameters=json.dumps(parameters)
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def _generate_injuries_report(
    db: Session,
    athlete_id: Optional[int],
    start_date: Optional[date],
    end_date: Optional[date]
) -> Report:
    """Генерация отчета по травмам"""
    query = db.query(Injury)
    
    if athlete_id:
        query = query.filter(Injury.athlete_id == athlete_id)
    if start_date:
        query = query.filter(Injury.date >= start_date)
    if end_date:
        query = query.filter(Injury.date <= end_date)
    
    injuries = query.all()
    
    by_severity = {}
    for severity in ["minor", "moderate", "severe", "critical"]:
        by_severity[severity] = len([i for i in injuries if i.severity == severity])
    
    active = len([i for i in injuries if i.status == "active"])
    recovered = len([i for i in injuries if i.status == "recovered"])
    
    data = {
        "total_injuries": len(injuries),
        "by_severity": by_severity,
        "active": active,
        "recovered": recovered,
        "period": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }
    
    parameters = {
        "athlete_id": athlete_id,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None
    }
    
    report = Report(
        type=ReportType.INJURIES.value,
        title=f"Injuries Report",
        data=json.dumps(data),
        parameters=json.dumps(parameters)
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def _generate_progress_report(
    db: Session,
    athlete_id: Optional[int],
    start_date: Optional[date],
    end_date: Optional[date]
) -> Report:
    """Генерация отчета по прогрессу"""
    # Базовый отчет по прогрессу - можно расширить
    query = db.query(Athlete)
    
    if athlete_id:
        query = query.filter(Athlete.id == athlete_id)
    
    athletes = query.all()
    
    data = {
        "total_athletes": len(athletes),
        "athletes": [
            {
                "id": a.id,
                "name": a.name,
                "total_workouts": len(a.attendances),
                "total_injuries": len(a.injuries)
            }
            for a in athletes
        ],
        "period": {
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat() if end_date else None
        }
    }
    
    parameters = {
        "athlete_id": athlete_id,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None
    }
    
    report = Report(
        type=ReportType.PROGRESS.value,
        title=f"Progress Report",
        data=json.dumps(data),
        parameters=json.dumps(parameters)
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

