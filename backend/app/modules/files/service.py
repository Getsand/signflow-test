from uuid import uuid4

from app.core.storage import get_s3_client
from app.modules.files.repo import FileRepository
from app.modules.files.models import FileObject

# ---- Product rules (can move to constants later)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
}


class FileService:
    def __init__(self, repo: FileRepository):
        self.repo = repo
        self.s3 = get_s3_client()

    async def create_presigned_upload(
        self,
        *,
        user_id,
        filename: str,
        mime_type: str,
        size: int,
    ):
        # 1️⃣ Validate
        if size <= 0 or size > MAX_FILE_SIZE:
            raise ValueError("Invalid file size")

        if mime_type not in ALLOWED_MIME_TYPES:
            raise ValueError("Unsupported file type")

        # 2️⃣ Generate storage key (never trust filename alone)
        file_id = uuid4()
        storage_key = f"uploads/{file_id}/{filename}"

        # 3️⃣ Create DB record (PENDING)
        file_obj = FileObject(
            id=file_id,
            owner_id=user_id,
            filename=filename,
            mime_type=mime_type,
            size=size,
            storage_key=storage_key,
            status="pending",
        )

        await self.repo.create(file_obj)

        # 4️⃣ Generate presigned URL
        upload_url = self.s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": "signflow-documents",
                "Key": storage_key,
                "ContentType": mime_type,
            },
            ExpiresIn=900,  # 15 minutes
        )

        return {
            "upload_url": upload_url,
            "file_id": str(file_id),
            "storage_key": storage_key,
            "expires_in": 900,
        }
