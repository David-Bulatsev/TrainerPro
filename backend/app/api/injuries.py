from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from app.database import get_db
from app.models.injury import Injury
from app.models.athlete import Athlete
from app.schemas.injury import InjuryCreate, InjuryUpdate, InjuryResponse
from app.core.rbac import require_permission, set_current_user
from app.schemas.pagination import PaginatedResponse

router = APIRouter(
    prefix="/injuries",
    tags=["injuries"],
    dependencies=[Depends(set_current_user)],
)


@router.get(
    "/",
    response_model=List[InjuryResponse],
    dependencies=[Depends(require_permission("injuries:read"))],
)
def get_injuries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    athlete_id: Optional[int] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список травм"""
    query = db.query(Injury)
    
    if athlete_id:
        query = query.filter(Injury.athlete_id == athlete_id)
    if severity:
        query = query.filter(Injury.severity == severity)
    if status:
        query = query.filter(Injury.status == status)
    
    injuries = query.order_by(Injury.date.desc()).offset(skip).limit(limit).all()
    return injuries


@router.get(
    "/paged",
    response_model=PaginatedResponse[InjuryResponse],
    dependencies=[Depends(require_permission("injuries:read"))],
)
def get_injuries_paged(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: str = Query("all", description="injury|condition|checkup|all"),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    sort: str = Query("date", description="date|id"),
    order: str = Query("desc", description="asc|desc"),
    db: Session = Depends(get_db),
):
    query = db.query(Injury).join(Athlete, Athlete.id == Injury.athlete_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Athlete.name.ilike(pattern)
            | Injury.description.ilike(pattern)
            | Injury.medical_notes.ilike(pattern)
        )

    # UI "type" is derived from Injury.status:
    # - condition: monitoring
    # - checkup: completed/recovered
    # - injury: active (and any other non-matching statuses)
    if type != "all":
        if type == "condition":
            query = query.filter(Injury.status == "monitoring")
        elif type == "checkup":
            query = query.filter(Injury.status.in_(["completed", "recovered"]))
        elif type == "injury":
            query = query.filter(~Injury.status.in_(["monitoring", "completed", "recovered"]))
        else:
            raise HTTPException(status_code=400, detail="Invalid type filter")

    if status and status != "all":
        query = query.filter(Injury.status == status)

    if severity and severity != "all":
        query = query.filter(Injury.severity == severity)

    allowed_sorts = {
        "date": Injury.date,
        "id": Injury.id,
    }
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid order direction")

    sort_expr = allowed_sorts[sort]
    sort_expr = sort_expr.desc() if order == "desc" else sort_expr.asc()
    query = query.order_by(sort_expr)

    total = query.count()
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    return PaginatedResponse[InjuryResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{injury_id}",
    response_model=InjuryResponse,
    dependencies=[Depends(require_permission("injuries:read"))],
)
def get_injury(injury_id: int, db: Session = Depends(get_db)):
    """Получить травму по ID"""
    injury = db.query(Injury).filter(Injury.id == injury_id).first()
    if not injury:
        raise HTTPException(status_code=404, detail="Injury not found")
    return injury


@router.post(
    "/",
    response_model=InjuryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("injuries:write"))],
)
def create_injury(injury: InjuryCreate, db: Session = Depends(get_db)):
    """Создать запись о травме"""
    # Проверка существования спортсмена
    from app.models.athlete import Athlete
    
    athlete = db.query(Athlete).filter(Athlete.id == injury.athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    db_injury = Injury(**injury.model_dump())
    db.add(db_injury)
    db.commit()
    db.refresh(db_injury)
    return db_injury


@router.put(
    "/{injury_id}",
    response_model=InjuryResponse,
    dependencies=[Depends(require_permission("injuries:write"))],
)
def update_injury(
    injury_id: int,
    injury: InjuryUpdate,
    db: Session = Depends(get_db)
):
    """Обновить запись о травме"""
    db_injury = db.query(Injury).filter(Injury.id == injury_id).first()
    if not db_injury:
        raise HTTPException(status_code=404, detail="Injury not found")
    
    update_data = injury.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_injury, field, value)
    
    db.commit()
    db.refresh(db_injury)
    return db_injury


@router.delete(
    "/{injury_id}",
    status_code=204,
    dependencies=[Depends(require_permission("injuries:write"))],
)
def delete_injury(injury_id: int, db: Session = Depends(get_db)):
    """Удалить запись о травме"""
    db_injury = db.query(Injury).filter(Injury.id == injury_id).first()
    if not db_injury:
        raise HTTPException(status_code=404, detail="Injury not found")
    
    db.delete(db_injury)
    db.commit()
    return None

