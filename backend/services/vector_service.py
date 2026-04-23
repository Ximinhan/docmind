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
