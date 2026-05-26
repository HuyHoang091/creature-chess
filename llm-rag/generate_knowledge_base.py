"""
Auto-generate RAG knowledge base from game engine formulas.

This script replicates the exact formulas from the TypeScript game engine
to produce verified, data-driven markdown files for the RAG system.

Source of truth:
- Stats: modules/@creature-chess/gamemode/src/definitions/definitionClass.ts
- Definitions: modules/@creature-chess/gamemode/src/definitions/index.ts
- Items: modules/@creature-chess/models/src/itemCatalog.ts
- Type relations: modules/@creature-chess/battle/src/utils/typeRelations.ts
- Synergies: modules/@creature-chess/models/gamemode/elementSynergyBalance.ts
- Roll odds: modules/@creature-chess/gamemode/src/game/cardDeck.ts
- Damage: modules/@creature-chess/battle/src/utils/getHitDamage.ts
- Cooldown: modules/@creature-chess/battle/src/utils/getCooldownForSpeed.ts
"""

import json
import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ─── OUTPUT DIR ──────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "data" / "auto-generated"

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1: GAME DATA (exact copy from TypeScript source)
# ═══════════════════════════════════════════════════════════════════════════

# --- Trait builds (definitionClass.ts) ---
TRAIT_BUILDS = {
    "valiant": {"hp": 0.4, "attack": 0.2, "defense": 0.3, "speed": 0.2},
    "arcane":  {"hp": 0.2, "attack": 0.4, "defense": 0.2, "speed": 0.3},
    "cunning": {"hp": 0.15, "attack": 0.8, "defense": 0.1, "speed": 0.65},
}

BASE_STAT = 10
COST_MODIFIER = 1.5
STAGE_MULTIPLIERS = [20, 80, 210]  # stage 0, 1, 2

# --- Type relations (typeRelations.ts) ---
TYPE_INTERACTIONS = {
    "earth": {"generatedBy": "fire", "overcomeBy": "wood"},
    "metal": {"generatedBy": "earth", "overcomeBy": "fire"},
    "water": {"generatedBy": "metal", "overcomeBy": "earth"},
    "wood":  {"generatedBy": "water", "overcomeBy": "metal"},
    "fire":  {"generatedBy": "wood", "overcomeBy": "water"},
}
STRONG_ATTACK_MODIFIER = 1.7
WEAK_ATTACK_MODIFIER = 0.3

# --- Element synergy balance (elementSynergyBalance.ts) ---
ELEMENT_SYNERGY_BALANCE = {
    "fire": [
        {"amount": 2, "attackPct": 0.08},
        {"amount": 4, "attackPct": 0.16},
        {"amount": 6, "attackPct": 0.28},
        {"amount": 8, "attackPct": 0.40, "skillDamagePct": 0.10},
        {"amount": 10, "attackPct": 0.55, "skillDamagePct": 0.20},
    ],
    "water": [
        {"amount": 2, "startingManaFlat": 10},
        {"amount": 4, "startingManaFlat": 20},
        {"amount": 6, "startingManaFlat": 30},
        {"amount": 8, "startingManaFlat": 40, "speedFlat": 20},
        {"amount": 10, "startingManaFlat": 50, "speedFlat": 40},
    ],
    "earth": [
        {"amount": 2, "defensePct": 0.04},
        {"amount": 4, "defensePct": 0.08, "hpPct": 0.03},
        {"amount": 6, "defensePct": 0.14, "hpPct": 0.06},
        {"amount": 8, "defensePct": 0.20, "hpPct": 0.10},
        {"amount": 10, "defensePct": 0.28, "hpPct": 0.15, "damageReductionPct": 0.05},
    ],
    "wood": [
        {"amount": 2, "hpPct": 0.06},
        {"amount": 4, "hpPct": 0.10},
        {"amount": 6, "hpPct": 0.15},
        {"amount": 8, "hpPct": 0.20, "healAmpPct": 0.08},
        {"amount": 10, "hpPct": 0.26, "healAmpPct": 0.15},
    ],
    "metal": [
        {"amount": 2, "defenseFlat": 5},
        {"amount": 4, "defenseFlat": 10},
        {"amount": 6, "defenseFlat": 16},
        {"amount": 8, "defenseFlat": 22, "attackFlat": 8},
        {"amount": 10, "defenseFlat": 30, "attackFlat": 14},
    ],
}

# --- Skill library (definitions/index.ts) ---
SKILL_LIB = {
    "FIRE_AOE":       {"name": "Flame Burst", "type": "damage", "target": "aoe", "manaCost": 100},
    "WATER_BOUNCE":   {"name": "Chain Lightning", "type": "damage", "target": "bounce", "manaCost": 90},
    "WOOD_HEAL":      {"name": "Nature Blessing", "type": "support", "target": "aoe", "manaCost": 120},
    "WOOD_HEAL_SINGLE": {"name": "Mend", "type": "support", "target": "single", "manaCost": 70},
    "METAL_PIERCE":   {"name": "Fatal Thrust", "type": "damage", "target": "single", "manaCost": 60},
    "EARTH_STOMP":    {"name": "Earthquake", "type": "damage", "target": "aoe", "manaCost": 110},
    "BUFF_SELF":      {"name": "Rage Mode", "type": "buff", "target": "single", "manaCost": 50},
    "PIERCE_LINE":    {"name": "Laser Beam", "type": "damage", "target": "line", "manaCost": 80},
}

