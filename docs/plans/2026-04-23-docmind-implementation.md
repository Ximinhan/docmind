# DocMind Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a RAG knowledge base Q&A app with FastAPI + React + LangChain + ChromaDB + Ollama.

**Architecture:** FastAPI backend handles document upload/parsing/vectorization and RAG Q&A via LangChain. React frontend provides chat UI, document management, and settings. ChromaDB stores embeddings. Ollama runs local LLM with switchable provider interface. All services orchestrated via Docker Compose.

**Tech Stack:** Python 3.11, FastAPI, LangChain, ChromaDB, Ollama, React 18, TypeScript, Ant Design, Docker Compose

---

### Task 1: Backend Project Skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/models/schemas.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/models/__init__.py`

**Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
langchain==0.3.0
langchain-community==0.3.0
langchain-core==0.3.0
chromadb==0.5.0
httpx==0.27.0
python-docx==1.1.0
pymupdf==1.24.0
chardet==5.2.0
pydantic==2.9.0
pydantic-settings==2.5.0
```

**Step 2: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    chroma_host: str = "localhost"
    chroma_port: int = 8200
    ollama_host: str = "localhost"
    ollama_port: int = 11434
    default_model: str = "deepseek-r1:8b"
    embedding_model: str = "nomic-embed-text"
    upload_dir: str = "./uploads"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 5
    temperature: float = 0.7

    class Config:
        env_prefix = ""


settings = Settings()
```

**Step 3: Create models/schemas.py**

```python
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
```

**Step 4: Create main.py**

```python
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(title="DocMind", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**Step 5: Verify backend starts**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Visit http://localhost:8000/api/health -> {"status": "ok"}
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: backend project skeleton with FastAPI"
```

---

### Task 2: Document Upload & Parsing Service

**Files:**
- Create: `backend/services/document_service.py`
- Create: `backend/routers/documents.py`
- Modify: `backend/main.py` (add router)

**Step 1: Create document_service.py**

```python
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
```

**Step 2: Create routers/documents.py**

```python
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

        # TODO: Task 3 will add vectorization here

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

    # TODO: Task 3 will add vector deletion here

    remove_document(doc_id)
    return {"status": "deleted"}
```

**Step 3: Register router in main.py**

Add to main.py after CORS middleware:

```python
from routers import documents

app.include_router(documents.router)
```

**Step 4: Test manually**

```bash
# Upload a test file
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@test.txt"

# List documents
curl http://localhost:8000/api/documents
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: document upload, parsing, and management"
```

---

### Task 3: ChromaDB Vectorization

**Files:**
- Create: `backend/services/vector_service.py`
- Modify: `backend/routers/documents.py` (add vectorization on upload, deletion on delete)

**Step 1: Create vector_service.py**

```python
import chromadb
from langchain_community.embeddings import OllamaEmbeddings

from config import settings

_client: chromadb.HttpClient | None = None
_collection = None


def get_chroma_client():
    global _client, _collection
    if _client is None:
        _client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
        _collection = _client.get_or_create_collection(
            name="docmind",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def get_embeddings():
    return OllamaEmbeddings(
        model=settings.embedding_model,
        base_url=f"http://{settings.ollama_host}:{settings.ollama_port}",
    )


def add_chunks(doc_id: str, chunks: list[str], filename: str):
    collection = get_chroma_client()
    embeddings = get_embeddings()
    vectors = embeddings.embed_documents(chunks)

    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id, "filename": filename, "chunk_index": i} for i in range(len(chunks))]

    collection.add(
        ids=ids,
        embeddings=vectors,
        documents=chunks,
        metadatas=metadatas,
    )


def search_similar(query: str, top_k: int = None) -> list[dict]:
    collection = get_chroma_client()
    embeddings = get_embeddings()
    query_vector = embeddings.embed_query(query)
    k = top_k or settings.top_k

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=k,
    )

    docs = []
    for i in range(len(results["ids"][0])):
        docs.append({
            "content": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return docs


def delete_by_doc_id(doc_id: str):
    collection = get_chroma_client()
    collection.delete(where={"doc_id": doc_id})
```

**Step 2: Update routers/documents.py upload endpoint**

Replace the `# TODO: Task 3` comment in upload with:

```python
from services.vector_service import add_chunks

# Inside upload_document, after split_text:
add_chunks(doc_id, chunks, file.filename)
```

Replace the `# TODO: Task 3` comment in delete with:

