from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func

from app.database import get_db
from app.models.athlete import Athlete
from app.schemas.athlete import AthleteCreate, AthleteUpdate, AthleteResponse
from app.core.rbac import require_permission, set_current_user
from app.schemas.pagination import PaginatedResponse
from app.core.storage import StorageError, get_storage


def _maybe_presign_athlete_photos(athletes: list[Athlete]) -> None:
    """
    If Athlete.photo contains an object_key, replace it with a pre-signed URL.
    We keep failures non-fatal (e.g., misconfigured S3).
    """

    if not athletes:
        return

    try:
        storage = get_storage()
    except StorageError:
        return

    for athlete in athletes:
        if not athlete.photo:
            continue
        # If backend already returned a URL, don't re-presign.
        if isinstance(athlete.photo, str) and athlete.photo.startswith("http"):
            continue
        try:
            athlete.photo = storage.generate_presigned_download_url(key=athlete.photo).url
        except Exception:
            # Don't break the list if a single file failed to presign.
            continue

router = APIRouter(
    prefix="/athletes",
    tags=["athletes"],
    dependencies=[Depends(set_current_user)],
)


def _compact_contact_info_expr():
    """Normalize contact_info JSON text for cross-database text filtering."""
    expr = func.coalesce(Athlete.contact_info, "")
    expr = func.replace(expr, " ", "")
    expr = func.replace(expr, "\n", "")
    expr = func.replace(expr, "\r", "")
    expr = func.replace(expr, "\t", "")
    return expr


def _json_text_contains(field: str, value: str):
    normalized_value = value.replace(" ", "")
    return _compact_contact_info_expr().ilike(f'%"{field}":"{normalized_value}"%')


@router.get(
    "/",
    response_model=List[AthleteResponse],
    dependencies=[Depends(require_permission("athletes:read"))],
)
def get_athletes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Получить список спортсменов"""
    query = db.query(Athlete)
    
    if search:
        query = query.filter(Athlete.name.ilike(f"%{search}%"))
    
    athletes = query.offset(skip).limit(limit).all()
    _maybe_presign_athlete_photos(athletes)
    return athletes


@router.get(
    "/paged",
    response_model=PaginatedResponse[AthleteResponse],
    dependencies=[Depends(require_permission("athletes:read"))],
)
def get_athletes_paged(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sport: Optional[str] = None,
    status: Optional[str] = None,
    sort: str = Query("name", description="name|birth_date|created_at|id"),
    order: str = Query("asc", description="asc|desc"),
    db: Session = Depends(get_db),
):
    query = db.query(Athlete)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Athlete.name.ilike(pattern)
            | Athlete.contact_info.ilike(pattern)
        )

    if sport and sport != "all":
        query = query.filter(_json_text_contains("sport", sport))

    if status and status != "all":
        query = query.filter(_json_text_contains("status", status))

    allowed_sorts = {
        "name": Athlete.name,
        "birth_date": Athlete.birth_date,
        "created_at": Athlete.created_at,
        "id": Athlete.id,
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
    _maybe_presign_athlete_photos(items)

    return PaginatedResponse[AthleteResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{athlete_id}",
    response_model=AthleteResponse,
    dependencies=[Depends(require_permission("athletes:read"))],
)
def get_athlete(athlete_id: int, db: Session = Depends(get_db)):
    """Получить спортсмена по ID"""
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    _maybe_presign_athlete_photos([athlete])
    return athlete


@router.post(
    "/",
    response_model=AthleteResponse,
    status_code=201,
    dependencies=[Depends(require_permission("athletes:write"))],
)
def create_athlete(athlete: AthleteCreate, db: Session = Depends(get_db)):
    """Создать нового спортсмена"""
    db_athlete = Athlete(**athlete.model_dump())
    db.add(db_athlete)
    db.commit()
    db.refresh(db_athlete)
    return db_athlete


@router.put(
    "/{athlete_id}",
    response_model=AthleteResponse,
    dependencies=[Depends(require_permission("athletes:write"))],
)
def update_athlete(
    athlete_id: int,
    athlete: AthleteUpdate,
    db: Session = Depends(get_db)
):
    """Обновить данные спортсмена"""
    db_athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not db_athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    update_data = athlete.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_athlete, field, value)
    
    db.commit()
    db.refresh(db_athlete)
    return db_athlete


@router.delete(
    "/{athlete_id}",
    status_code=204,
    dependencies=[Depends(require_permission("athletes:write"))],
)
def delete_athlete(athlete_id: int, db: Session = Depends(get_db)):
    """Удалить спортсмена"""
    db_athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not db_athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    db.delete(db_athlete)
    db.commit()
    return None
