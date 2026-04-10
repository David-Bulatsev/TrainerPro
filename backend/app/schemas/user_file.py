from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


EntityType = Literal["athlete", "injury"]


class UserFileResponse(BaseModel):
    id: int
    entity_type: EntityType
    entity_id: int
    original_name: str
    content_type: Optional[str] = None
    size_bytes: int
    created_at: datetime
    download_url: Optional[str] = None

    class Config:
        from_attributes = True