# --- Creature definitions (definitions/index.ts) ---
CREATURES_RAW = [
    (1,  "Budaye",       ["wood", "valiant"],  1, "WOOD_HEAL_SINGLE"),
    (2,  "Anoleaf",      ["wood", "cunning"],  1, "WOOD_HEAL_SINGLE"),
    (3,  "Rockitten",    ["earth", "valiant"], 1, "EARTH_STOMP"),
    (4,  "Aardorn",      ["earth", "cunning"], 1, "BUFF_SELF"),
    (5,  "Nut",          ["metal", "valiant"], 1, "METAL_PIERCE"),
    (6,  "Puparmor",     ["metal", "valiant"], 1, "BUFF_SELF"),
    (7,  "Embra",        ["fire", "arcane"],   1, "FIRE_AOE"),
    (8,  "Tweesher",     ["water", "arcane"],  1, "WATER_BOUNCE"),
    (9,  "Bamboon",      ["wood", "valiant"],  2, "WOOD_HEAL"),
    (10, "Chenipode",    ["earth", "cunning"], 2, "EARTH_STOMP"),
    (11, "Bolt",         ["metal", "valiant"], 2, "PIERCE_LINE"),
    (12, "Weavifly",     ["metal", "arcane"],  1, "METAL_PIERCE"),
    (13, "Cardiling",    ["fire", "cunning"],  2, "FIRE_AOE"),
    (14, "Agnite",       ["fire", "valiant"],  2, "FIRE_AOE"),
    (15, "Elowind",      ["water", "arcane"],  2, "WATER_BOUNCE"),
    (16, "Fluttaflap",   ["water", "valiant"], 2, "WATER_BOUNCE"),
    (17, "Velocitile",   ["wood", "cunning"],  3, "METAL_PIERCE"),
    (18, "Sapsnap",      ["wood", "valiant"],  3, "WOOD_HEAL_SINGLE"),
    (19, "Rockat",       ["earth", "cunning"], 3, "EARTH_STOMP"),
    (20, "Grintot",      ["earth", "valiant"], 3, "EARTH_STOMP"),
    (21, "Propellorcat", ["metal", "cunning"], 3, "BUFF_SELF"),
    (22, "Sumchon",      ["metal", "valiant"], 3, "METAL_PIERCE"),
    (23, "Ignibus",      ["fire", "valiant"],  3, "FIRE_AOE"),
    (24, "Ruption",      ["fire", "arcane"],   3, "FIRE_AOE"),
    (25, "Noctalo",      ["water", "cunning"], 3, "WATER_BOUNCE"),
    (26, "Lightmare",    ["water", "valiant"], 3, "WATER_BOUNCE"),
    (27, "Narcileaf",    ["wood", "arcane"],   4, "WOOD_HEAL"),
    (28, "Coleorus",     ["wood", "cunning"],  4, "WOOD_HEAL_SINGLE"),
    (29, "Aardart",      ["earth", "cunning"], 4, "EARTH_STOMP"),
    (30, "Hubursa",      ["earth", "arcane"],  4, "BUFF_SELF"),
    (31, "Sampsack",     ["metal", "valiant"], 4, "PIERCE_LINE"),
    (32, "Cairfrey",     ["metal", "arcane"],  3, "METAL_PIERCE"),
    (33, "Prophetoise",  ["fire", "arcane"],   4, "FIRE_AOE"),
    (34, "Tikorch",      ["fire", "cunning"],  4, "FIRE_AOE"),
    (35, "Nudimind",     ["water", "arcane"],  4, "WATER_BOUNCE"),
    (36, "Dollfin",      ["water", "valiant"], 4, "WOOD_HEAL_SINGLE"),
    (37, "Arbelder",     ["wood", "valiant"],  5, "WOOD_HEAL"),
    (38, "Viviphyta",    ["wood", "cunning"],  5, "WOOD_HEAL_SINGLE"),
    (39, "Grintrock",    ["earth", "valiant"], 5, "EARTH_STOMP"),
    (40, "Jemuar",       ["earth", "cunning"], 5, "BUFF_SELF"),
    (41, "Pyraminx",     ["metal", "valiant"], 5, "PIERCE_LINE"),
    (42, "AV8R",         ["metal", "cunning"], 5, "PIERCE_LINE"),
    (43, "Agnigon",      ["fire", "valiant"],  5, "FIRE_AOE"),
    (44, "Cardinale",    ["fire", "cunning"],  5, "FIRE_AOE"),
    (45, "Nudikill",     ["water", "valiant"], 5, "WATER_BOUNCE"),
    (46, "Eaglace",      ["water", "cunning"], 5, "WATER_BOUNCE"),
    (47, "Kirkanon",     ["metal", "arcane"],  5, "METAL_PIERCE"),
]

# --- Items (itemCatalog.ts) ---
BASE_ITEMS = {
    "BF_SWORD":    {"name": "B.F. Sword", "stats": {"attack": 15}},
    "CHAIN_VEST":  {"name": "Chain Vest", "stats": {"defense": 15}},
    "GIANTS_BELT": {"name": "Giant's Belt", "stats": {"hp": 150}},
    "RECURVE_BOW": {"name": "Recurve Bow", "stats": {"speed": 15}},
    "TEAR":        {"name": "Tear of the Goddess", "stats": {"mana": 15}},
    "CLOAK":       {"name": "Negatron Cloak", "stats": {"defense": 10, "speed": 10}},
    "ROD":         {"name": "Needlessly Large Rod", "stats": {"attack": 10, "mana": 10}},
    "GLOVES":      {"name": "Sparring Gloves", "stats": {"attack": 8, "speed": 8}},
}

