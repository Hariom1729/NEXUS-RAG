"""Serves generated files (xlsx/csv/docx/pdf) to authenticated users."""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from core.security import get_current_user
from generation.file_builder import GENERATED_DIR

router = APIRouter(prefix="/files", tags=["files"])

MEDIA = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
}


@router.get("/{filename}")
async def get_file(filename: str, user: dict = Depends(get_current_user)):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(GENERATED_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    ext = os.path.splitext(filename)[1].lower()
    nice = filename.split("_", 1)[1] if "_" in filename else filename
    return FileResponse(path, media_type=MEDIA.get(ext, "application/octet-stream"), filename=nice)
