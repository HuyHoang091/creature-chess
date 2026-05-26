"""
Phase 2: Headless Battle Simulator for Data-Driven RAG.

Replicates the deterministic combat logic from the TypeScript engine:
- Board: 7 wide x 6 tall (3 rows per side)
- Attack: non-diagonal, range 1 (melee) or 2 (ranged)
- Damage: ceil((ATK/DEF) * typeBonus * 8)
- Cooldown: ceil((180-speed)/24) turns
- Skills: cast at full mana, multiplier 2x, single target 4x
- Mana: +10 on attack, +damage_taken on defend
"""

import math
import random
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from generate_knowledge_base import (
    CREATURES_RAW, SKILL_LIB, TRAIT_BUILDS, BASE_STAT, COST_MODIFIER,
    STAGE_MULTIPLIERS, TYPE_INTERACTIONS, STRONG_ATTACK_MODIFIER,
    WEAK_ATTACK_MODIFIER, ELEMENT_SYNERGY_BALANCE,
    get_type_bonus, get_hit_damage, get_cooldown,
)
from pathlib import Path

BOARD_W, BOARD_H = 7, 6
HALF_H = 3
MAX_TURNS = 550
FATIGUE_START = 150  # Turns before fatigue kicks in
FATIGUE_RATE = 0.02  # +2% damage per turn after fatigue
SKILL_DAMAGE_MULT = 2
BOUNCE_MAX = 3
BOUNCE_DECAY = 0.2
HEAL_PCT = 0.25
HEAL_SINGLE_PCT = 0.35
HEAL_AOE_PCT = 0.20
BUFF_ATK_BONUS = 0.30
OUTPUT_DIR = Path(__file__).parent / "data" / "battle-data"


@dataclass
class Pos:
    x: int
    y: int


@dataclass
class SimPiece:
    uid: str
    owner: str  # "A" or "B"
    name: str
    element: str
    combat_trait: str
    cost: int
    pos: Pos
    hp: int
    max_hp: int
    atk: int
    defense: int
    speed: int
    atk_range: int  # 1=melee, 2=ranged
    mana: int = 0
    max_mana: int = 100
    skill_name: str = ""
    skill_type: str = ""
    skill_target: str = ""
    cooldown_until: int = 0
    alive: bool = True
    # synergy modifiers (applied once at battle start)
    atk_bonus_pct: float = 0.0
    def_bonus_pct: float = 0.0
    hp_bonus_pct: float = 0.0
    starting_mana_bonus: int = 0
    speed_bonus: int = 0

    @property
    def effective_atk(self):
        return max(1, math.ceil(self.atk * (1 + self.atk_bonus_pct)))

    @property
    def effective_def(self):
        return max(1, math.ceil(self.defense * (1 + self.def_bonus_pct)))

    @property
    def effective_speed(self):
        return self.speed + self.speed_bonus


def compute_creature_stats(traits, cost, stage):
    combat_trait = traits[1]
    build = TRAIT_BUILDS.get(combat_trait, {"hp": 0.01, "attack": 0.01, "defense": 0.01, "speed": 0.01})
    points = cost * COST_MODIFIER * STAGE_MULTIPLIERS[stage]
    hp = (BASE_STAT + math.ceil(build["hp"] * points)) * 5
    atk = BASE_STAT + math.ceil(build["attack"] * points)
    defense = BASE_STAT + math.ceil(build["defense"] * points)
    speed = BASE_STAT + math.ceil(build["speed"] * points)
    atk_range = 2 if combat_trait == "arcane" else 1
    return hp, atk, defense, speed, atk_range


def make_piece(uid, owner, cid, stage=1, pos=None):
    """Create a SimPiece from creature ID at given stage (0-2)."""
    raw = next(r for r in CREATURES_RAW if r[0] == cid)
    _, name, traits, cost, skill_key = raw
    hp, atk, defense, speed, atk_range = compute_creature_stats(traits, cost, stage)
    skill = SKILL_LIB.get(skill_key, {})
    return SimPiece(
        uid=uid, owner=owner, name=name, element=traits[0],
        combat_trait=traits[1], cost=cost, pos=pos or Pos(0, 0),
        hp=hp, max_hp=hp, atk=atk, defense=defense, speed=speed,
        atk_range=atk_range, max_mana=skill.get("manaCost", 100),
        skill_name=skill.get("name", ""), skill_type=skill.get("type", "damage"),
        skill_target=skill.get("target", "aoe"),
    )


