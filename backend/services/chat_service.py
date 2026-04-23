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
