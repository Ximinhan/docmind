# DocMind - RAG Knowledge Base Q&A System

## Overview

DocMind is a RAG (Retrieval-Augmented Generation) knowledge base Q&A system that allows users to upload documents (PDF/Word/Markdown/TXT) and ask questions against them. Built with FastAPI + React + LangChain + ChromaDB + Ollama.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    DocMind                           │
│                                                     │
│  ┌──────────┐    HTTP     ┌──────────────────────┐  │
│  │  React   │◄──────────►│     FastAPI           │  │
│  │ Frontend │   REST API  │     Backend           │  │
│  │ :3000    │             │     :8000             │  │
│  └──────────┘             └──────┬───────────────┘  │
│                                  │                   │
│                    ┌─────────────┼─────────────┐     │
│                    │             │             │     │
│               ┌────▼────┐ ┌─────▼─────┐ ┌────▼───┐ │
│               │LangChain│ │ ChromaDB  │ │ Ollama │ │
│               │ (chain) │ │ (vectors) │ │ (LLM)  │ │
│               │         │ │  :8200    │ │ :11434 │ │
│               └─────────┘ └───────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
```

Four services orchestrated via Docker Compose:
1. **frontend** - React app for document upload and chat
2. **backend** - FastAPI handling file processing, vectorization, and Q&A
3. **chromadb** - Vector database storing document embeddings
4. **ollama** - Local LLM inference (with switchable OpenAI/Claude interface)

## API Design

```
POST /api/documents/upload     - Upload documents (PDF/Word/Markdown/TXT)
GET  /api/documents            - List uploaded documents
DELETE /api/documents/{id}     - Delete document and its vectors

POST /api/chat                 - Send question, return RAG answer
  Request:  { "question": "...", "history": [...] }
  Response: { "answer": "...", "sources": [...] }

POST /api/chat/stream          - Streaming answer (SSE)

GET  /api/health               - Health check
GET  /api/settings/models      - List available LLM models
PUT  /api/settings/models      - Switch LLM model
```

### Core Data Flow (Q&A)

```
User question
  → 1. Embed question via embedding model
  → 2. Similarity search in ChromaDB (top-k chunks)
  → 3. Compose prompt: question + relevant chunks + chat history
  → 4. LLM generates answer with source references
  → 5. Return to frontend
```

## Frontend Design

React 18 + TypeScript + Ant Design

Three pages:
- **Chat Page** (home) - Chat interface with streaming responses and source citations
- **Documents Page** - Upload, list, delete documents with chunk count display
- **Settings Page** - Switch LLM provider/model, adjust temperature and top-k

## Project Structure

```
docmind/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── documents.py
│   │   ├── chat.py
│   │   └── settings.py
│   ├── services/
│   │   ├── document_service.py
│   │   ├── chat_service.py
│   │   └── llm_provider.py
│   ├── models/
│   │   └── schemas.py
│   └── tests/
│       ├── test_documents.py
│       └── test_chat.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── ChatPage.tsx
│       │   ├── DocumentsPage.tsx
│       │   └── SettingsPage.tsx
│       ├── components/
│       │   ├── ChatMessage.tsx
│       │   ├── FileUploader.tsx
│       │   └── Navbar.tsx
│       └── services/
│           └── api.ts
└── docs/
    └── plans/
        └── 2026-04-23-docmind-design.md
```

## Key Design Decisions

- **llm_provider.py** - Abstraction layer with unified interface. Switching LLM only requires config change, no code change
- **Backend**: routers / services / models three-layer separation
- **Frontend**: pages / components / services standard React structure
- **ChromaDB** - Zero-config, built-in persistence, great LangChain integration
- **Docker Compose** - One-command startup: `docker compose up -d`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Ant Design |
| Backend | FastAPI, Python 3.11, LangChain |
| Vector DB | ChromaDB |
| LLM | Ollama (default), OpenAI/Claude (switchable) |
| Streaming | Server-Sent Events (SSE) |
| Deployment | Docker Compose |

## Quick Start

```bash
git clone <repo>
cd docmind
docker compose up -d
docker compose exec ollama ollama pull llama3
# Open http://localhost:3000
```