COMBINED_ITEMS = {
    "INFINITY_EDGE":  {"name": "Infinity Edge", "stats": {"attack": 40}, "passive": None, "recipe": ["BF_SWORD", "BF_SWORD"]},
    "WARMOG":         {"name": "Warmog's Armor", "stats": {"hp": 400}, "passive": None, "recipe": ["GIANTS_BELT", "GIANTS_BELT"]},
    "BLOODTHIRSTER":  {"name": "Bloodthirster", "stats": {"attack": 20, "defense": 10, "speed": 10}, "passive": "Lifesteal 20%", "recipe": ["BF_SWORD", "CLOAK"]},
    "RAPID_FIRE":     {"name": "Rapid Firecannon", "stats": {"speed": 40}, "passive": None, "recipe": ["RECURVE_BOW", "RECURVE_BOW"]},
    "FROZEN_HEART":   {"name": "Frozen Heart", "stats": {"defense": 15, "mana": 15}, "passive": "Slow attackers 2s", "recipe": ["CHAIN_VEST", "TEAR"]},
    "GUARDIAN_ANGEL":  {"name": "Guardian Angel", "stats": {"attack": 15, "defense": 15}, "passive": "Revive 50% HP once", "recipe": ["BF_SWORD", "CHAIN_VEST"]},
    "RABADON":        {"name": "Rabadon's Deathcap", "stats": {"attack": 25, "mana": 25}, "passive": None, "recipe": ["ROD", "ROD"]},
    "PHANTOM_DANCER": {"name": "Phantom Dancer", "stats": {"speed": 15, "defense": 15}, "passive": "15% dodge", "recipe": ["RECURVE_BOW", "CHAIN_VEST"]},
    "THORNMAIL":      {"name": "Thornmail", "stats": {"defense": 40}, "passive": "Reflect 20% ATK dmg", "recipe": ["CHAIN_VEST", "CHAIN_VEST"]},
}

# --- Card deck (cardDeck.ts) ---
CARD_COST_CHANCES = [
    [100, 70, 60, 50, 40, 33, 30, 24, 22, 19],
    [0, 30, 35, 35, 35, 30, 30, 30, 30, 25],
    [0, 0, 5, 15, 23, 30, 30, 30, 25, 25],
    [0, 0, 0, 2, 5, 9, 12, 16, 20, 25],
    [0, 0, 0, 0, 1, 3, 5, 7, 10, 14],
]
CARD_DEFINITION_QUANTITIES = [29, 22, 18, 10, 9]


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2: FORMULAS (exact replicas of TypeScript)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class CreatureStats:
    hp: int
    attack: int
    defense: int
    speed: int
    attack_type: str  # "basic" (range 1) or "shoot" (range 2)
    max_mana: Optional[int] = None
    skill_name: Optional[str] = None
    skill_type: Optional[str] = None
    skill_target: Optional[str] = None
    skill_mana_cost: Optional[int] = None


@dataclass
class Creature:
    id: int
    name: str
    element: str
    combat_trait: str
    cost: int
    skill_key: str
    stages: List[CreatureStats] = field(default_factory=list)


def get_points(cost: int, stage: int) -> float:
    """Exact replica of getPoints() from definitionClass.ts"""
    return cost * COST_MODIFIER * STAGE_MULTIPLIERS[stage]


def get_stat(base_stat: int, build_stat: float, available_points: float) -> int:
    """Exact replica of getStat() from definitionClass.ts"""
    return base_stat + math.ceil(build_stat * available_points)


def compute_stats(traits: List[str], cost: int, stage: int, skill_key: str) -> CreatureStats:
    """Exact replica of getStats() from definitionClass.ts"""
    combat_trait = traits[1]  # 2nd trait determines build
    build = TRAIT_BUILDS.get(combat_trait, {"hp": 0.01, "attack": 0.01, "defense": 0.01, "speed": 0.01})
    points = get_points(cost, stage)

    attack_type = "shoot" if combat_trait == "arcane" else "basic"

    raw_hp = get_stat(BASE_STAT, build["hp"], points)
    raw_atk = get_stat(BASE_STAT, build["attack"], points)
    raw_def = get_stat(BASE_STAT, build["defense"], points)
    raw_spd = get_stat(BASE_STAT, build["speed"], points)

    skill = SKILL_LIB.get(skill_key)

    return CreatureStats(
        hp=raw_hp * 5,  # HP is multiplied by 5
        attack=raw_atk,
        defense=raw_def,
        speed=raw_spd,
        attack_type=attack_type,
        max_mana=skill["manaCost"] if skill else None,
        skill_name=skill["name"] if skill else None,
        skill_type=skill["type"] if skill else None,
        skill_target=skill["target"] if skill else None,
        skill_mana_cost=skill["manaCost"] if skill else None,
    )