# ─── SYNERGY ─────────────────────────────────────────────────────────

def apply_synergies(pieces: List[SimPiece]):
    """Apply element synergy bonuses based on team composition."""
    for owner in ("A", "B"):
        team = [p for p in pieces if p.owner == owner and p.alive]
        element_counts: Dict[str, int] = {}
        for p in team:
            element_counts[p.element] = element_counts.get(p.element, 0) + 1

        bonuses: Dict[str, dict] = {}
        for element, count in element_counts.items():
            tiers = ELEMENT_SYNERGY_BALANCE.get(element, [])
            active = None
            for tier in tiers:
                if count >= tier["amount"]:
                    active = tier
            if active:
                bonuses[element] = active

        for p in team:
            tier = bonuses.get(p.element)
            if not tier:
                continue
            p.atk_bonus_pct += tier.get("attackPct", 0)
            p.def_bonus_pct += tier.get("defensePct", 0)
            p.hp_bonus_pct += tier.get("hpPct", 0)
            p.speed_bonus += tier.get("speedFlat", 0)
            p.starting_mana_bonus += tier.get("startingManaFlat", 0)

        # Apply HP bonus and starting mana
        for p in team:
            if p.hp_bonus_pct > 0:
                bonus_hp = math.ceil(p.max_hp * p.hp_bonus_pct)
                p.max_hp += bonus_hp
                p.hp += bonus_hp
            p.mana = p.starting_mana_bonus


# ─── FORMATIONS ───────────────────────────────────────────────────────

def _shuffle_positions(positions: List[Pos], max_offset: int = 1) -> List[Pos]:
    """Add slight random offset to positions for variance."""
    result = []
    for p in positions:
        ox = random.randint(-max_offset, max_offset)
        oy = random.randint(0, max_offset)
        nx = max(0, min(BOARD_W - 1, p.x + ox))
        ny = max(0, min(BOARD_H - 1, p.y + oy))
        result.append(Pos(nx, ny))
    # Resolve collisions
    used = set()
    for i, p in enumerate(result):
        while (p.x, p.y) in used:
            p.x = (p.x + 1) % BOARD_W
        used.add((p.x, p.y))
    return result


def place_tank_front(team: List[SimPiece], owner: str):
    """Tanks (valiant) in front row, carries behind."""
    tanks = [p for p in team if p.combat_trait == "valiant"]
    carries = [p for p in team if p.combat_trait != "valiant"]
    front_row = 0 if owner == "A" else BOARD_H - 1
    back_row = 1 if owner == "A" else BOARD_H - 2
    mid_row = 2 if owner == "A" else BOARD_H - 3
    all_sorted = tanks + carries
    for i, p in enumerate(all_sorted):
        if i < min(len(tanks), BOARD_W):
            p.pos = Pos(i % BOARD_W, front_row)
        elif i < min(len(tanks) + len(carries), BOARD_W * 2):
            idx = i - len(tanks)
            p.pos = Pos(idx % BOARD_W, back_row)
        else:
            p.pos = Pos(i % BOARD_W, mid_row)


