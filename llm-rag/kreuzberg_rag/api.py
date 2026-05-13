"""FastAPI endpoints for RAG service."""

import os
from typing import List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .document_processor import DocumentProcessor
from .embedder import Embedder
from .retriever import Retriever
from .coach_engine import CoachEngine


class QueryRequest(BaseModel):
    query: str
    context: Dict[str, Any] = {}


class BuildAdviceRequest(BaseModel):
    traits: List[str]
    pieces: List[Dict[str, Any]]


class CounterAdviceRequest(BaseModel):
    enemy_archetype: str
    enemy_pieces: List[Dict[str, str]]


class ItemAdviceRequest(BaseModel):
    piece_name: str
    role: str
    current_items: List[str] = []


class AdviceResponse(BaseModel):
    answer: str
    sources: List[str]
    retrieved_chunks: int


# Global instances
coach_engine: CoachEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize RAG pipeline on startup."""
    global coach_engine

    print("Initializing Kreuzberg RAG pipeline...")

    # 1. Process documents
    processor = DocumentProcessor()
    chunks = processor.process_all()
    print(f"Processed {len(chunks)} chunks from {len(processor.get_guide_names())} guide files")

    # 2. Generate embeddings
    embedder = Embedder()
    print(f"Loaded embedding model: {embedder.model}")

    # 3. Index for retrieval
    retriever = Retriever(embedder)
    retriever.index(chunks)
    print("Indexed chunks for retrieval")

    # 4. Create coach engine
    coach_engine = CoachEngine(retriever)
    print("RAG pipeline ready!")

    yield

    print("Shutting down RAG service...")


app = FastAPI(
    title="Creature Chess Tactical AI - RAG Service",
    description="RAG-powered tactical coach for Creature Chess",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.get("/health")
def health():
    return {"status": "ok", "rag_ready": coach_engine is not None}


@app.post("/query", response_model=AdviceResponse)
def query_rag(request: QueryRequest):
    result = coach_engine.query(request.query, request.context)
    return AdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
    )


@app.post("/build-advice", response_model=AdviceResponse)
def build_advice(request: BuildAdviceRequest):
    query = f"Gợi ý build team. Traits: {', '.join(request.traits)}. Pieces: {', '.join(p.get('name', '') for p in request.pieces)}"
    result = coach_engine.query(query, {"traits": request.traits, "pieces": request.pieces})
    return AdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
    )


@app.post("/counter-advice", response_model=AdviceResponse)
def counter_advice(request: CounterAdviceRequest):
    query = f"Counter đội hình {request.enemy_archetype}. Enemy: {', '.join(p.get('name', '') for p in request.enemy_pieces)}"
    result = coach_engine.query(query, {"enemyArchetype": request.enemy_archetype})
    return AdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
    )


@app.post("/item-advice", response_model=AdviceResponse)
def item_advice(request: ItemAdviceRequest):
    query = f"Gợi ý item cho {request.piece_name} (role: {request.role}). Current items: {', '.join(request.current_items) or 'none'}"
    result = coach_engine.query(query)
    return AdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
    )


def _stream_generator(query: str, context: Dict[str, Any]):
    for token in coach_engine.query_stream(query, context):
        yield token


@app.post("/query-stream")
def query_stream(request: QueryRequest):
    return StreamingResponse(
        _stream_generator(request.query, request.context),
        media_type="text/event-stream",
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("RAG_SERVICE_PORT", "8003"))
    uvicorn.run(app, host="0.0.0.0", port=port)