def build_creatures() -> List[Creature]:
    """Build all 47 creatures with their 3 stages."""
    creatures = []
    for cid, name, traits, cost, skill_key in CREATURES_RAW:
        c = Creature(
            id=cid, name=name, element=traits[0],
            combat_trait=traits[1], cost=cost, skill_key=skill_key,
        )
        for stage in range(3):
            c.stages.append(compute_stats(traits, cost, stage, skill_key))
        creatures.append(c)
    return creatures


def get_cooldown(speed: int) -> int:
    """Exact replica of getCooldownForSpeed() — ceil((180 - speed) / 24)"""
    return max(0, math.ceil((180 - speed) / 24))


def get_type_bonus(attacker_element: str, defender_element: str) -> float:
    """Simplified: just check element-to-element interaction."""
    interaction = TYPE_INTERACTIONS.get(defender_element)
    if interaction and interaction["overcomeBy"] == attacker_element:
        return STRONG_ATTACK_MODIFIER  # attacker beats defender

    interaction = TYPE_INTERACTIONS.get(attacker_element)
    if interaction and interaction["overcomeBy"] == defender_element:
        return WEAK_ATTACK_MODIFIER  # defender beats attacker

    return 1.0


def get_hit_damage(atk: int, defense: int, type_bonus: float = 1.0) -> int:
    """Exact replica of getHitDamage: ceil((ATK / DEF) * typeBonus * 8)"""
    return math.ceil((atk / defense) * type_bonus * 8)


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3: GENERATORS
# ═══════════════════════════════════════════════════════════════════════════

def generate_creature_stats_md(creatures: List[Creature]) -> str:
    """Phase 1A: Complete creature stats table."""
    lines = [
        "# Creature Stats Reference (Auto-Generated from Game Engine)",
        "",
        "> Source: `definitionClass.ts` formulas. HP = (base + ceil(build_ratio × cost × 1.5 × stage_mult)) × 5",
        "> Damage formula: `ceil((ATK / DEF) × typeBonus × 8)`",
        "> Cooldown formula: `ceil((180 - SPD) / 24)` turns between attacks",
        "",
    ]

    stage_labels = ["★", "★★", "★★★"]

    for cost in range(1, 6):
        cost_creatures = [c for c in creatures if c.cost == cost]
        if not cost_creatures:
            continue

        lines.append(f"## Cost {cost} Creatures")
        lines.append("")
        lines.append("| Creature | Element | Combat | Stage | HP | ATK | DEF | SPD | Cooldown | Range | Skill | Mana |")
        lines.append("|----------|---------|--------|-------|----|-----|-----|-----|----------|-------|-------|------|")

        for c in sorted(cost_creatures, key=lambda x: x.name):
            for stage_idx, stats in enumerate(c.stages):
                cooldown = get_cooldown(stats.speed)
                range_str = "2 (ranged)" if stats.attack_type == "shoot" else "1 (melee)"
                skill_str = f"{stats.skill_name} ({stats.skill_target})" if stats.skill_name else "-"
                mana_str = str(stats.skill_mana_cost) if stats.skill_mana_cost else "-"
                lines.append(
                    f"| {c.name} | {c.element} | {c.combat_trait} | {stage_labels[stage_idx]} "
                    f"| {stats.hp} | {stats.attack} | {stats.defense} | {stats.speed} "
                    f"| {cooldown} | {range_str} | {skill_str} | {mana_str} |"
                )

        lines.append("")

    return "\n".join(lines)


def generate_dps_ranking_md(creatures: List[Creature]) -> str:
    """Phase 1B: DPS ranking across all creatures."""
    lines = [
        "# DPS Ranking (Auto-Generated from Game Engine)",
        "",
        "> DPS = damage_per_hit / cooldown_turns (damage against average DEF at same cost+stage)",
        "> Higher DPS = faster kills. Cooldown of 0 means attack every turn.",
        "",
    ]

    for stage_idx, stage_label in enumerate(["★ (Stage 1)", "★★ (Stage 2)", "★★★ (Stage 3)"]):
        lines.append(f"## {stage_label}")
        lines.append("")

        # Calculate average DEF at this stage for normalization
        all_defs = [c.stages[stage_idx].defense for c in creatures]
        avg_def = sum(all_defs) / len(all_defs) if all_defs else 1

        dps_list = []
        for c in creatures:
            s = c.stages[stage_idx]
            cooldown = get_cooldown(s.speed)
            damage_vs_avg = get_hit_damage(s.attack, avg_def)
            effective_turns = max(1, cooldown + 1)  # +1 because attack itself takes a turn
            dps = damage_vs_avg / effective_turns
            dps_list.append((c, s, cooldown, damage_vs_avg, dps))

        dps_list.sort(key=lambda x: x[4], reverse=True)

        lines.append(f"Average DEF at this stage: {avg_def:.0f}")
        lines.append("")
        lines.append("| Rank | Creature | Cost | ATK | SPD | Cooldown | DMG/hit (vs avg) | Eff. DPS | Role |")
        lines.append("|------|----------|------|-----|-----|----------|-----------------|----------|------|")

        for rank, (c, s, cd, dmg, dps) in enumerate(dps_list, 1):
            role = f"{c.combat_trait} {'ranged' if s.attack_type == 'shoot' else 'melee'}"
            lines.append(
                f"| {rank} | {c.name} | {c.cost} | {s.attack} | {s.speed} "
                f"| {cd} | {dmg} | {dps:.1f} | {role} |"
            )

        lines.append("")

    return "\n".join(lines)


