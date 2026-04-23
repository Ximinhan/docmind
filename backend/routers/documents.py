import os
import shutil

from fastapi import APIRouter, File, UploadFile, HTTPException

from config import settings
from models.schemas import DocumentInfo, DocumentListResponse
from services.document_service import (
    parse_file,
    split_text,
    register_document,
    list_documents,
    remove_document,
    get_document,
)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)):
    allowed_ext = {".pdf", ".docx", ".md", ".txt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    file_path = os.path.join(settings.upload_dir, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        text = parse_file(file_path, file.filename)
        chunks = split_text(text)
        doc_id = register_document(file.filename, len(chunks))

        from services.vector_service import add_chunks
        add_chunks(doc_id, chunks, file.filename)

        doc = get_document(doc_id)
        return DocumentInfo(**doc)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(500, str(e))


@router.get("", response_model=DocumentListResponse)
async def get_documents():
    return DocumentListResponse(documents=list_documents())


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    doc = get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = os.path.join(settings.upload_dir, doc["filename"])
    if os.path.exists(file_path):
        os.remove(file_path)

    from services.vector_service import delete_by_doc_id
    delete_by_doc_id(doc_id)

    remove_document(doc_id)
    return {"status": "deleted"}
