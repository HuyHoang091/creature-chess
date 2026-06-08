"""Per-session conversation memory: recent buffer + running summary.

Each session keeps the most recent turns verbatim (a short transcript buffer)
plus a running summary of older turns that scrolled out of the buffer, so
context from earlier in the match is preserved without resending everything.
Entries expire by TTL; the store is bounded with LRU-style eviction.
"""

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class SessionState:
    summary: str = ""
    turns: List[Tuple[str, str]] = field(default_factory=list)  # (role, text)


class ConversationMemory:
    def __init__(
        self,
        ttl_seconds: int = 3600,
        max_sessions: int = 500,
        buffer_turns: int = 8,
    ):
        self._ttl = ttl_seconds
        self._max = max_sessions
        self.buffer_turns = buffer_turns
        self._store: "OrderedDict[str, Tuple[SessionState, float]]" = OrderedDict()
        self._lock = threading.Lock()

    def _live(self, session_id: str) -> Optional[SessionState]:
        entry = self._store.get(session_id)
        if not entry:
            return None
        state, expiry = entry
        if time.time() > expiry:
            self._store.pop(session_id, None)
            return None
        self._store.move_to_end(session_id)
        return state

    def get(self, session_id: Optional[str]) -> SessionState:
        if not session_id:
            return SessionState()
        with self._lock:
            state = self._live(session_id)
            if not state:
                return SessionState()
            return SessionState(summary=state.summary, turns=list(state.turns))

    def add_turn(self, session_id: Optional[str], role: str, text: str) -> None:
        if not session_id or not (text or "").strip():
            return
        with self._lock:
            state = self._live(session_id)
            if not state:
                if len(self._store) >= self._max:
                    self._store.popitem(last=False)
                state = SessionState()
            state.turns.append((role, text.strip()))
            self._store[session_id] = (state, time.time() + self._ttl)
            self._store.move_to_end(session_id)

    def overflow_turns(self, session_id: Optional[str]) -> List[Tuple[str, str]]:
        """Turns beyond the buffer that should be summarized (without removal)."""
        if not session_id:
            return []
        with self._lock:
            state = self._live(session_id)
            if not state:
                return []
            extra = len(state.turns) - self.buffer_turns
            return list(state.turns[:extra]) if extra > 0 else []

    def fold_summary(
        self, session_id: Optional[str], new_summary: str, folded_count: int
    ) -> None:
        """Replace the summary and drop the oldest `folded_count` turns."""
        if not session_id:
            return
        with self._lock:
            state = self._live(session_id)
            if not state:
                return
            state.summary = (new_summary or "").strip()
            if folded_count > 0:
                state.turns = state.turns[folded_count:]
            self._store[session_id] = (state, time.time() + self._ttl)
            self._store.move_to_end(session_id)

    def clear(self, session_id: Optional[str]) -> None:
        if not session_id:
            return
        with self._lock:
            self._store.pop(session_id, None)
