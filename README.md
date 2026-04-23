# DocMind

RAG knowledge base Q&A system built with FastAPI + React + LangChain + ChromaDB + Ollama.

Upload PDF/Word/Markdown/TXT documents and ask questions against them.

## Quick Start

```bash
docker compose up -d
docker compose exec ollama ollama pull deepseek-r1:8b
docker compose exec ollama ollama pull nomic-embed-text
```

Open http://localhost:3000

## Tech Stack

- **Backend:** FastAPI, LangChain, Python 3.11
- **Frontend:** React 18, TypeScript, Ant Design
- **Vector DB:** ChromaDB
- **LLM:** Ollama (switchable to OpenAI/Claude)
- **Deployment:** Docker Compose

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```