def place_spread(team: List[SimPiece], owner: str):
    """Spread pieces evenly across rows."""
    rows = [0, 1, 2] if owner == "A" else [5, 4, 3]
    for i, p in enumerate(team):
        row_idx = i % len(rows)
        col = (i // len(rows)) % BOARD_W
        p.pos = Pos(col, rows[row_idx])


def place_corner(team: List[SimPiece], owner: str):
    """All pieces in corner cluster."""
    base_y = 0 if owner == "A" else BOARD_H - HALF_H
    positions = []
    for y in range(base_y, base_y + HALF_H):
        for x in range(min(3, BOARD_W)):
            positions.append(Pos(x, y))
    for i, p in enumerate(team):
        if i < len(positions):
            p.pos = Pos(positions[i].x, positions[i].y)


FORMATIONS = {
    "tank_front": place_tank_front,
    "spread": place_spread,
    "corner": place_corner,
}


# ─── BATTLE ENGINE ────────────────────────────────────────────────────

def manhattan(a: Pos, b: Pos) -> int:
    return abs(a.x - b.x) + abs(a.y - b.y)


def in_attack_range(attacker: Pos, target: Pos, atk_range: int) -> bool:
    dx = abs(attacker.x - target.x)
    dy = abs(attacker.y - target.y)
    return min(dx, dy) == 0 and max(dx, dy) <= atk_range


def fatigue_multiplier(turn: int) -> float:
    """Damage increases after FATIGUE_START to prevent infinite draws."""
    if turn <= FATIGUE_START:
        return 1.0
    return 1.0 + (turn - FATIGUE_START) * FATIGUE_RATE


def find_nearest_enemy(piece: SimPiece, pieces: List[SimPiece]) -> Optional[SimPiece]:
    enemies = [p for p in pieces if p.owner != piece.owner and p.alive]
    if not enemies:
        return None
    return min(enemies, key=lambda e: manhattan(piece.pos, e.pos))


def move_toward(piece: SimPiece, target: SimPiece, pieces: List[SimPiece]):
    """Move 1 step toward target (non-diagonal preferred)."""
    occupied = {(p.pos.x, p.pos.y) for p in pieces if p.alive and p.uid != piece.uid}
    best_pos = None
    best_dist = manhattan(piece.pos, target.pos)
    for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        nx, ny = piece.pos.x + dx, piece.pos.y + dy
        if 0 <= nx < BOARD_W and 0 <= ny < BOARD_H and (nx, ny) not in occupied:
            d = manhattan(Pos(nx, ny), target.pos)
            if d < best_dist:
                best_dist = d
                best_pos = Pos(nx, ny)
    if best_pos:
        piece.pos = best_pos


def calc_damage(atk: int, defense: int, type_bonus: float = 1.0) -> int:
    return math.ceil((atk / defense) * type_bonus * 8)


def do_auto_attack(attacker: SimPiece, target: SimPiece, turn: int = 0):
    tb = get_type_bonus(attacker.element, target.element)
    dmg = math.ceil(calc_damage(attacker.effective_atk, target.effective_def, tb) * fatigue_multiplier(turn))
    target.hp = max(0, target.hp - dmg)
    if target.hp == 0:
        target.alive = False
    attacker.mana = min(attacker.mana + 10, attacker.max_mana)
    target.mana = min(target.mana + dmg, target.max_mana)
    return dmg


def do_skill(attacker: SimPiece, target: SimPiece, all_pieces: List[SimPiece], turn: int = 0):
    """Execute skill based on type and target pattern."""
    atk_val = attacker.effective_atk
    affected = []
    fm = fatigue_multiplier(turn)

    if attacker.skill_type == "damage":
        if attacker.skill_target == "single":
            dmg = math.ceil((atk_val / target.effective_def) * 8 * SKILL_DAMAGE_MULT * 2 * fm)
            target.hp = max(0, target.hp - dmg)
            if target.hp == 0:
                target.alive = False
            target.mana = min(target.mana + dmg, target.max_mana)
            affected.append(target)

        elif attacker.skill_target == "aoe":
            enemies = [p for p in all_pieces if p.owner != attacker.owner and p.alive]
            for e in enemies:
                if manhattan(target.pos, e.pos) <= 1:
                    dmg = math.ceil((atk_val / e.effective_def) * 8 * SKILL_DAMAGE_MULT * fm)
                    e.hp = max(0, e.hp - dmg)
                    if e.hp == 0:
                        e.alive = False
                    e.mana = min(e.mana + dmg, e.max_mana)
                    affected.append(e)

        elif attacker.skill_target == "bounce":
            current = target
            hit_ids = set()
            for bounce in range(BOUNCE_MAX):
                if not current or not current.alive:
                    break
                decay = 1 - bounce * BOUNCE_DECAY
                dmg = math.ceil(math.ceil((atk_val / current.effective_def) * 8 * SKILL_DAMAGE_MULT * fm) * decay)
                current.hp = max(0, current.hp - dmg)
                if current.hp == 0:
                    current.alive = False
                current.mana = min(current.mana + dmg, current.max_mana)
                affected.append(current)
                hit_ids.add(current.uid)
                # Find next bounce target
                enemies = [p for p in all_pieces if p.owner != attacker.owner and p.alive and p.uid not in hit_ids]
                if not enemies:
                    break
                nearby = [e for e in enemies if manhattan(current.pos, e.pos) <= 2]
                current = min(nearby, key=lambda e: manhattan(current.pos, e.pos)) if nearby else None

        elif attacker.skill_target == "line":
            dx = 0 if target.pos.x == attacker.pos.x else (1 if target.pos.x > attacker.pos.x else -1)
            dy = 0 if target.pos.y == attacker.pos.y else (1 if target.pos.y > attacker.pos.y else -1)
            enemies = [p for p in all_pieces if p.owner != attacker.owner and p.alive]
            for step in range(1, 8):
                cx, cy = attacker.pos.x + dx * step, attacker.pos.y + dy * step
                if cx < 0 or cx >= BOARD_W or cy < 0 or cy >= BOARD_H:
                    break
                for e in enemies:
                    if e.pos.x == cx and e.pos.y == cy:
                        dmg = math.ceil((atk_val / e.effective_def) * 8 * SKILL_DAMAGE_MULT * fm)
                        e.hp = max(0, e.hp - dmg)
                        if e.hp == 0:
                            e.alive = False
                        e.mana = min(e.mana + dmg, e.max_mana)
                        affected.append(e)

    elif attacker.skill_type == "buff":
        heal = math.ceil(attacker.max_hp * HEAL_PCT)
        attacker.hp = min(attacker.hp + heal, attacker.max_hp)
        affected.append(attacker)

    elif attacker.skill_type == "support":
        if attacker.skill_target == "aoe":
            allies = [p for p in all_pieces if p.owner == attacker.owner and p.alive]
            for a in allies:
                if manhattan(attacker.pos, a.pos) <= 2:
                    heal = math.ceil(a.max_hp * HEAL_AOE_PCT)
                    a.hp = min(a.hp + heal, a.max_hp)
                    affected.append(a)
        else:
            allies = [p for p in all_pieces if p.owner == attacker.owner and p.alive]
            weakest = min(allies, key=lambda a: a.hp / a.max_hp)
            heal = math.ceil(weakest.max_hp * HEAL_SINGLE_PCT)
            weakest.hp = min(weakest.hp + heal, weakest.max_hp)
            affected.append(weakest)

    attacker.mana = 0
    return affected


def simulate_match(team_a: List[SimPiece], team_b: List[SimPiece]) -> dict:
    """Run a single battle, return result."""
    all_pieces = team_a + team_b
    apply_synergies(all_pieces)

    for turn in range(MAX_TURNS):
        alive_a = [p for p in team_a if p.alive]
        alive_b = [p for p in team_b if p.alive]
        if not alive_a or not alive_b:
            break

        # Sort by speed descending with random tiebreaker
        order = sorted([p for p in all_pieces if p.alive],
                       key=lambda p: (p.effective_speed, random.random()), reverse=True)

        for piece in order:
            if not piece.alive or piece.cooldown_until > turn:
                continue

            target = find_nearest_enemy(piece, all_pieces)
            if not target:
                continue

            if in_attack_range(piece.pos, target.pos, piece.atk_range):
                cd = get_cooldown(piece.effective_speed)
                if piece.mana >= piece.max_mana and piece.skill_name:
                    do_skill(piece, target, all_pieces, turn)
                    piece.cooldown_until = turn + cd + 3  # skill cast time
                else:
                    do_auto_attack(piece, target, turn)
                    piece.cooldown_until = turn + cd + 2  # attack duration
            else:
                move_toward(piece, target, all_pieces)
                cd = get_cooldown(piece.effective_speed)
                piece.cooldown_until = turn + 1

    alive_a = [p for p in team_a if p.alive]
    alive_b = [p for p in team_b if p.alive]
    remaining_hp_a = sum(p.hp for p in alive_a)
    remaining_hp_b = sum(p.hp for p in alive_b)

    if alive_a and not alive_b:
        winner = "A"
    elif alive_b and not alive_a:
        winner = "B"
    else:
        winner = "Draw"

    return {"winner": winner, "turn": turn + 1, "hp_a": remaining_hp_a, "hp_b": remaining_hp_b,
            "alive_a": len(alive_a), "alive_b": len(alive_b)}


# ─── BENCHMARK RUNNER ─────────────────────────────────────────────────

TEAM_COMPS = {
    "Fire+Metal": [43, 44, 41, 42, 47],  # Agnigon, Cardinale, Pyraminx, AV8R, Kirkanon
    "Earth+Wood": [39, 37, 38, 40, 29],   # Grintrock, Arbelder, Viviphyta, Jemuar, Aardart
    "Water+Cunning": [45, 46, 35, 36, 25], # Nudikill, Eaglace, Nudimind, Dollfin, Noctalo
    "Fire+Valiant": [43, 23, 14, 39, 41],  # Agnigon, Ignibus, Agnite, Grintrock, Pyraminx
    "Metal+Arcane": [47, 42, 41, 32, 30],  # Kirkanon, AV8R, Pyraminx, Cairfrey, Hubursa
    "Mixed Carries": [42, 44, 46, 39, 37], # AV8R, Cardinale, Eaglace, Grintrock, Arbelder
}

N_SIMULATIONS = 200  # Per matchup


def create_team(comp_ids, owner, stage=1, formation="tank_front"):
    pieces = []
    for i, cid in enumerate(comp_ids):
        p = make_piece(f"{owner}_{i}", owner, cid, stage=stage)
        pieces.append(p)
    FORMATIONS[formation](pieces, owner)
    return pieces


def run_comp_benchmark(n=N_SIMULATIONS, stage=1):
    """Run all team comp matchups."""
    comp_names = list(TEAM_COMPS.keys())
    results = {}

    for i, name_a in enumerate(comp_names):
        for j, name_b in enumerate(comp_names):
            if j <= i:
                continue
            key = f"{name_a} vs {name_b}"
            wins_a, wins_b, draws = 0, 0, 0
            total_turns = 0

            for _ in range(n):
                team_a = create_team(TEAM_COMPS[name_a], "A", stage)
                team_b = create_team(TEAM_COMPS[name_b], "B", stage)
                result = simulate_match(team_a, team_b)
                if result["winner"] == "A":
                    wins_a += 1
                elif result["winner"] == "B":
                    wins_b += 1
                else:
                    draws += 1
                total_turns += result["turn"]

            results[key] = {
                "a": name_a, "b": name_b,
                "wins_a": wins_a, "wins_b": wins_b, "draws": draws,
                "avg_turns": total_turns / n,
                "winrate_a": wins_a / n * 100, "winrate_b": wins_b / n * 100,
            }
    return results


def run_formation_benchmark(n=N_SIMULATIONS, stage=1):
    """Compare formations for each team comp vs random opponents."""
    results = {}
    comp_names = list(TEAM_COMPS.keys())

    for comp_name in comp_names:
        formation_wins = {f: 0 for f in FORMATIONS}
        formation_total = {f: 0 for f in FORMATIONS}

        for form_name in FORMATIONS:
            for opp_name in comp_names:
                if opp_name == comp_name:
                    continue
                for _ in range(n // len(comp_names)):
                    team_a = create_team(TEAM_COMPS[comp_name], "A", stage, form_name)
                    team_b = create_team(TEAM_COMPS[opp_name], "B", stage, "tank_front")
                    result = simulate_match(team_a, team_b)
                    formation_total[form_name] += 1
                    if result["winner"] == "A":
                        formation_wins[form_name] += 1

        results[comp_name] = {
            f: (formation_wins[f] / max(1, formation_total[f]) * 100)
            for f in FORMATIONS
        }
    return results


# ─── MARKDOWN GENERATORS ──────────────────────────────────────────────

def generate_team_comp_md(comp_results):
    lines = [
        "# Team Comp Win Rates (Auto-Generated from Battle Simulation)",
        "",
        f"> {N_SIMULATIONS} simulations per matchup at ★★ stage. Deterministic combat with skills, synergies, and type bonuses.",
        "> Formation: Tank Front for both sides.",
        "",
        "## Head-to-Head Results",
        "",
        "| Matchup | Win Rate A | Win Rate B | Draws | Avg Turns |",
        "|---------|-----------|-----------|-------|-----------|",
    ]

    for key, r in comp_results.items():
        lines.append(
            f"| **{r['a']}** vs **{r['b']}** "
            f"| {r['winrate_a']:.0f}% ({r['wins_a']}) "
            f"| {r['winrate_b']:.0f}% ({r['wins_b']}) "
            f"| {r['draws']} | {r['avg_turns']:.0f} |"
        )

    lines.append("")
    lines.append("## Overall Win Rate Ranking")
    lines.append("")

    # Aggregate wins
    comp_names = list(TEAM_COMPS.keys())
    total_wins = {name: 0 for name in comp_names}
    total_games = {name: 0 for name in comp_names}
    for r in comp_results.values():
        total_wins[r["a"]] += r["wins_a"]
        total_wins[r["b"]] += r["wins_b"]
        total_games[r["a"]] += N_SIMULATIONS
        total_games[r["b"]] += N_SIMULATIONS

    ranked = sorted(comp_names, key=lambda n: total_wins[n] / max(1, total_games[n]), reverse=True)
    lines.append("| Rank | Team Comp | Total Wins | Total Games | Overall Win Rate |")
    lines.append("|------|-----------|-----------|-------------|-----------------|")
    for rank, name in enumerate(ranked, 1):
        wr = total_wins[name] / max(1, total_games[name]) * 100
        lines.append(f"| {rank} | {name} | {total_wins[name]} | {total_games[name]} | {wr:.1f}% |")

    # Comp details
    lines.append("")
    lines.append("## Team Compositions")
    lines.append("")
    for name, ids in TEAM_COMPS.items():
        creatures = []
        for cid in ids:
            raw = next(r for r in CREATURES_RAW if r[0] == cid)
            creatures.append(f"{raw[1]} (cost {raw[3]}, {raw[2][0]}/{raw[2][1]})")
        lines.append(f"- **{name}**: {', '.join(creatures)}")

    lines.append("")
    return "\n".join(lines)


def generate_formation_md(form_results):
    lines = [
        "# Formation Benchmarks (Auto-Generated from Battle Simulation)",
        "",
        f"> {N_SIMULATIONS} simulations per formation per matchup at ★★ stage.",
        "> Each formation tested against all other comps using Tank Front.",
        "",
        "## Win Rate by Formation",
        "",
        "| Team Comp | Tank Front | Spread | Corner | Best Formation |",
        "|-----------|-----------|--------|--------|---------------|",
    ]

    for comp_name, rates in form_results.items():
        best = max(rates, key=rates.get)
        lines.append(
            f"| {comp_name} "
            f"| {rates.get('tank_front', 0):.1f}% "
            f"| {rates.get('spread', 0):.1f}% "
            f"| {rates.get('corner', 0):.1f}% "
            f"| **{best.replace('_', ' ').title()}** |"
        )

    lines.append("")
    lines.append("## Formation Descriptions")
    lines.append("")
    lines.append("- **Tank Front**: Valiant/tank pieces in front row, carries behind")
    lines.append("- **Spread**: Pieces spread evenly across all 3 rows")
    lines.append("- **Corner**: All pieces clustered in one corner")
    lines.append("")
    return "\n".join(lines)


# ─── MAIN ─────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Running team comp benchmarks...")
    comp_results = run_comp_benchmark()
    content = generate_team_comp_md(comp_results)
    path = OUTPUT_DIR / "team-comp-winrates.md"
    path.write_text(content, encoding="utf-8")
    print(f"  -> {path} ({len(content)} bytes)")

    print("Running formation benchmarks...")
    form_results = run_formation_benchmark()
    content = generate_formation_md(form_results)
    path = OUTPUT_DIR / "formation-benchmarks.md"
    path.write_text(content, encoding="utf-8")
    print(f"  -> {path} ({len(content)} bytes)")

    print(f"\nDone! Phase 2 complete.")


if __name__ == "__main__":
    main()
