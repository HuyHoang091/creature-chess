"""Tactical Coach: build context and query LLM."""

import json
import os
import re
from typing import Any, Dict

import openai
from dotenv import load_dotenv

from .retriever import Retriever

load_dotenv()


SYSTEM_PROMPT = """You are the Tactical Coach for Creature Chess, an auto-battler game.
Your job is to help players with team composition, positioning, items, and economy.

RESPONSE FORMAT - Structure your answer with ## headers. Keep it readable:

## Recommendation
2-3 sentence summary. Only tag the most important piece or item once.
Example: Focus on [piece:Agnigon] as your main carry with [item:INFINITY_EDGE].

## Pieces
List each key piece on its own line with "- " prefix. Tag once per line.
Example:
- [piece:Budaye] - frontline tank, low cost, strong early
- [piece:Agnigon] - backline damage dealer

## Items
One item recommendation per line with "- " prefix.
Example:
- [item:INFINITY_EDGE] on carry - +40 Attack

## Strategy
Short bullet points. Don't re-tag pieces already mentioned above.

Available tags:
- Pieces: [piece:Name] (47 creatures: Budaye, Anoleaf, Rockitten, Aardorn, Nut, Puparmor, Embra, Tweesher, Bamboon, Chenipode, Bolt, Weavifly, Cardiling, Agnite, Elowind, Fluttaflap, Velocitile, Sapsnap, Rockat, Grintot, Propellorcat, Sumchon, Ignibus, Ruption, Noctalo, Lightmare, Narcileaf, Coleorus, Aardart, Hubursa, Sampsack, Cairfrey, Prophetoise, Tikorch, Nudimind, Dollfin, Arbelder, Viviphyta, Grintrock, Jemuar, Pyraminx, AV8R, Agnigon, Cardinale, Nudikill, Eaglace, Kirkanon)
- Items: [item:ID] (BF_SWORD, CHAIN_VEST, GIANTS_BELT, RECURVE_BOW, TEAR, CLOAK, ROD, GLOVES, INFINITY_EDGE, WARMOG, BLOODTHIRSTER, RAPID_FIRE, FROZEN_HEART, GUARDIAN_ANGEL, RABADON, PHANTOM_DANCER, THORNMAIL)
- Traits: [trait:Name] (fire, water, earth, wood, metal, valiant, arcane, cunning)

Rules:
- Only answer Creature Chess questions.
- TAG SPARINGLY - first mention only, not every occurrence. The UI already shows details on hover.
- Use "- " bullet points for lists, one item per line.
- Keep lines short - max one tag per line when possible.
- Use Vietnamese.
- If asked about something unrelated: "Tôi chỉ hỗ trợ về gameplay Creature Chess."

Context from game guides will be provided below. Use it to answer the player's question."""


BUILD_REQUEST_PROMPT = """
You are handling a /build request with a structured game-state snapshot.

Priorities:
- Maximize realistic top-4 strength from the CURRENT state, not only ideal late game.
- Read the build-state JSON carefully, especially unitPool, ownedUnitProgress, currentLevelOdds, allLevelOdds, inventoryItems, craftableInventoryItems, boardPieces, benchPieces, and shopCards.
- Strongly account for copy pressure: units with low remainingCopies are harder to hit.
- Strongly account for current level and cost odds before recommending rerolls, slow-roll, or level-up timing.
- Prefer lines that use the player's existing board, bench, shop, and items well.
- Explain tradeoffs and why this line is better than obvious alternatives.

Required answer structure:
## Current State
## Recommended Build
## Roll and Level Plan
## Item Plan
## Why

After the explanation, include exactly one fenced JSON block:
```json
{
  "planName": "short build name",
  "primaryTraits": ["trait"],
  "secondaryTraits": ["trait"],
  "coreUnits": [
    {
      "name": "ExactPieceName",
      "definitionId": 1,
      "cost": 1,
      "targetStars": 2,
      "priority": "core",
      "reason": "short reason"
    }
  ],
  "transitionUnits": [],
  "avoidUnits": [],
  "rollStrategy": {
    "summary": "short summary",
    "targetLevel": 6,
    "slowRollAt": 5
  },
  "itemPlan": [
    {
      "itemId": "INFINITY_EDGE",
      "targetPiece": "ExactPieceName",
      "action": "craft_now",
      "reason": "short reason",
      "from": ["BF_SWORD", "BF_SWORD"]
    }
  ],
  "shortTermSteps": ["step 1", "step 2"]
}
```

JSON rules:
- Return valid JSON only inside the fenced block.
- Use exact piece names and item IDs from the game state when possible.
- Keep the plan conservative and executable from the current state.
"""


