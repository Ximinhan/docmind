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
