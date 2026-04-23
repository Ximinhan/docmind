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
