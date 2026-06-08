# Agent Tools - Creature Chess Tactical Coach

This document describes the tools (chức năng) the Tactical Coach agent can use.
The coach is an AGENT: for any message it first decides whether the player wants
an ACTION on their board or an ANSWER to a question, picks the right tool,
gathers needed data, and re-queries the knowledge base if the first retrieval is
too weak.

## Answer vs Action (most important)

- **Answer (general_advice / RAG)** — the player is asking a question: explain,
  compare, "which is best", "what units", "how to", "why", "is X good". Even if
  the question mentions builds, pieces, and items together (e.g. "đội hình nào
  mạnh nhất, gồm những quân nào và cách lên đồ?"), it stays a knowledge question
  and must be answered fully from the guides — NOT routed to an action tool.
- **Action** — the player wants the coach to DO something on THEIR current board
  right now ("xếp quân cho tôi", "triển khai đội hình này", "lên đồ cho quân đang
  chọn", "soi đối thủ của tôi"). Only then pick an action tool.

## Tool catalog

### positioning_advice (action)
- Intent: "xếp quân thế nào", "đặt carry ở đâu", "vị trí tối ưu".
- Aliases: `/pos`, `/xếp`, `/xep`.
- Needs the player's board + both revealed opponents (PREPARING phase, PvP only).
- Runs battle simulation to recommend a formation + concrete moves with win rate.

### build_advice (action)
- Intent: "build cho ván của tôi", "triển khai đội hình này", or an imperative to
  go a specific comp: "build 8 lửa", "đi 8 fire", "lên team nước", "build carry
  Agnigon cho tôi". Also "build cái đó / đội đó đi" referring to a comp discussed
  earlier.
- Aliases: `/build`, `/team`, `/doi`.
- When the player names a direction, put it verbatim in `args.note` (e.g. "8 fire").
  The plan MUST follow the player's requested direction, not a different comp the
  AI thinks is stronger.
- Needs structured game state; produces a build plan the auto-player can run.
- NOT for conceptual questions like "8 lửa có mạnh không?" or "đội hình nào mạnh
  nhất?" -> use general_advice.

### item_advice (action)
- Intent: "lên đồ gì cho quân đang chọn", or "[Tên tướng] lên đồ gì" (e.g.
  "Twees lên đồ gì").
- Aliases: `/item`, `/đồ`, `/do`.
- The agent resolves a fuzzy/abbreviated name to the canonical creature
  (Twees -> Tweesher) and advises THAT exact creature. It does NOT auto-pick a
  different piece. If no piece is named/selected, ask which creature.
- NOT for general item questions ("item nào tốt nhất cho carry") -> general_advice.

### counter_advice (action)
- Intent: "khắc chế đối thủ", "đối phó với đội hình này".
- Aliases: `/counter`, `/khắc`, `/khac`.
- Needs enemy board or archetype; explains type relations + counter formation.

### scout (action)
- Intent: "đối thủ có gì", "soi địch".
- Aliases: `/scout`, `/đối`.
- Summarizes opponent pieces/traits or player-list info.

### general_advice (default / RAG)
- Any Creature Chess knowledge question that is not an action on the board.
- Answers from the retrieved game guides. If the first retrieval is weak,
  reformulate with exact entity names (Agnigon, INFINITY_EDGE, fire) and search
  again before answering.