def generate_matchup_matrix_md(creatures: List[Creature]) -> str:
    """Phase 1C: 1v1 matchup analysis for cost 4-5 creatures."""
    lines = [
        "# 1v1 Matchup Matrix (Auto-Generated from Game Engine)",
        "",
        "> Shows hits-to-kill in 1v1 at ★★ stage. Format: 'A needs X hits, B needs Y hits → Winner'",
        "> Type bonus: overcome = 1.7×, generated = 0.3×, neutral = 1.0×",
        "> Does NOT account for skills, items, or positioning — only auto-attacks.",
        "",
    ]

    high_cost = [c for c in creatures if c.cost >= 4]
    high_cost.sort(key=lambda x: (-x.cost, x.name))

    stage = 1  # ★★

    lines.append("## Cost 4-5 Creatures at ★★")
    lines.append("")

    for i, a in enumerate(high_cost):
        for j, b in enumerate(high_cost):
            if j <= i:
                continue

            a_stats = a.stages[stage]
            b_stats = b.stages[stage]

            type_bonus_a = get_type_bonus(a.element, b.element)
            type_bonus_b = get_type_bonus(b.element, a.element)

            dmg_a_to_b = get_hit_damage(a_stats.attack, b_stats.defense, type_bonus_a)
            dmg_b_to_a = get_hit_damage(b_stats.attack, a_stats.defense, type_bonus_b)

            hits_a_kills_b = math.ceil(b_stats.hp / max(1, dmg_a_to_b))
            hits_b_kills_a = math.ceil(a_stats.hp / max(1, dmg_b_to_a))

            # Factor in speed (who attacks first and more often)
            cd_a = get_cooldown(a_stats.speed)
            cd_b = get_cooldown(b_stats.speed)

            turns_a_needs = hits_a_kills_b * (cd_a + 1)
            turns_b_needs = hits_b_kills_a * (cd_b + 1)

            if turns_a_needs < turns_b_needs:
                winner = a.name
                verdict = f"{a.name} wins"
            elif turns_b_needs < turns_a_needs:
                winner = b.name
                verdict = f"{b.name} wins"
            else:
                verdict = "Draw (close)"

            type_note_a = ""
            if type_bonus_a == 1.7:
                type_note_a = f" ({a.element}→{b.element} 1.7×)"
            elif type_bonus_a == 0.3:
                type_note_a = f" ({a.element}→{b.element} 0.3×)"

            type_note_b = ""
            if type_bonus_b == 1.7:
                type_note_b = f" ({b.element}→{a.element} 1.7×)"
            elif type_bonus_b == 0.3:
                type_note_b = f" ({b.element}→{a.element} 0.3×)"

            lines.append(
                f"- **{a.name}** (cost {a.cost}, {a.element}/{a.combat_trait}) vs "
                f"**{b.name}** (cost {b.cost}, {b.element}/{b.combat_trait}): "
                f"{a.name} deals {dmg_a_to_b}/hit{type_note_a} in {hits_a_kills_b} hits ({turns_a_needs} turns), "
                f"{b.name} deals {dmg_b_to_a}/hit{type_note_b} in {hits_b_kills_a} hits ({turns_b_needs} turns) "
                f"→ **{verdict}**"
            )

    lines.append("")
    lines.append("## Key Takeaways (auto-derived)")
    lines.append("")

    # Generate tier list from matchup wins
    cost5 = [c for c in creatures if c.cost == 5]
    win_counts = {c.name: 0 for c in cost5}
    for i, a in enumerate(cost5):
        for j, b in enumerate(cost5):
            if j <= i:
                continue
            a_s = a.stages[stage]
            b_s = b.stages[stage]
            tb_a = get_type_bonus(a.element, b.element)
            tb_b = get_type_bonus(b.element, a.element)
            dmg_a = get_hit_damage(a_s.attack, b_s.defense, tb_a)
            dmg_b = get_hit_damage(b_s.attack, a_s.defense, tb_b)
            turns_a = math.ceil(b_s.hp / max(1, dmg_a)) * (get_cooldown(a_s.speed) + 1)
            turns_b = math.ceil(a_s.hp / max(1, dmg_b)) * (get_cooldown(b_s.speed) + 1)
            if turns_a < turns_b:
                win_counts[a.name] += 1
            elif turns_b < turns_a:
                win_counts[b.name] += 1
            else:
                win_counts[a.name] += 0.5
                win_counts[b.name] += 0.5

    sorted_wins = sorted(win_counts.items(), key=lambda x: x[1], reverse=True)
    total_matchups = len(cost5) - 1
    lines.append("### Cost-5 1v1 Win Rate (★★, auto-attack only, no items/skills)")
    lines.append("")
    lines.append("| Creature | 1v1 Wins | Win Rate |")
    lines.append("|----------|----------|----------|")
    for name, wins in sorted_wins:
        c_obj = next(c for c in cost5 if c.name == name)
        rate = (wins / total_matchups) * 100 if total_matchups > 0 else 0
        lines.append(f"| {name} ({c_obj.element}/{c_obj.combat_trait}) | {wins:.1f}/{total_matchups} | {rate:.0f}% |")

    lines.append("")
    return "\n".join(lines)


