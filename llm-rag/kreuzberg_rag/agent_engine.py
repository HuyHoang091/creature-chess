"""Hybrid RAG + Agent engine.

- ROUTING: decide whether the player wants an ACTION on their board (run an
  action tool) or an ANSWER to a question (general_advice / RAG). Knowledge
  questions are never hijacked by action tools, even when they mention
  builds/items.
- AGENTIC RAG: for knowledge questions, retrieve guides and re-query the
  knowledge base when the first retrieval is too weak.
- MEMORY: a rolling buffer of recent turns plus a running summary of older
  turns preserves context across the whole match.

Action tools (positioning/build/item/counter/scout) run on the client because
they need live game state; the agent returns a routing decision. `general_advice`
is answered here with iterative retrieval + the CoachEngine LLM.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from .coach_engine import CoachEngine
from .conversation_memory import ConversationMemory, SessionState
from .tools import (
    TOOL_NAMES,
    creature_roster_block,
    get_tool,
    resolve_creature_name,
    tools_prompt_block,
)


# Absolute semantic relevance (raw cosine, e5 embeddings) below which the
# retrieval is treated as too weak and the query is reformulated. Strong e5
# matches sit ~0.82+, off-topic ~0.74 or lower, so 0.78 is a sensible cutoff.
MIN_RELEVANCE = 0.78
MAX_REQUERIES = 2
MAX_SUMMARY_CHARS = 1200


ROUTER_SYSTEM_PROMPT = """You are the intent router for the Creature Chess Tactical Coach.
Decide what the player wants, then return a single JSON object.

{tools_block}

{roster_block}

CORE DISTINCTION — answer vs action:
- If the player ASKS A QUESTION (explain, compare, "which is best", "what units",
  "how to", "why", "is X good") -> use "general_advice". This is the default; the
  RAG engine answers fully from the game guides.
