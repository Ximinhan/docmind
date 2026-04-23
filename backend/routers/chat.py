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