class CoachEngine:
    def __init__(self, retriever: Retriever):
        self.retriever = retriever
        self.client = openai.OpenAI(
            base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            api_key=os.getenv("OPENROUTER_API_KEY", "...."),
        )
        self.model = os.getenv("COACH_MODEL", "minimax/minimax-m2.5:free")

    def _format_context(self, context: Dict[str, Any] = None) -> str:
        if not context:
            return ""

        if context.get("requestType") == "build":
            return "Structured game state:\n" + json.dumps(
                context, indent=2, ensure_ascii=False
            )

        extra = ""
        if context.get("traits"):
            extra += f"\nPlayer traits: {', '.join(context['traits'])}\n"
        if context.get("pieces"):
            pieces = [p["name"] for p in context["pieces"]]
            extra += f"Player pieces: {', '.join(pieces)}\n"
        if context.get("enemyArchetype"):
            extra += f"Enemy archetype: {context['enemyArchetype']}\n"
        return extra

    def _build_messages(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 5
    ):
        """Build messages with RAG context."""
        results = self.retriever.search(question, top_k=top_k)
        context_text = "\n\n".join(
            [f"[{chunk.source}]\n{chunk.text}" for chunk, score in results]
        )
        extra = self._format_context(context)
        build_instructions = (
            f"\n\n{BUILD_REQUEST_PROMPT}\n"
            if context and context.get("requestType") == "build"
            else ""
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Context:\n{context_text}\n\n{extra}{build_instructions}\n"
                    f"Question: {question}"
                ),
            },
        ]
        return messages, results

    def _extract_json_plan(self, answer: str):
        matches = list(
            re.finditer(r"```json\s*(\{.*?\})\s*```", answer, flags=re.S)
        )

        if not matches:
            return answer.strip(), None

        match = matches[-1]
        json_text = match.group(1)
        cleaned_answer = (answer[: match.start()] + answer[match.end() :]).strip()

        try:
            plan = json.loads(json_text)
        except Exception:
            plan = None

        return cleaned_answer or answer.strip(), plan

    def query(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 5
    ) -> Dict[str, Any]:
        """Answer a player question using RAG."""
        messages, results = self._build_messages(question, context, top_k)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=5000,
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

    def build_advice(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 7
    ) -> Dict[str, Any]:
        """Answer a /build request and extract a machine-readable plan."""
        messages, results = self._build_messages(question, context, top_k)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.4,
                max_tokens=5000,
            )
            raw_answer = response.choices[0].message.content or ""
            answer, plan = self._extract_json_plan(raw_answer)
            return {
                "answer": answer,
                "plan": plan,
                "sources": list(set([chunk.source for chunk, _ in results])),
                "retrieved_chunks": len(results),
            }
        except Exception as e:
            return {
                "answer": f"Sorry, I couldn't process your question. Error: {str(e)}",
                "plan": None,
                "sources": [],
                "retrieved_chunks": 0,
            }

    def build_advice_stream(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 7
    ):
        """Stream user-facing build advice text and finish with the parsed plan."""
        messages, results = self._build_messages(question, context, top_k)
        raw_answer = ""
        emitted_length = 0

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.4,
                max_tokens=5000,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if not delta:
                    continue

                raw_answer += delta
                marker_index = raw_answer.find("```json")
                visible_answer = (
                    raw_answer[:marker_index] if marker_index >= 0 else raw_answer
                )

                if len(visible_answer) > emitted_length:
                    text_chunk = visible_answer[emitted_length:]
                    emitted_length = len(visible_answer)
                    yield {"type": "chunk", "chunk": text_chunk}

            answer, plan = self._extract_json_plan(raw_answer)
            yield {
                "type": "done",
                "answer": answer,
                "plan": plan,
                "sources": list(set([chunk.source for chunk, _ in results])),
                "retrieved_chunks": len(results),
            }
        except Exception as e:
            yield {
                "type": "error",
                "error": f"Sorry, I couldn't process your question. Error: {str(e)}",
            }

    def query_stream(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 5
    ):
        """Stream answer tokens. Yields text chunks."""
        messages, results = self._build_messages(question, context, top_k)
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
