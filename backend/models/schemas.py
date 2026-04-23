from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict] = []


class DocumentInfo(BaseModel):
    id: str
    filename: str
    chunk_count: int
    upload_time: str


class DocumentListResponse(BaseModel):
    documents: list[DocumentInfo]


class ModelSettings(BaseModel):
    provider: str = "ollama"
    model: str = "deepseek-r1:8b"
    temperature: float = 0.7
    top_k: int = 5