- Only use an ACTION tool when the player wants the coach to DO something on THEIR
  current board right now (e.g. "xếp quân cho tôi", "triển khai đội hình này", "lên
  đồ giúp cho quân đang chọn", "soi đối thủ của tôi").

BUILD REQUESTS (important):
- An imperative to build/go a specific composition for THEIR game is build_advice
  (an action), e.g. "build 8 lửa", "đi 8 fire", "lên team nước", "build carry
  Agnigon cho tôi", "triển khai đội hình này". Put the requested direction in
  args.note (verbatim, e.g. "8 fire").
- A conceptual question ABOUT builds stays general_advice, e.g. "8 lửa có mạnh
  không?", "đội hình nào mạnh nhất?", "fire vs water build nào tốt hơn?".
- If the player previously discussed a comp and now says "build cái đó / đội đó đi",
  resolve it from the conversation context and route to build_advice with that
  direction in args.note.

Important:
- A question mentioning builds, pieces AND items together (e.g. "đội hình nào mạnh
  nhất, gồm những quân nào và cách lên đồ?") is a KNOWLEDGE question ->
  "general_advice". Do NOT route it to build_advice/item_advice.
- Small talk / greetings / thanks / test -> "general_advice" with "smalltalk": true.

NAME NORMALIZATION:
- When the player names a creature, even abbreviated/misspelled (e.g. "Twees",
  "agni"), resolve it to the exact canonical name from the roster and put it in
  args.pieceName. "Twees lên đồ gì" -> item_advice, pieceName "Tweesher".
- If the named creature is not in the roster, leave pieceName empty.

Use the conversation context and current game state to resolve references like
"it"/"nó"/"that piece" (e.g. if a piece is selected and the player says "lên đồ
cho nó", use the selected piece).

Return ONLY this JSON (no prose):
{{"tool": "<tool_name>", "args": {{}}, "reason": "<short reason>", "smalltalk": false}}"""


SUMMARY_PROMPT = """You maintain a running summary of a Creature Chess coaching chat.
Fold the older turns below into the existing summary. Preserve durable match
context: build direction, key pieces/items of interest, opponents discussed,
decisions, and unresolved questions. Keep it tight (<= 8 short bullets).

Existing summary:
{previous}

Older turns to fold in:
{older_turns}

Return ONLY the updated summary text (no preamble)."""


SUFFICIENCY_PROMPT = """Decide if the retrieved game-guide context can answer the question.

Question: {question}

Retrieved context (top snippets):
{context}

If it can answer, respond: {{"sufficient": true}}
Otherwise respond with a better search query using exact creature/item/trait names:
{{"sufficient": false, "searchQuery": "<reformulated query>"}}

Respond with ONLY the JSON object."""


# Answer-step system prompt. The intent was already decided by the router, so
# this prompt must NOT re-classify or gate-keep. It answers gameplay questions
# directly and only refuses content that is genuinely off-topic.
ANSWER_SYSTEM_PROMPT = """You are the Tactical Coach for Creature Chess, an auto-battler game.
The user's intent has ALREADY been classified as a Creature Chess gameplay question.
Answer it directly and helpfully — do NOT refuse, do NOT say you only support
gameplay, and do NOT ask a clarifying question unless the request is truly
impossible to answer. If details are missing, make reasonable assumptions and
give the best general answer (e.g. for "build nào mạnh nhất" describe the
strongest meta comps, their core units, and item directions).

RESPONSE FORMAT - structure with ## headers when relevant. Keep it readable:

## 🏆 Khuyến Nghị
2-3 sentence summary. Tag the most important piece/item once.

## 🐉 Quân Cờ
Key pieces, one per line with "- " prefix.

## ⚔️ Trang Bị
Item recommendations, one per line with "- " prefix.

## 📋 Chiến Thuật
Short bullet points.

Available tags:
- Pieces: [piece:Name] (Budaye, Anoleaf, Rockitten, Aardorn, Nut, Puparmor, Embra, Tweesher, Bamboon, Chenipode, Bolt, Weavifly, Cardiling, Agnite, Elowind, Fluttaflap, Velocitile, Sapsnap, Rockat, Grintot, Propellorcat, Sumchon, Ignibus, Ruption, Noctalo, Lightmare, Narcileaf, Coleorus, Aardart, Hubursa, Sampsack, Cairfrey, Prophetoise, Tikorch, Nudimind, Dollfin, Arbelder, Viviphyta, Grintrock, Jemuar, Pyraminx, AV8R, Agnigon, Cardinale, Nudikill, Eaglace, Kirkanon)
- Items: [item:ID] (BF_SWORD, CHAIN_VEST, GIANTS_BELT, RECURVE_BOW, TEAR, CLOAK, ROD, GLOVES, INFINITY_EDGE, WARMOG, BLOODTHIRSTER, RAPID_FIRE, FROZEN_HEART, GUARDIAN_ANGEL, RABADON, PHANTOM_DANCER, THORNMAIL)
- Traits: [trait:Name] (fire, water, earth, wood, metal, valiant, arcane, cunning)

Rules:
- TAG SPARINGLY - first mention only. Use "- " bullet points, one item per line.
- Always answer in Vietnamese.
- Base your answer on the provided game-guide context. If the context is thin,
  still answer from general Creature Chess knowledge — never reply with a refusal.
- Only if the question is clearly NOT about Creature Chess at all (politics,
  unrelated topics) reply: "Tôi chỉ hỗ trợ về gameplay Creature Chess."

Context from game guides will be provided below."""


# Brief, friendly prompt for greetings / thanks / small talk.
SMALLTALK_SYSTEM_PROMPT = """You are the Tactical Coach for Creature Chess.
The user's message is a greeting, thanks, or small talk. Reply briefly and
warmly in Vietnamese (1-2 sentences), and invite them to ask about builds,
positioning, items, counters, or economy. Do not dump strategy advice."""


VI_SEARCH_TRANSLATE_PROMPT = """Translate this Creature Chess player question into a concise
ENGLISH search query for a game knowledge base. Keep game terms and any creature/
item/trait names. Output ONLY the English query, no quotes, no explanation.

Question: {question}"""


def _format_turns(turns: List[Tuple[str, str]]) -> str:
    label = {"user": "Player", "ai": "Coach"}
    return "\n".join(f"{label.get(r, r)}: {t}" for r, t in turns)


class AgentEngine:
    def __init__(self, coach: CoachEngine, memory: ConversationMemory = None):
        self.coach = coach
        self.retriever = coach.retriever
        self.client = coach.client
        self.model = coach.model
        self.memory = memory or ConversationMemory()

    # ----------------------------- helpers -----------------------------

    def _llm_json(self, messages: List[Dict[str, str]], max_tokens: int = 400) -> Optional[dict]:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.0,
                max_tokens=max_tokens,
            )
            return self._parse_json(response.choices[0].message.content or "")
        except Exception:
            return None

    @staticmethod
    def _parse_json(text: str) -> Optional[dict]:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except Exception:
            return None

    def _context_block(self, state: SessionState) -> str:
        parts = []
        if state.summary:
            parts.append(f"Summary of earlier conversation:\n{state.summary}")
        if state.turns:
            parts.append(f"Recent turns:\n{_format_turns(state.turns)}")
        return "\n\n".join(parts)

    @staticmethod
    def _format_routing_context(context: Dict[str, Any] = None) -> str:
        """Render a compact game-state snapshot for the router prompt.

        Only includes fields the client actually sends (pieces, selectedPiece,
        phase, opponent info); silently skips anything missing.
        """
        if not context:
            return ""
        lines = []
        pieces = context.get("pieces")
        if pieces:
            names = [p.get("name", "") for p in pieces if p.get("name")]
            if names:
                lines.append(f"Player board pieces: {', '.join(names)}")
        selected = context.get("selectedPiece")
        if selected:
            lines.append(f"Currently selected piece: {selected}")
        phase = context.get("phase")
        if phase:
            lines.append(f"Game phase: {phase}")
        enemy = context.get("enemyArchetype")
        if enemy:
            lines.append(f"Opponent archetype: {enemy}")
        opponent = context.get("opponentName")
        if opponent:
            lines.append(f"Opponent: {opponent}")
        return "\n".join(lines)

    # ----------------------------- routing -----------------------------

    def route(self, question: str, convo: str = "", game_state: str = "") -> Dict[str, Any]:
        sections = []
        if convo:
            sections.append(f"Conversation context:\n{convo}")
        if game_state:
            sections.append(f"Current game state:\n{game_state}")
        sections.append(f"Current message: {question}")
        user_content = "\n\n".join(sections)
        messages = [
            {
                "role": "system",
                "content": ROUTER_SYSTEM_PROMPT.format(
                    tools_block=tools_prompt_block(),
                    roster_block=creature_roster_block(),
                ),
            },
            {"role": "user", "content": user_content},
        ]
        decision = self._llm_json(messages)

        if not decision or decision.get("tool") not in TOOL_NAMES:
            return {
                "tool": "general_advice",
                "args": {},
                "reason": "fallback: router unavailable",
                "smalltalk": False,
            }

        decision.setdefault("args", {})
        decision.setdefault("reason", "")
        decision.setdefault("smalltalk", False)

        # Deterministically resolve a fuzzy piece name; flag ambiguity instead
        # of silently picking the wrong creature.
        args = decision.get("args") or {}
        raw_name = args.get("pieceName")
        if raw_name:
            resolved = resolve_creature_name(raw_name)
            if resolved["status"] in ("exact", "match"):
                args["pieceName"] = resolved["name"]
            elif resolved["status"] == "ambiguous":
                args["pieceNameAmbiguous"] = True
                args["pieceNameCandidates"] = resolved["candidates"]
        decision["args"] = args
        return decision

    def plan(
        self, question: str, context: Dict[str, Any] = None, session_id: str = None
    ) -> Dict[str, Any]:
        """Routing decision the client can act on."""
        state = self.memory.get(session_id)
        decision = self.route(
            question,
            convo=self._context_block(state),
            game_state=self._format_routing_context(context),
        )
        tool = get_tool(decision["tool"])
        return {
            "tool": decision["tool"],
            "clientAction": tool.get("client_action") if tool else None,
            "args": decision.get("args", {}),
            "reason": decision.get("reason", ""),
            "smalltalk": bool(decision.get("smalltalk", False)),
            "needs": tool.get("needs", []) if tool else [],
        }

    # --------------------------- agentic RAG ---------------------------

    @staticmethod
    def _has_vietnamese(text: str) -> bool:
        # Vietnamese-specific letters; ASCII-only text returns False.
        return bool(re.search(r"[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềể"
                              r"ễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", text, re.I))

    def _translate_for_search(self, question: str) -> str:
        """Translate a Vietnamese question to English for retrieval.

        Guides are English and BM25 is weak on Vietnamese, so searching with an
        English query improves recall. ASCII/English questions pass through.
        """
        if not self._has_vietnamese(question):
            return question
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You translate to English search queries."},
                    {"role": "user", "content": VI_SEARCH_TRANSLATE_PROMPT.format(question=question)},
                ],
                temperature=0.0,
                max_tokens=80,
            )
            translated = (response.choices[0].message.content or "").strip()
            return translated or question
        except Exception:
            return question

    def _retrieve_with_requery(
        self, question: str, top_k: int
    ) -> Tuple[List, str, List[str]]:
        # Search in English (translate VN questions) for better recall.
        query = self._translate_for_search(question)
        attempted = [query]
        results, relevance = self.retriever.search_scored(query, top_k=top_k)
        best_results, best_relevance = results, relevance

        requeries = 0
        while best_relevance < MIN_RELEVANCE and requeries < MAX_REQUERIES:
            better = self._suggest_query(query, results)
            if not better or better in attempted:
                break
            query = better
            attempted.append(query)
            results, relevance = self.retriever.search_scored(query, top_k=top_k)
            if relevance > best_relevance:
                best_results, best_relevance = results, relevance
            requeries += 1

        context_text = "\n\n".join(
            [f"[{chunk.source}]\n{chunk.text}" for chunk, _ in best_results]
        )
        return best_results, context_text, attempted

    def _suggest_query(self, question: str, results: List) -> Optional[str]:
        snippets = "\n".join([f"- {c.text[:160]}" for c, _ in results[:3]]) or "(none)"
        decision = self._llm_json(
            [
                {"role": "system", "content": "You reformulate game knowledge-base queries."},
                {
                    "role": "user",
                    "content": SUFFICIENCY_PROMPT.format(question=question, context=snippets),
                },
            ],
            max_tokens=120,
        )
        if not decision or decision.get("sufficient"):
            return None
        return (decision.get("searchQuery") or "").strip() or None

    def answer_stream(
        self, question: str, context: Dict[str, Any] = None, top_k: int = 5,
        session_id: str = None, smalltalk: bool = False,
    ):
        """Stream a general-knowledge answer, then record the turn.

        The intent is already decided by the router, so this does not
        re-classify. `smalltalk=True` gives a brief friendly reply (no retrieval).
        """
        state = self.memory.get(session_id)
        if smalltalk:
            messages = [
                {"role": "system", "content": SMALLTALK_SYSTEM_PROMPT},
                {"role": "user", "content": question},
            ]
        else:
            _, context_text, _ = self._retrieve_with_requery(question, top_k)
            messages = self._compose_messages(
                question, context_text, context, self._context_block(state)
            )
        collected = []
        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=10000,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    collected.append(delta)
                    yield delta
        except Exception as e:
            yield f"Sorry, I couldn't process your question. Error: {str(e)}"
            return

        try:
            self.record_turn(session_id, question, "".join(collected))
        except Exception:
            pass

    def _compose_messages(
        self, question: str, context_text: str,
        context: Dict[str, Any] = None, convo: str = "",
    ):
        extra = self.coach._format_context(context)
        convo_block = f"Conversation context:\n{convo}\n\n" if convo else ""
        return [
            {"role": "system", "content": ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"{convo_block}"
                    f"Game guide context:\n{context_text}\n\n{extra}\n"
                    f"Question: {question}"
                ),
            },
        ]

    # --------------------------- memory ---------------------------

    def record_turn(self, session_id: str, question: str, answer: str) -> None:
        if not session_id:
            return
        if (question or "").strip():
            self.memory.add_turn(session_id, "user", question)
        if (answer or "").strip():
            self.memory.add_turn(session_id, "ai", answer)
        self._fold_if_needed(session_id)

    def record_action(
        self, session_id: str, question: str, tool: str, args: Dict[str, Any] = None
    ) -> None:
        """Log a client-side action so follow-ups resolve and the summary stays whole."""
        if not session_id:
            return
        detail = ""
        if args:
            useful = {
                k: v for k, v in args.items()
                if k in ("pieceName", "archetype") and v
            }
            if useful:
                detail = " (" + ", ".join(f"{k}={v}" for k, v in useful.items()) + ")"
        if (question or "").strip():
            self.memory.add_turn(session_id, "user", question)
        self.memory.add_turn(session_id, "ai", f"[Ran tool: {tool}{detail}]")
        self._fold_if_needed(session_id)

    def _fold_if_needed(self, session_id: str) -> None:
        older = self.memory.overflow_turns(session_id)
        if not older:
            return
        previous = self.memory.get(session_id).summary
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You maintain a concise running chat summary."},
                    {
                        "role": "user",
                        "content": SUMMARY_PROMPT.format(
                            previous=previous or "(none yet)",
                            older_turns=_format_turns(older),
                        ),
                    },
                ],
                temperature=0.0,
                max_tokens=400,
            )
            new_summary = (response.choices[0].message.content or "").strip()
        except Exception:
            new_summary = ""

        if not new_summary:
            # Fold failed: still drop overflow (append terse note) so the buffer
            # cannot grow without bound.
            note = _format_turns(older)
            merged = ((previous or "").strip() + "\n" + note).strip()
            self.memory.fold_summary(session_id, merged[-MAX_SUMMARY_CHARS:], len(older))
            return
        self.memory.fold_summary(session_id, new_summary[:MAX_SUMMARY_CHARS], len(older))