def generate_synergy_breakpoints_md(creatures: List[Creature]) -> str:
    """Phase 1D: Synergy tier impact analysis."""
    lines = [
        "# Synergy Breakpoints & Impact (Auto-Generated from Game Engine)",
        "",
        "> Shows exact stat bonuses at each synergy tier and the real impact on cost-5 ★★ creatures.",
        "",
    ]

    # Get a representative cost-5 creature for each element
    cost5 = [c for c in creatures if c.cost == 5]

    for element, tiers in ELEMENT_SYNERGY_BALANCE.items():
        lines.append(f"## {element.title()} Synergy")
        lines.append("")

        # Count how many creatures of this element exist
        element_creatures = [c for c in creatures if c.element == element]
        lines.append(f"Available {element} creatures: {len(element_creatures)} — " +
                     ", ".join(f"{c.name}(cost {c.cost})" for c in sorted(element_creatures, key=lambda x: x.cost)))
        lines.append("")

        lines.append("| Tier | Required | Bonuses | Impact on cost-5 ★★ |")
        lines.append("|------|----------|---------|---------------------|")

        for tier in tiers:
            # Describe bonuses
            bonus_parts = []
            for key, val in tier.items():
                if key == "amount":
                    continue
                if "Pct" in key:
                    stat_name = key.replace("Pct", "").replace("attack", "ATK").replace("defense", "DEF").replace("hp", "HP").replace("speed", "SPD").replace("healAmp", "Heal Amp").replace("skillDamage", "Skill DMG").replace("damageReduction", "DMG Reduction")
                    bonus_parts.append(f"+{val*100:.0f}% {stat_name}")
                elif "Flat" in key:
                    stat_name = key.replace("Flat", "").replace("attack", "ATK").replace("defense", "DEF").replace("hp", "HP").replace("speed", "SPD").replace("startingMana", "Starting Mana")
                    bonus_parts.append(f"+{val} {stat_name}")

            # Calculate real impact on a cost-5 creature
            impact_parts = []
            representative = next((c for c in cost5 if c.element == element), None)
            if representative:
                s = representative.stages[1]  # ★★
                for key, val in tier.items():
                    if key == "amount":
                        continue
                    if key == "attackPct":
                        bonus = math.ceil(s.attack * val)
                        impact_parts.append(f"+{bonus} ATK on {representative.name}")
                    elif key == "attackFlat":
                        impact_parts.append(f"+{val} ATK on {representative.name}")
                    elif key == "defensePct":
                        bonus = math.ceil(s.defense * val)
                        impact_parts.append(f"+{bonus} DEF on {representative.name}")
                    elif key == "defenseFlat":
                        impact_parts.append(f"+{val} DEF on {representative.name}")
                    elif key == "hpPct":
                        bonus = math.ceil(s.hp * val)
                        impact_parts.append(f"+{bonus} HP on {representative.name}")
                    elif key == "speedFlat":
                        old_cd = get_cooldown(s.speed)
                        new_cd = get_cooldown(s.speed + val)
                        impact_parts.append(f"+{val} SPD (cooldown {old_cd}→{new_cd})")
                    elif key == "startingManaFlat":
                        if s.skill_mana_cost:
                            pct_filled = val / s.skill_mana_cost * 100
                            impact_parts.append(f"+{val} starting mana ({pct_filled:.0f}% of {s.skill_mana_cost} skill cost)")
                        else:
                            impact_parts.append(f"+{val} starting mana")
                    elif key == "skillDamagePct":
                        impact_parts.append(f"+{val*100:.0f}% skill damage")
                    elif key == "healAmpPct":
                        impact_parts.append(f"+{val*100:.0f}% healing amplification")
                    elif key == "damageReductionPct":
                        impact_parts.append(f"+{val*100:.0f}% damage reduction")

            feasibility = ""
            count_needed = tier["amount"]
            available = len(element_creatures)
            if count_needed <= available:
                feasibility = f" (need {count_needed}/{available} available)"
            else:
                feasibility = f" (**IMPOSSIBLE**: need {count_needed}, only {available} exist)"

            lines.append(
                f"| {count_needed} | {count_needed} {element}{feasibility} | {', '.join(bonus_parts)} | {', '.join(impact_parts)} |"
            )

        lines.append("")

    return "\n".join(lines)


