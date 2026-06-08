"""FastAPI endpoints for RAG service."""

import json
import os
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .document_processor import DocumentProcessor
from .embedder import Embedder
from .retriever import Retriever
from .coach_engine import CoachEngine
from .agent_engine import AgentEngine
from .conversation_memory import ConversationMemory


class QueryRequest(BaseModel):
    query: str
    context: Dict[str, Any] = {}


class AgentRequest(BaseModel):
    query: str
    context: Dict[str, Any] = {}
    session_id: Optional[str] = None
    smalltalk: bool = False


class AgentActionMemoryRequest(BaseModel):
    session_id: str
    query: str = ""
    tool: str
    args: Dict[str, Any] = {}


class AgentPlanResponse(BaseModel):
    tool: str
    clientAction: Optional[str] = None
    args: Dict[str, Any] = {}
    reason: str = ""
    smalltalk: bool = False
    needs: List[str] = []


class BuildAdviceRequest(BaseModel):
    query: str = ""
    context: Dict[str, Any] = {}


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


class BuildAdviceResponse(AdviceResponse):
    plan: Optional[Dict[str, Any]] = None


# Global instances
coach_engine: CoachEngine = None
agent_engine: AgentEngine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize RAG pipeline on startup."""
    global coach_engine, agent_engine

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

    # 5. Create agent engine (routing + agentic RAG + conversation memory)
    agent_engine = AgentEngine(coach_engine, ConversationMemory())
    print("RAG + Agent pipeline ready!")

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
    return {
        "status": "ok",
        "rag_ready": coach_engine is not None,
        "agent_ready": agent_engine is not None,
    }


@app.post("/agent", response_model=AgentPlanResponse)
def agent_plan(request: AgentRequest):
    """Route a free-form message to the right tool (intent detection)."""
    plan = agent_engine.plan(
        request.query, request.context, session_id=request.session_id
    )
    return AgentPlanResponse(
        tool=plan["tool"],
        clientAction=plan.get("clientAction"),
        args=plan.get("args", {}),
        reason=plan.get("reason", ""),
        smalltalk=plan.get("smalltalk", False),
        needs=plan.get("needs", []),
    )


@app.post("/agent-stream")
def agent_stream(request: AgentRequest):
    """Stream a general-knowledge answer using agentic RAG (with re-query)."""
    def _gen():
        try:
            for token in agent_engine.answer_stream(
                request.query, request.context,
                session_id=request.session_id, smalltalk=request.smalltalk,
            ):
                yield token
        except Exception as e:
            yield f"\n\n[Lỗi xử lý: {str(e)}]"

    return StreamingResponse(_gen(), media_type="text/event-stream")


@app.post("/agent-action-memory")
def agent_action_memory(request: AgentActionMemoryRequest):
    """Record that a client-side action tool ran, for follow-up context."""
    agent_engine.record_action(
        request.session_id, request.query, request.tool, request.args
    )
    return {"status": "ok"}


@app.post("/query", response_model=AdviceResponse)
def query_rag(request: QueryRequest):
    result = coach_engine.query(request.query, request.context)
    return AdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
    )


@app.post("/build-advice", response_model=BuildAdviceResponse)
def build_advice(request: BuildAdviceRequest):
    query = request.query or "Recommend the strongest realistic build for the current state."
    result = coach_engine.build_advice(query, request.context)
    return BuildAdviceResponse(
        answer=result["answer"],
        sources=result["sources"],
        retrieved_chunks=result["retrieved_chunks"],
        plan=result.get("plan"),
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


def _build_stream_generator(query: str, context: Dict[str, Any]):
    for event in coach_engine.build_advice_stream(query, context):
        yield json.dumps(event, ensure_ascii=False) + "\n"


@app.post("/query-stream")
def query_stream(request: QueryRequest):
    return StreamingResponse(
        _stream_generator(request.query, request.context),
        media_type="text/event-stream",
    )


@app.post("/build-advice-stream")
def build_advice_stream(request: BuildAdviceRequest):
    query = request.query or "Recommend the strongest realistic build for the current state."
    return StreamingResponse(
        _build_stream_generator(query, request.context),
        media_type="application/x-ndjson",
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("RAG_SERVICE_PORT", "8003"))
    uvicorn.run(app, host="0.0.0.0", port=port)
