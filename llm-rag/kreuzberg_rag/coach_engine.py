"""Tactical Coach: build context and query LLM."""

import os
from typing import List, Dict, Any
import openai

from .retriever import Retriever


SYSTEM_PROMPT = """You are the Tactical Coach for Creature Chess, an auto-battler game.
Your job is to help players with team composition, positioning, items, and economy.

Rules:
- Only answer questions related to Creature Chess gameplay.
- Be concise and actionable — players need quick advice during gameplay.
- Always reference specific creature names, traits, and items when giving advice.
- Use Vietnamese or English depending on the player's language.
- If asked about something unrelated to the game, respond: "Tôi chỉ hỗ trợ về gameplay Creature Chess. Bạn cần tư vấn gì về đội hình, trang bị, hoặc chiến thuật?"

Context from game guides will be provided below. Use it to answer the player's question."""


class CoachEngine:
    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.client = openai.OpenAI(
            base_url=os.getenv("OPENROUTER_BASE_URL", "http://localhost:5001/v1"),
            api_key=os.getenv("OPENROUTER_API_KEY", "your-api-key-1"),
        )
        self.model = os.getenv("COACH_MODEL", "deepseek-v4-flash-nothinking")

    def _build_messages(self, question: str, context: Dict[str, Any] = None, top_k: int = 5):
        """Build messages with RAG context."""
        results = self.retriever.search(question, top_k=top_k)
        context_text = "\n\n".join([
            f"[{chunk.source}]\n{chunk.text}"
            for chunk, score in results
        ])
        extra = ""
        if context:
            if context.get("traits"):
                extra += f"\nPlayer traits: {', '.join(context['traits'])}\n"
            if context.get("pieces"):
                pieces = [p["name"] for p in context["pieces"]]
                extra += f"Player pieces: {', '.join(pieces)}\n"
            if context.get("enemyArchetype"):
                extra += f"Enemy archetype: {context['enemyArchetype']}\n"
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{context_text}\n{extra}\n\nQuestion: {question}"},
        ]
        return messages, results

    def query(self, question: str, context: Dict[str, Any] = None, top_k: int = 5) -> Dict[str, Any]:
        """Answer a player question using RAG."""
        messages, results = self._build_messages(question, context, top_k)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
            )
            answer = response.choices[0].message.content
            return {
                "answer": answer,
                "sources": list(set([chunk.source for chunk, _ in results])),
                "retrieved_chunks": len(results),
            }
        except Exception as e:
            return {
                "answer": f"Sorry, I couldn't process your question. Error: {str(e)}",
                "sources": [],
                "retrieved_chunks": 0,
            }

    def query_stream(self, question: str, context: Dict[str, Any] = None, top_k: int = 5):
        """Stream answer tokens. Yields text chunks."""
        messages, results = self._build_messages(question, context, top_k)
        sources = list(set([chunk.source for chunk, _ in results]))
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=500,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"Sorry, I couldn't process your question. Error: {str(e)}"