def generate_item_efficiency_md(creatures: List[Creature]) -> str:
    """Phase 1E: Item efficiency analysis."""
    lines = [
        "# Item Efficiency Analysis (Auto-Generated from Game Engine)",
        "",
        "> Shows exact stat gains and % DPS/survivability impact for each item on different roles.",
        "> Damage formula: ceil((ATK / DEF) * typeBonus * 8)",
        "> Cooldown: ceil((180 - SPD) / 24)",
        "",
    ]

    # Pick representative creatures for each role
    cost5 = {c.name: c for c in creatures if c.cost == 5}
    test_targets = [
        ("Agnigon", "Tanky melee carry (valiant)"),
        ("AV8R", "Fast melee assassin (cunning)"),
        ("Kirkanon", "Ranged carry (arcane)"),
        ("Grintrock", "Primary tank (valiant)"),
        ("Arbelder", "Healer support (valiant)"),
    ]

    # Compute baseline stats (★★)
    lines.append("## Baseline Stats (★★, no items)")
    lines.append("")
    lines.append("| Creature | Role | HP | ATK | DEF | SPD | Cooldown |")
    lines.append("|----------|------|----|-----|-----|-----|----------|")
    for name, role in test_targets:
        c = cost5[name]
        s = c.stages[1]
        cd = get_cooldown(s.speed)
        lines.append(f"| {name} | {role} | {s.hp} | {s.attack} | {s.defense} | {s.speed} | {cd} |")
    lines.append("")

    # Combined items analysis
    lines.append("## Combined Items — Impact Analysis")
    lines.append("")

    for item_id, item in COMBINED_ITEMS.items():
        lines.append(f"### {item['name']} ({item_id})")
        passive_str = f" — Passive: {item['passive']}" if item.get("passive") else ""
        stat_parts = []
        for stat, val in item["stats"].items():
            stat_parts.append(f"+{val} {stat.upper()}")
        lines.append(f"Stats: {', '.join(stat_parts)}{passive_str}")
        if item.get("recipe"):
            recipe_names = [BASE_ITEMS[r]["name"] for r in item["recipe"]]
            lines.append(f"Recipe: {' + '.join(recipe_names)}")
        lines.append("")

        lines.append("| Creature | Stat Change | DPS Change | Survivability Change |")
        lines.append("|----------|-------------|------------|---------------------|")

        for name, role in test_targets:
            c = cost5[name]
            s = c.stages[1]  # ★★

            # Base stats
            base_hp = s.hp
            base_atk = s.attack
            base_def = s.defense
            base_spd = s.speed
            base_cd = get_cooldown(base_spd)

            # With item
            new_hp = base_hp + item["stats"].get("hp", 0)
            new_atk = base_atk + item["stats"].get("attack", 0)
            new_def = base_def + item["stats"].get("defense", 0)
            new_spd = base_spd + item["stats"].get("speed", 0)
            new_cd = get_cooldown(new_spd)

            # DPS change (vs avg DEF)
            avg_def = 100  # Approximate average DEF at cost-5 ★★
            base_dmg = get_hit_damage(base_atk, avg_def)
            new_dmg = get_hit_damage(new_atk, avg_def)
            base_dps = base_dmg / max(1, base_cd + 1)
            new_dps = new_dmg / max(1, new_cd + 1)
            dps_change = ((new_dps - base_dps) / base_dps * 100) if base_dps > 0 else 0

            # Survivability change (EHP = HP * (1 + DEF/100) roughly)
            base_ehp = base_hp  # Simplified
            new_ehp = new_hp
            ehp_change = ((new_ehp - base_ehp) / base_ehp * 100) if base_ehp > 0 else 0

            stat_changes = []
            if item["stats"].get("attack"):
                stat_changes.append(f"ATK {base_atk}→{new_atk}")
            if item["stats"].get("hp"):
                stat_changes.append(f"HP {base_hp}→{new_hp}")
            if item["stats"].get("defense"):
                stat_changes.append(f"DEF {base_def}→{new_def}")
            if item["stats"].get("speed"):
                stat_changes.append(f"SPD {base_spd}→{new_spd} (CD {base_cd}→{new_cd})")

            dps_str = f"+{dps_change:.1f}%" if dps_change > 0 else f"{dps_change:.1f}%"
            ehp_str = f"+{ehp_change:.1f}% HP" if ehp_change > 0 else f"{ehp_change:.1f}%"

            lines.append(f"| {name} | {', '.join(stat_changes)} | {dps_str} | {ehp_str} |")

        lines.append("")

    # Best item per role summary
    lines.append("## Best Item by Role (Summary)")
    lines.append("")
    lines.append("| Role | Best DPS Item | Best Survival Item | Best Utility |")
    lines.append("|------|--------------|-------------------|-------------|")
    lines.append("| Valiant Tank | Thornmail (reflect) | Warmog (+400 HP) | Frozen Heart (slow + mana) |")
    lines.append("| Cunning Carry | Infinity Edge (+40 ATK) | Guardian Angel (revive) | Bloodthirster (lifesteal) |")
    lines.append("| Arcane Carry | Infinity Edge (+40 ATK) | Guardian Angel (revive) | Rapid Firecannon (+40 SPD) |")
    lines.append("| Support/Healer | Rabadon (+25 ATK, +25 Mana) | Warmog (+400 HP) | Frozen Heart (slow + mana) |")
    lines.append("")

    return "\n".join(lines)


