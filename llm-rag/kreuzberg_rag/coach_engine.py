"""Tactical Coach: build context and query LLM."""

import os
from typing import List, Dict, Any

from dotenv import load_dotenv
import openai

from .retriever import Retriever

load_dotenv()


SYSTEM_PROMPT = """You are the Tactical Coach for Creature Chess, an auto-battler game.
Your job is to help players with team composition, positioning, items, and economy.

RESPONSE FORMAT — Structure your answer with ## headers. Keep it readable:

## 🏆 Khuyến Nghị
2-3 sentence summary. Only tag the most important piece or item once.
Example: Focus on [piece:Agnigon] as your main carry with [item:INFINITY_EDGE].

## 🐉 Quân Cờ
List each key piece on its own line with "- " prefix. Tag once per line.
Example:
- [piece:Budaye] — frontline tank, low cost, strong early
- [piece:Agnigon] — backline damage dealer

## ⚔️ Trang Bị
One item recommendation per line with "- " prefix.
Example:
- [item:INFINITY_EDGE] on carry — +40 Attack

## 📋 Chiến Thuật
Short bullet points. Don't re-tag pieces already mentioned above.

Available tags:
- Pieces: [piece:Name] (47 creatures: Budaye, Anoleaf, Rockitten, Aardorn, Nut, Puparmor, Embra, Tweesher, Bamboon, Chenipode, Bolt, Weavifly, Cardiling, Agnite, Elowind, Fluttaflap, Velocitile, Sapsnap, Rockat, Grintot, Propellorcat, Sumchon, Ignibus, Ruption, Noctalo, Lightmare, Narcileaf, Coleorus, Aardart, Hubursa, Sampsack, Cairfrey, Prophetoise, Tikorch, Nudimind, Dollfin, Arbelder, Viviphyta, Grintrock, Jemuar, Pyraminx, AV8R, Agnigon, Cardinale, Nudikill, Eaglace, Kirkanon)
- Items: [item:ID] (BF_SWORD, CHAIN_VEST, GIANTS_BELT, RECURVE_BOW, TEAR, CLOAK, ROD, GLOVES, INFINITY_EDGE, WARMOG, BLOODTHIRSTER, RAPID_FIRE, FROZEN_HEART, GUARDIAN_ANGEL, RABADON, PHANTOM_DANCER, THORNMAIL)
- Traits: [trait:Name] (fire, water, earth, wood, metal, valiant, arcane, cunning)

Rules:
- Only answer Creature Chess questions.
- TAG SPARINGLY — first mention only, not every occurrence. The UI already shows details on hover.
- Use "- " bullet points for lists, one item per line.
- Keep lines short — max one tag per line when possible.
- Use Vietnamese or English depending on the player's language.
- If asked about something unrelated: "Tôi chỉ hỗ trợ về gameplay Creature Chess."

Context from game guides will be provided below. Use it to answer the player's question."""


class CoachEngine:
    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.client = openai.OpenAI(
            base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            api_key=os.getenv("OPENROUTER_API_KEY", "...."),
        )
        self.model = os.getenv("COACH_MODEL", "minimax/minimax-m2.5:free")

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
                max_tokens=5000,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"Sorry, I couldn't process your question. Error: {str(e)}"
