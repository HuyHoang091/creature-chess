"""Tool registry for the hybrid RAG + agent coach.

Each tool is a capability the Tactical Coach can use to answer a player.
ACTION tools (positioning/build/item/counter/scout/battle) need live game state,
so they are executed on the TypeScript client; the agent only decides WHICH tool
to use and extracts arguments. `general_advice` is answered here via RAG.
"""

from typing import Any, Dict, List, Optional


TOOLS: List[Dict[str, Any]] = [
    {
        "name": "positioning_advice",
        "client_action": "positioning",
        "description": (
            "HÀNH ĐỘNG: mô phỏng trận để gợi ý xếp quân tối ưu trên bàn hiện tại của "
            "người chơi. Dùng khi người chơi muốn coach xếp/đặt vị trí giúp họ ngay."
        ),
        "needs": ["myBoard", "bothOpponentsRevealed", "preparingPhase"],
        "aliases": ["/pos", "/xếp", "/xep"],
    },
    {
        "name": "build_advice",
        "client_action": "build",
        "description": (
            "HÀNH ĐỘNG: lập kế hoạch build cho VÁN HIỆN TẠI (từ vàng, level, quân, "
            "shop, item) và sinh plan cho auto-player. CHỈ dùng khi người chơi muốn "
            "coach triển khai/đề xuất cho bàn của họ ngay. KHÔNG dùng cho câu hỏi kiến "
            "thức kiểu 'đội hình nào mạnh nhất gồm quân gì' — câu đó là general_advice."
        ),
        "needs": ["buildState"],
        "aliases": ["/build", "/team", "/doi"],
    },
    {
        "name": "item_advice",
        "client_action": "item",
        "description": (
            "HÀNH ĐỘNG: gợi ý trang bị cho MỘT quân cụ thể (đang chọn hoặc nêu tên, "
            "vd 'Twees lên đồ gì'). Câu hỏi chung về item (so sánh item) là general_advice."
        ),
        "needs": ["targetPiece"],
        "aliases": ["/item", "/đồ", "/do"],
    },
    {
        "name": "counter_advice",
        "client_action": "counter",
        "description": (
            "HÀNH ĐỘNG: phân tích cách khắc chế đội hình đối thủ hiện tại dựa trên hệ "
            "khắc chế và matchup. Dùng khi hỏi cách đối phó với địch cụ thể của họ."
        ),
        "needs": ["enemyBoardOrArchetype"],
        "aliases": ["/counter", "/khắc", "/khac"],
    },
    {
        "name": "scout",
        "client_action": "scout",
        "description": (
            "HÀNH ĐỘNG: tóm tắt thông tin đối thủ (quân, hệ, level, máu). Dùng khi hỏi "
            "đối thủ có gì, soi địch."
        ),
        "needs": ["opponentData"],
        "aliases": ["/scout", "/đối"],
    },
    {
        "name": "general_advice",
        "client_action": None,  # answered in-service via RAG
        "description": (
            "Trả lời mọi câu hỏi kiến thức Creature Chess (cơ chế, economy, synergy, "
            "'X có mạnh không', 'đội hình nào mạnh gồm quân gì và lên đồ ra sao'). Đây "
            "là lựa chọn mặc định khi không phải yêu cầu hành động trên bàn của họ."
        ),
        "needs": [],
        "aliases": [],
    },
]

TOOL_NAMES = [tool["name"] for tool in TOOLS]


# Canonical roster of all 47 creatures, used to normalize fuzzy/abbreviated
# names from the player (e.g. "Twees" -> "Tweesher") during routing.
CREATURE_NAMES = [
    "Budaye", "Anoleaf", "Rockitten", "Aardorn", "Nut", "Puparmor", "Embra",
    "Tweesher", "Bamboon", "Chenipode", "Bolt", "Weavifly", "Cardiling",
    "Agnite", "Elowind", "Fluttaflap", "Velocitile", "Sapsnap", "Rockat",
    "Grintot", "Propellorcat", "Sumchon", "Ignibus", "Ruption", "Noctalo",
    "Lightmare", "Narcileaf", "Coleorus", "Aardart", "Hubursa", "Sampsack",
    "Cairfrey", "Prophetoise", "Tikorch", "Nudimind", "Dollfin", "Arbelder",
    "Viviphyta", "Grintrock", "Jemuar", "Pyraminx", "AV8R", "Agnigon",
    "Cardinale", "Nudikill", "Eaglace", "Kirkanon",
]


def get_tool(name: str) -> Optional[Dict[str, Any]]:
    for tool in TOOLS:
        if tool["name"] == name:
            return tool
    return None


def tools_prompt_block() -> str:
    """Render the tool catalog for the router prompt."""
    lines = ["Available tools:"]
    for tool in TOOLS:
        needs = ", ".join(tool["needs"]) if tool["needs"] else "none"
        lines.append(f"- {tool['name']}: {tool['description']} (needs: {needs})")
    return "\n".join(lines)


def creature_roster_block() -> str:
    return "Creatures (canonical names): " + ", ".join(CREATURE_NAMES)


def resolve_creature_name(name: str) -> Dict[str, Any]:
    """Resolve a fuzzy/abbreviated creature name with explicit ambiguity.

    Returns {"status": "exact"|"match"|"ambiguous"|"none",
             "name": <canonical or None>, "candidates": [...]}.
    Ambiguous (e.g. "agni" -> Agnite/Agnigon) lets the caller ask instead of guessing.
    """
    empty = {"status": "none", "name": None, "candidates": []}
    if not name:
        return empty
    q = name.strip().lower()
    if not q:
        return empty

    for canonical in CREATURE_NAMES:
        if canonical.lower() == q:
            return {"status": "exact", "name": canonical, "candidates": [canonical]}

    prefix = [c for c in CREATURE_NAMES if c.lower().startswith(q)]
    if len(prefix) == 1:
        return {"status": "match", "name": prefix[0], "candidates": prefix}
    if len(prefix) > 1:
        return {"status": "ambiguous", "name": None, "candidates": prefix}

    contains = [c for c in CREATURE_NAMES if q in c.lower()]
    if len(contains) == 1:
        return {"status": "match", "name": contains[0], "candidates": contains}
    if len(contains) > 1:
        return {"status": "ambiguous", "name": None, "candidates": contains}

    return empty