def generate_roll_odds_md() -> str:
    """Phase 1F: Exact roll odds tables."""
    lines = [
        "# Roll Odds & Economy Data (Auto-Generated from Game Engine)",
        "",
        "> Source: `cardDeck.ts` — CARD_COST_CHANCES and CARD_DEFINITION_QUANTITIES",
        "",
    ]

    # Roll odds table
    lines.append("## Shop Roll Odds by Level")
    lines.append("")
    lines.append("Each shop gives 5 cards. This table shows the % chance each card is a given cost tier.")
    lines.append("")
    lines.append("| Level | Cost 1 | Cost 2 | Cost 3 | Cost 4 | Cost 5 |")
    lines.append("|-------|--------|--------|--------|--------|--------|")

    for level in range(1, 11):
        row = [f"| {level} "]
        for cost_idx in range(5):
            chance = CARD_COST_CHANCES[cost_idx][level - 1] if level - 1 < len(CARD_COST_CHANCES[cost_idx]) else 0
            row.append(f"| {chance}% ")
        row.append("|")
        lines.append("".join(row))

    lines.append("")

    # Pool sizes
    lines.append("## Unit Pool Sizes")
    lines.append("")
    lines.append("Each creature definition has a fixed number of copies in the shared pool.")
    lines.append("")
    lines.append("| Cost | Copies per creature | # Creatures at this cost | Total cards in pool |")
    lines.append("|------|-------------------|------------------------|-------------------|")

    for cost in range(1, 6):
        qty = CARD_DEFINITION_QUANTITIES[cost - 1]
        count = len([c for c in CREATURES_RAW if c[3] == cost])
        total = qty * count
        lines.append(f"| {cost} | {qty} | {count} | {total} |")

    lines.append("")

    # Probability of finding a specific unit
    lines.append("## Probability of Finding a Specific Unit")
    lines.append("")
    lines.append("Chance of seeing at least 1 copy of a specific unit in a single shop (5 cards),")
    lines.append("assuming full pool (no other players holding copies).")
    lines.append("")
    lines.append("| Level | Specific Cost 1 | Specific Cost 2 | Specific Cost 3 | Specific Cost 4 | Specific Cost 5 |")
    lines.append("|-------|----------------|----------------|----------------|----------------|----------------|")

    for level in range(1, 11):
        row = [f"| {level} "]
        for cost_idx in range(5):
            # Chance this card slot is this cost tier
            tier_chance = CARD_COST_CHANCES[cost_idx][level - 1] / 100.0 if level - 1 < len(CARD_COST_CHANCES[cost_idx]) else 0
            # Number of unique creatures at this cost
            n_creatures = len([c for c in CREATURES_RAW if c[3] == cost_idx + 1])
            if n_creatures == 0 or tier_chance == 0:
                row.append("| 0% ")
                continue
            # P(specific unit | slot is this cost) = 1 / n_creatures (simplified)
            p_specific = tier_chance / n_creatures
            # P(at least 1 in 5 cards) = 1 - (1-p)^5
            p_at_least_one = 1 - (1 - p_specific) ** 5
            row.append(f"| {p_at_least_one*100:.1f}% ")
        row.append("|")
        lines.append("".join(row))

    lines.append("")

    # Reroll cost analysis
    lines.append("## Reroll Cost Analysis")
    lines.append("")
    lines.append("How much gold (rerolls × 2g) to find a specific unit with >50% probability:")
    lines.append("")
    lines.append("| Level | Specific Cost 3 | Specific Cost 4 | Specific Cost 5 |")
    lines.append("|-------|----------------|----------------|----------------|")

    for level in range(4, 11):
        row = [f"| {level} "]
        for cost_idx in [2, 3, 4]:
            tier_chance = CARD_COST_CHANCES[cost_idx][level - 1] / 100.0
            n_creatures = len([c for c in CREATURES_RAW if c[3] == cost_idx + 1])
            if n_creatures == 0 or tier_chance == 0:
                row.append("| ∞ ")
                continue
            p_specific = tier_chance / n_creatures
            p_per_shop = 1 - (1 - p_specific) ** 5
            if p_per_shop <= 0:
                row.append("| ∞ ")
                continue
            # Shops needed for 50% = log(0.5) / log(1 - p_per_shop)
            shops_needed = math.ceil(math.log(0.5) / math.log(1 - p_per_shop))
            gold_cost = shops_needed * 2
            row.append(f"| {gold_cost}g ({shops_needed} rerolls) ")
        row.append("|")
        lines.append("".join(row))

    lines.append("")

    # Upgrade probability
    lines.append("## Upgrade Math")
    lines.append("")
    lines.append("- **★★ (2-star)**: Need 3 copies of same creature")
    lines.append("- **★★★ (3-star)**: Need 9 copies total (3 × ★★)")
    lines.append("")
    lines.append("| Cost | Pool per creature | Needed for ★★★ | Remaining in pool after ★★★ |")
    lines.append("|------|------------------|----------------|----------------------------|")
    for cost in range(1, 6):
        qty = CARD_DEFINITION_QUANTITIES[cost - 1]
        needed = 9
        remaining = qty - needed
        feasibility = "✅ Possible" if remaining >= 0 else "❌ Impossible"
        lines.append(f"| {cost} | {qty} | {needed} | {remaining} ({feasibility}) |")

    lines.append("")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4: MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    creatures = build_creatures()

    generators = [
        ("creature-stats.md", generate_creature_stats_md, (creatures,)),
        ("dps-ranking.md", generate_dps_ranking_md, (creatures,)),
        ("matchup-matrix.md", generate_matchup_matrix_md, (creatures,)),
        ("synergy-breakpoints.md", generate_synergy_breakpoints_md, (creatures,)),
        ("item-efficiency.md", generate_item_efficiency_md, (creatures,)),
        ("roll-odds.md", generate_roll_odds_md, ()),
    ]

    for filename, gen_func, args in generators:
        print(f"Generating {filename}...")
        content = gen_func(*args)
        output_path = OUTPUT_DIR / filename
        output_path.write_text(content, encoding="utf-8")
        print(f"  -> {output_path} ({len(content)} bytes)")

    print(f"\nDone! Generated {len(generators)} files in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
