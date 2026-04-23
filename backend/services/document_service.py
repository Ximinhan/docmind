import os
import uuid
from datetime import datetime, timezone

import chardet
import fitz  # pymupdf
from docx import Document as DocxDocument
from langchain.text_splitter import RecursiveCharacterTextSplitter

from config import settings

# In-memory document registry
_documents: dict[str, dict] = {}


def parse_file(file_path: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        doc = fitz.open(file_path)
        return "\n".join(page.get_text() for page in doc)
    elif ext == ".docx":
        doc = DocxDocument(file_path)
        return "\n".join(p.text for p in doc.paragraphs)
    elif ext in (".md", ".txt"):
        with open(file_path, "rb") as f:
            raw = f.read()
        encoding = chardet.detect(raw)["encoding"] or "utf-8"
        return raw.decode(encoding)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def split_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    return splitter.split_text(text)


def register_document(filename: str, chunk_count: int) -> str:
    doc_id = uuid.uuid4().hex[:12]
    _documents[doc_id] = {
        "id": doc_id,
        "filename": filename,
        "chunk_count": chunk_count,
        "upload_time": datetime.now(timezone.utc).isoformat(),
    }
    return doc_id


def list_documents() -> list[dict]:
    return list(_documents.values())


def get_document(doc_id: str) -> dict | None:
    return _documents.get(doc_id)


def remove_document(doc_id: str) -> bool:
    if doc_id in _documents:
        del _documents[doc_id]
        return True
    return False