```python
from services.vector_service import delete_by_doc_id

# Inside delete_document, before remove_document:
delete_by_doc_id(doc_id)
```

**Step 3: Pull embedding model in Ollama**

```bash
ollama pull nomic-embed-text
```

**Step 4: Test upload with vectorization**

```bash
# Start ChromaDB
docker run -d --name chromadb -p 8200:8000 chromadb/chroma:latest

# Upload and check vectorization works
curl -X POST http://localhost:8000/api/documents/upload -F "file=@test.txt"
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: ChromaDB vectorization on document upload"
```

---

### Task 4: RAG Chat Service

**Files:**
- Create: `backend/services/llm_provider.py`
- Create: `backend/services/chat_service.py`
- Create: `backend/routers/chat.py`
- Modify: `backend/main.py` (add router)

**Step 1: Create llm_provider.py**

```python
from langchain_community.chat_models import ChatOllama
from langchain_core.language_models import BaseChatModel

from config import settings

# Runtime settings (mutable)
_current_settings = {
    "provider": "ollama",
    "model": settings.default_model,
    "temperature": settings.temperature,
}


def get_llm() -> BaseChatModel:
    provider = _current_settings["provider"]
    model = _current_settings["model"]
    temperature = _current_settings["temperature"]

    if provider == "ollama":
        return ChatOllama(
            model=model,
            base_url=f"http://{settings.ollama_host}:{settings.ollama_port}",
            temperature=temperature,
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, temperature=temperature)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, temperature=temperature)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def get_current_settings() -> dict:
    return _current_settings.copy()


def update_settings(provider: str = None, model: str = None, temperature: float = None):
    if provider is not None:
        _current_settings["provider"] = provider
    if model is not None:
        _current_settings["model"] = model
    if temperature is not None:
        _current_settings["temperature"] = temperature
```

**Step 2: Create chat_service.py**

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from services.llm_provider import get_llm
from services.vector_service import search_similar
from config import settings

SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on the provided documents.
Use the following context to answer the question. If the answer is not in the context, say so honestly.
Always cite which document the information comes from.

