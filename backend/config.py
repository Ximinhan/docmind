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
