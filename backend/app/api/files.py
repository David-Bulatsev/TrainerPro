from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, Request
from sqlalchemy.orm import Session
from starlette import status
from app.database import get_db
from app.core.rbac import require_permission, set_current_user
from app.core.storage import StorageError, get_storage
from app.models import Athlete, Injury, UserFile
from app.schemas.user_file import EntityType, UserFileResponse


router = APIRouter(
    prefix="/files",
    tags=["files"],
    dependencies=[Depends(set_current_user)],
)


ALLOWED_EXTENSIONS = {
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "docx",
    "txt",
}


def _sanitize_filename(filename: str) -> str:
    filename = filename.strip().replace("\\", "/").split("/")[-1]
    # Keep it simple: replace whitespace and remove path chars.
    filename = "".join(ch for ch in filename if ch.isalnum() or ch in {".", "_", "-"}).strip()
    return filename or "file"


def _get_extension(filename: str) -> str:
    filename = filename.strip()
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def _validate_entity(entity_type: str, entity_id: int, db: Session) -> None:
    if entity_type == "athlete":
        exists = db.query(Athlete).filter(Athlete.id == entity_id).first()
    elif entity_type == "injury":
        exists = db.query(Injury).filter(Injury.id == entity_id).first()
    else:
        raise HTTPException(status_code=400, detail="Unsupported entity_type")

    if not exists:
        raise HTTPException(status_code=404, detail="Entity not found")


@router.post(
    "/upload",
    response_model=UserFileResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("files:write"))],
)
async def upload_file(
    request: Request,
    entity_type: EntityType = Form(...),
    entity_id: int = Form(..., ge=1),
    file: UploadFile = File(...),
    set_as_photo: bool = Form(False),
    db: Session = Depends(get_db),
):
    current_user = request.state.current_user
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename")

    ext = _get_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла: {ext or 'unknown'}",
        )

    # Read bytes to validate size and upload.
    content = await file.read()
    size_bytes = len(content)
    storage = get_storage()
    if size_bytes > storage.max_file_size_bytes:
        raise HTTPException(status_code=413, detail="File is too large")

    # Ensure attachment target exists.
    _validate_entity(entity_type, entity_id, db)

    object_key = f"user/{current_user.id}/{uuid.uuid4().hex}_{_sanitize_filename(file.filename)}"

    storage_client = storage
    try:
        storage_client.upload_bytes(
            key=object_key,
            content=content,
            content_type=file.content_type,
            content_length=size_bytes,
        )
    except StorageError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    db_file = UserFile(
        user_id=current_user.id,
        entity_type=entity_type,
        entity_id=entity_id,
        original_name=_sanitize_filename(file.filename),
        object_key=object_key,
        content_type=file.content_type,
        size_bytes=size_bytes,
    )
    db.add(db_file)
    try:
        db.commit()
        db.refresh(db_file)
    except Exception as e:
        # Best-effort cleanup if metadata insert fails.
        try:
            storage_client.delete_object(key=object_key)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to store file metadata") from e

    presigned = storage_client.generate_presigned_download_url(key=object_key)

    # Optionally set the uploaded file as the main athlete avatar.
    if set_as_photo and entity_type == "athlete":
        athlete = db.query(Athlete).filter(Athlete.id == entity_id).first()
        if athlete:
            old_key = athlete.photo
            athlete.photo = object_key
            try:
                db.add(athlete)
                db.commit()
                db.refresh(athlete)
            except Exception as e:
                raise HTTPException(status_code=500, detail="Failed to set avatar") from e

            # Best-effort cleanup of previous object_key.
            if old_key and isinstance(old_key, str) and not old_key.startswith("http") and old_key != object_key:
                try:
                    storage_client.delete_object(key=old_key)
                except Exception:
                    pass

    return UserFileResponse(
        id=db_file.id,
        entity_type=db_file.entity_type,  # type: ignore[arg-type]
        entity_id=db_file.entity_id,
        original_name=db_file.original_name,
        content_type=db_file.content_type,
        size_bytes=db_file.size_bytes,
        created_at=db_file.created_at,
        download_url=presigned.url,
    )


@router.get(
    "/",
    response_model=List[UserFileResponse],
    dependencies=[Depends(require_permission("files:read"))],
)
def list_files(
    request: Request,
    entity_type: EntityType = Query(...),
    entity_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    current_user = request.state.current_user
    storage_client = get_storage()
    files = (
        db.query(UserFile)
        .filter(UserFile.user_id == current_user.id, UserFile.entity_type == entity_type, UserFile.entity_id == entity_id)
        .order_by(UserFile.created_at.desc())
        .all()
    )

    result: List[UserFileResponse] = []
    for uf in files:
        presigned = storage_client.generate_presigned_download_url(key=uf.object_key)
        result.append(
            UserFileResponse(
                id=uf.id,
                entity_type=uf.entity_type,  # type: ignore[arg-type]
                entity_id=uf.entity_id,
                original_name=uf.original_name,
                content_type=uf.content_type,
                size_bytes=uf.size_bytes,
                created_at=uf.created_at,
                download_url=presigned.url,
            )
        )
    return result


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("files:write"))],
)
def delete_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    current_user = request.state.current_user
    storage_client = get_storage()
    uf = db.query(UserFile).filter(UserFile.id == file_id, UserFile.user_id == current_user.id).first()
    if not uf:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        storage_client.delete_object(key=uf.object_key)
    except StorageError:
        # If the object is already missing, we still remove metadata.
        pass

    db.delete(uf)
    db.commit()
    return None