Context:
{context}
"""


def build_context(docs: list[dict]) -> str:
    parts = []
    for i, doc in enumerate(docs):
        source = doc["metadata"]["filename"]
        parts.append(f"[Source: {source}, Chunk {doc['metadata']['chunk_index']}]\n{doc['content']}")
    return "\n\n---\n\n".join(parts)


def ask(question: str, history: list[dict] = None, top_k: int = None) -> dict:
    k = top_k or settings.top_k
    relevant_docs = search_similar(question, top_k=k)

    if not relevant_docs:
        return {"answer": "No relevant documents found. Please upload some documents first.", "sources": []}

    context = build_context(relevant_docs)

    messages = [("system", SYSTEM_PROMPT)]
    if history:
        for msg in history[-6:]:  # Keep last 6 messages for context
            messages.append((msg["role"], msg["content"]))
    messages.append(("human", "{question}"))

    prompt = ChatPromptTemplate.from_messages(messages)
    chain = prompt | get_llm() | StrOutputParser()

    answer = chain.invoke({"context": context, "question": question})

    sources = [
        {"filename": doc["metadata"]["filename"], "chunk_index": doc["metadata"]["chunk_index"]}
        for doc in relevant_docs
    ]

    return {"answer": answer, "sources": sources}


async def ask_stream(question: str, history: list[dict] = None, top_k: int = None):
    k = top_k or settings.top_k
    relevant_docs = search_similar(question, top_k=k)

    if not relevant_docs:
        yield {"type": "answer", "content": "No relevant documents found."}
        yield {"type": "sources", "content": []}
        return

    context = build_context(relevant_docs)

    messages = [("system", SYSTEM_PROMPT)]
    if history:
        for msg in history[-6:]:
            messages.append((msg["role"], msg["content"]))
    messages.append(("human", "{question}"))

    prompt = ChatPromptTemplate.from_messages(messages)
    chain = prompt | get_llm()

    async for chunk in chain.astream({"context": context, "question": question}):
        yield {"type": "answer", "content": chunk.content}

    sources = [
        {"filename": doc["metadata"]["filename"], "chunk_index": doc["metadata"]["chunk_index"]}
        for doc in relevant_docs
    ]
    yield {"type": "sources", "content": sources}
```

**Step 3: Create routers/chat.py**

```python
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from models.schemas import ChatRequest, ChatResponse
from services.chat_service import ask, ask_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    result = ask(req.question, req.history)
    return ChatResponse(**result)


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    async def event_generator():
        async for chunk in ask_stream(req.question, req.history):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Step 4: Register router in main.py**

```python
from routers import documents, chat

app.include_router(documents.router)
app.include_router(chat.router)
```

**Step 5: Test chat**

```bash
# Upload a document first, then:
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this document about?"}'
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: RAG chat with LangChain + Ollama + streaming"
```

---

### Task 5: Settings Router

**Files:**
- Create: `backend/routers/settings.py`
- Modify: `backend/main.py` (add router)

**Step 1: Create routers/settings.py**

```python
import httpx
from fastapi import APIRouter

from config import settings
from models.schemas import ModelSettings
from services.llm_provider import get_current_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/models")
async def get_models():
    current = get_current_settings()
    available_models = []
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://{settings.ollama_host}:{settings.ollama_port}/api/tags"
            )
            if resp.status_code == 200:
                for model in resp.json().get("models", []):
                    available_models.append(model["name"])
    except Exception:
        pass

    return {
        "current": current,
        "available_models": available_models,
    }


@router.put("/models")
async def set_model(req: ModelSettings):
    update_settings(
        provider=req.provider,
        model=req.model,
        temperature=req.temperature,
    )
    return {"status": "updated", "settings": get_current_settings()}
```

**Step 2: Register in main.py**

```python
from routers import documents, chat, settings

app.include_router(settings.router)
```

**Step 3: Commit**

```bash
git add backend/
git commit -m "feat: settings router for model switching"
```

---

### Task 6: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: backend Dockerfile"
```

---

### Task 7: React Frontend Setup

**Files:**
- Create: `frontend/` via create-react-app with TypeScript
- Create: `frontend/src/services/api.ts`

**Step 1: Create React app**

```bash
cd /path/to/docmind
npx create-react-app frontend --template typescript
cd frontend
npm install antd @ant-design/icons
```

**Step 2: Create frontend/src/services/api.ts**

```typescript
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export interface DocumentInfo {
  id: string;
  filename: string;
  chunk_count: number;
  upload_time: string;
}

export interface ChatMessage {
  role: "human" | "assistant";
  content: string;
  sources?: { filename: string; chunk_index: number }[];
}

export interface ModelSettings {
  provider: string;
  model: string;
  temperature: number;
  top_k: number;
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/api/documents`);
  const data = await res.json();
  return data.documents;
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/documents/${id}`, { method: "DELETE" });
}

export async function chatStream(
  question: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
  onSources: (sources: { filename: string; chunk_index: number }[]) => void,
  onDone: () => void
) {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          onDone();
          return;
        }
        const parsed = JSON.parse(data);
        if (parsed.type === "answer") {
          onChunk(parsed.content);
        } else if (parsed.type === "sources") {
          onSources(parsed.content);
        }
      }
    }
  }
  onDone();
}

export async function getModelSettings() {
  const res = await fetch(`${API_BASE}/api/settings/models`);
  return res.json();
}

export async function updateModelSettings(settings: ModelSettings) {
  const res = await fetch(`${API_BASE}/api/settings/models`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.json();
}
```

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: React frontend setup with API service"
```

---

### Task 8: Frontend Pages - Navbar + ChatPage

**Files:**
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/src/components/ChatMessage.tsx`
- Create: `frontend/src/pages/ChatPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create Navbar.tsx**

```tsx
import React from "react";
import { Layout, Menu } from "antd";
import {
  MessageOutlined,
  FileOutlined,
  SettingOutlined,
} from "@ant-design/icons";

const { Header } = Layout;

interface NavbarProps {
  current: string;
  onChange: (key: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ current, onChange }) => {
  const items = [
    { key: "chat", icon: <MessageOutlined />, label: "Chat" },
    { key: "documents", icon: <FileOutlined />, label: "Documents" },
    { key: "settings", icon: <SettingOutlined />, label: "Settings" },
  ];

  return (
    <Header style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          marginRight: 40,
        }}
      >
        DocMind
      </div>
      <Menu
        theme="dark"
        mode="horizontal"
        selectedKeys={[current]}
        items={items}
        onClick={(e) => onChange(e.key)}
        style={{ flex: 1 }}
      />
    </Header>
  );
};

export default Navbar;
```

**Step 2: Create ChatMessage.tsx**

```tsx
import React from "react";
import { Tag, Typography } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface ChatMessageProps {
  role: "human" | "assistant";
  content: string;
  sources?: { filename: string; chunk_index: number }[];
  streaming?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  sources,
  streaming,
}) => {
  const isUser = role === "human";

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 0",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: isUser ? "#1677ff" : "#52c41a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {isUser ? <UserOutlined /> : <RobotOutlined />}
      </div>
      <div
        style={{
          maxWidth: "70%",
          background: isUser ? "#1677ff" : "#f0f0f0",
          color: isUser ? "#fff" : "#000",
          padding: "10px 16px",
          borderRadius: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        {content}
        {streaming && <span className="cursor-blink">|</span>}
        {sources && sources.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {sources.map((s, i) => (
              <Tag key={i} color="blue">
                {s.filename} #{s.chunk_index}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
```

**Step 3: Create ChatPage.tsx**

```tsx
import React, { useState, useRef, useEffect } from "react";
import { Input, Button, Space, Empty } from "antd";
import { SendOutlined } from "@ant-design/icons";
import ChatMessageComponent from "../components/ChatMessage";
import { chatStream, ChatMessage } from "../services/api";

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    const userMsg: ChatMessage = { role: "human", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      sources: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    await chatStream(
      question,
      messages,
      (text) => {
        assistantMsg.content += text;
        setMessages((prev) => [...prev.slice(0, -1), { ...assistantMsg }]);
      },
      (sources) => {
        assistantMsg.sources = sources;
        setMessages((prev) => [...prev.slice(0, -1), { ...assistantMsg }]);
      },
      () => {
        setLoading(false);
      }
    );
  };

  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflow: "auto", padding: "20px 40px" }}>
        {messages.length === 0 && (
          <Empty
            description="Upload documents and start asking questions"
            style={{ marginTop: 100 }}
          />
        )}
        {messages.map((msg, i) => (
          <ChatMessageComponent
            key={i}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
            streaming={loading && i === messages.length - 1 && msg.role === "assistant"}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "16px 40px", borderTop: "1px solid #f0f0f0" }}>
        <Space.Compact style={{ width: "100%" }}>
          <Input
            size="large"
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            disabled={loading}
          />
          <Button
            type="primary"
            size="large"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
          >
            Send
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
};

export default ChatPage;
```

**Step 4: Update App.tsx**

```tsx
import React, { useState } from "react";
import { Layout } from "antd";
import Navbar from "./components/Navbar";
import ChatPage from "./pages/ChatPage";

const { Content } = Layout;

const App: React.FC = () => {
  const [page, setPage] = useState("chat");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Navbar current={page} onChange={setPage} />
      <Content>
        {page === "chat" && <ChatPage />}
        {page === "documents" && <div>Documents (Task 9)</div>}
        {page === "settings" && <div>Settings (Task 10)</div>}
      </Content>
    </Layout>
  );
};

export default App;
```

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: chat page with streaming response"
```

---

### Task 9: Frontend - Documents Page

**Files:**
- Create: `frontend/src/components/FileUploader.tsx`
- Create: `frontend/src/pages/DocumentsPage.tsx`
- Modify: `frontend/src/App.tsx` (replace placeholder)

**Step 1: Create FileUploader.tsx**

```tsx
import React from "react";
import { Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { uploadDocument } from "../services/api";

const { Dragger } = Upload;

interface FileUploaderProps {
  onUploadSuccess: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess }) => {
  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      await uploadDocument(file);
      onSuccess(null, file);
      message.success(`${file.name} uploaded successfully`);
      onUploadSuccess();
    } catch (err: any) {
      onError(err);
      message.error(`${file.name} upload failed: ${err.message}`);
    }
  };

  return (
    <Dragger
      customRequest={handleUpload}
      multiple
      accept=".pdf,.docx,.md,.txt"
      showUploadList={false}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Click or drag files to upload</p>
      <p className="ant-upload-hint">
        Supports PDF, Word, Markdown, TXT
      </p>
    </Dragger>
  );
};

export default FileUploader;
```

**Step 2: Create DocumentsPage.tsx**

```tsx
import React, { useEffect, useState } from "react";
import { Table, Button, Popconfirm, message } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import FileUploader from "../components/FileUploader";
import { getDocuments, deleteDocument, DocumentInfo } from "../services/api";

const DocumentsPage: React.FC = () => {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    const data = await getDocuments();
    setDocs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    message.success("Document deleted");
    fetchDocs();
  };

  const columns = [
    { title: "Filename", dataIndex: "filename", key: "filename" },
    { title: "Chunks", dataIndex: "chunk_count", key: "chunk_count" },
    {
      title: "Upload Time",
      dataIndex: "upload_time",
      key: "upload_time",
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: DocumentInfo) => (
        <Popconfirm
          title="Delete this document?"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button danger icon={<DeleteOutlined />} size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <FileUploader onUploadSuccess={fetchDocs} />
      <Table
        columns={columns}
        dataSource={docs}
        rowKey="id"
        loading={loading}
        style={{ marginTop: 24 }}
        pagination={false}
      />
    </div>
  );
};

export default DocumentsPage;
```

**Step 3: Update App.tsx**

Replace `{page === "documents" && <div>Documents (Task 9)</div>}` with:

```tsx
import DocumentsPage from "./pages/DocumentsPage";

{page === "documents" && <DocumentsPage />}
```

**Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: documents page with upload and management"
```

---

### Task 10: Frontend - Settings Page

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/App.tsx` (replace placeholder)

**Step 1: Create SettingsPage.tsx**

```tsx
import React, { useEffect, useState } from "react";
import { Form, Select, Slider, Button, Card, message } from "antd";
import { getModelSettings, updateModelSettings } from "../services/api";

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getModelSettings();
      setModels(data.available_models || []);
      form.setFieldsValue(data.current);
    };
    load();
  }, [form]);

  const handleSave = async () => {
    setLoading(true);
    const values = form.getFieldsValue();
    await updateModelSettings(values);
    message.success("Settings updated");
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <Card title="Model Settings">
        <Form form={form} layout="vertical">
          <Form.Item label="Provider" name="provider">
            <Select>
              <Select.Option value="ollama">Ollama (Local)</Select.Option>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Model" name="model">
            <Select>
              {models.map((m) => (
                <Select.Option key={m} value={m}>
                  {m}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Temperature" name="temperature">
            <Slider min={0} max={1} step={0.1} />
          </Form.Item>

          <Form.Item label="Top-K Chunks" name="top_k">
            <Slider min={1} max={20} step={1} />
          </Form.Item>

          <Button type="primary" onClick={handleSave} loading={loading}>
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default SettingsPage;
```

**Step 2: Update App.tsx**

Replace settings placeholder with:

```tsx
import SettingsPage from "./pages/SettingsPage";

{page === "settings" && <SettingsPage />}
```

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: settings page for model configuration"
```

---

### Task 11: Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

**Step 1: Create nginx.conf**

```nginx
server {
    listen 3000;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }
}
```

**Step 2: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
```

**Step 3: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: frontend Dockerfile with nginx"
```

---

### Task 12: Docker Compose + README

**Files:**
- Create: `docker-compose.yml`
- Create: `README.md`

**Step 1: Create docker-compose.yml**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - upload_data:/app/uploads
    environment:
      - CHROMA_HOST=chromadb
      - CHROMA_PORT=8200
      - OLLAMA_HOST=ollama
      - OLLAMA_PORT=11434
      - DEFAULT_MODEL=deepseek-r1:8b
    depends_on:
      - chromadb
      - ollama

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8200:8000"
    volumes:
      - chroma_data:/chroma/chroma

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  upload_data:
  chroma_data:
  ollama_data:
```

**Step 2: Create README.md**

```markdown
# DocMind

RAG knowledge base Q&A system built with FastAPI + React + LangChain + ChromaDB + Ollama.

Upload PDF/Word/Markdown/TXT documents and ask questions against them.

## Quick Start

\`\`\`bash
docker compose up -d
docker compose exec ollama ollama pull deepseek-r1:8b
docker compose exec ollama ollama pull nomic-embed-text
\`\`\`

Open http://localhost:3000

## Tech Stack

- **Backend:** FastAPI, LangChain, Python 3.11
- **Frontend:** React 18, TypeScript, Ant Design
- **Vector DB:** ChromaDB
- **LLM:** Ollama (switchable to OpenAI/Claude)
- **Deployment:** Docker Compose

## Development

\`\`\`bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
\`\`\`
```

**Step 3: Commit**

```bash
git add docker-compose.yml README.md
git commit -m "feat: Docker Compose orchestration and README"
```
