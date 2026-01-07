from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class FilePresignRequest(BaseModel):
    filename: str
    mime_type: str
    size: int


class FilePresignResponse(BaseModel):
    upload_url: str
    storage_key: str


class FileCompleteRequest(BaseModel):
    storage_key: str = Field(..., example="uploads/test.txt")
    filename: str
    mime_type: str
    size: int


class FileRead(BaseModel):
    id: UUID
    filename: str
    mime_type: str
    size: int
    created_at: datetime

    class Config:
        from_attributes = True



from pydantic import BaseModel, Field


class PresignRequest(BaseModel):
    filename: str = Field(..., example="test.txt")
    mime_type: str = Field(..., example="text/plain")
    size: int = Field(..., gt=0)


class PresignResponse(BaseModel):
    upload_url: str
    storage_key: str
    expires_in: int
