/**
 * Item catalog: all base and combined item definitions.
 */
import { ItemDefinition } from "./item";

// ─── BASE ITEMS (Tier 1) — drop từ creep rounds ───────────────────────

export const BASE_ITEMS: Record<string, ItemDefinition> = {
	BF_SWORD: {
		id: "BF_SWORD",
		name: "B.F. Sword",
		description: "+15 Attack",
		tier: 1,
		icon: "⚔️",
		stats: { attack: 15 },
	},
	CHAIN_VEST: {
		id: "CHAIN_VEST",
		name: "Chain Vest",
		description: "+15 Defense",
		tier: 1,
		icon: "🛡️",
		stats: { defense: 15 },
	},
	GIANTS_BELT: {
		id: "GIANTS_BELT",
		name: "Giant's Belt",
		description: "+150 HP",
		tier: 1,
		icon: "💚",
		stats: { hp: 150 },
	},
	RECURVE_BOW: {
		id: "RECURVE_BOW",
		name: "Recurve Bow",
		description: "+15 Speed",
		tier: 1,
		icon: "🏹",
		stats: { speed: 15 },
	},
	TEAR: {
		id: "TEAR",
		name: "Tear of the Goddess",
		description: "+15 Mana",
		tier: 1,
		icon: "💧",
		stats: { mana: 15 },
	},
	CLOAK: {
		id: "CLOAK",
		name: "Negatron Cloak",
		description: "+10 Defense, +10 Speed",
		tier: 1,
		icon: "🧥",
		stats: { defense: 10, speed: 10 },
	},
	ROD: {
		id: "ROD",
		name: "Needlessly Large Rod",
		description: "+10 Attack, +10 Mana",
		tier: 1,
		icon: "🪄",
		stats: { attack: 10, mana: 10 },
	},
	GLOVES: {
		id: "GLOVES",
		name: "Sparring Gloves",
		description: "+8 Attack, +8 Speed",
		tier: 1,
		icon: "🧤",
		stats: { attack: 8, speed: 8 },
	},
};

// ─── COMBINED ITEMS (Tier 2) — ghép từ 2 base items ───────────────────

export const COMBINED_ITEMS: Record<string, ItemDefinition> = {
	INFINITY_EDGE: {
		id: "INFINITY_EDGE",
		name: "Infinity Edge",
		description: "+40 Attack",
		tier: 2,
		icon: "🗡️",
		stats: { attack: 40 },
	},
	WARMOG: {
		id: "WARMOG",
		name: "Warmog's Armor",
		description: "+400 HP",
		tier: 2,
		icon: "❤️",
		stats: { hp: 400 },
	},
	BLOODTHIRSTER: {
		id: "BLOODTHIRSTER",
		name: "Bloodthirster",
		description: "+20 ATK, +10 DEF, +10 SPD. Passive: Lifesteal",
		tier: 2,
		icon: "🩸",
		stats: { attack: 20, defense: 10, speed: 10 },
		passive: {
			id: "lifesteal",
			name: "Lifesteal",
			description: "Heal 20% of damage dealt",
			trigger: "onAttackHit",
		},
	},
	RAPID_FIRE: {
		id: "RAPID_FIRE",
		name: "Rapid Firecannon",
		description: "+40 Speed",
		tier: 2,
		icon: "⚡",
		stats: { speed: 40 },
	},
	FROZEN_HEART: {
		id: "FROZEN_HEART",
		name: "Frozen Heart",
		description: "+15 DEF, +15 Mana. Passive: Attackers that hit this unit are slowed for 2s",
		tier: 2,
		icon: "❄️",
		stats: { defense: 15, mana: 15 },
		passive: {
			id: "slow_nearby",
			name: "Frozen Retribution",
			description: "Attackers that hit this unit are slowed for 2 seconds",
			trigger: "onTakeDamage",
		},
	},
	GUARDIAN_ANGEL: {
		id: "GUARDIAN_ANGEL",
		name: "Guardian Angel",
		description: "+15 ATK, +15 DEF. Passive: Revive once",
		tier: 2,
		icon: "👼",
		stats: { attack: 15, defense: 15 },
		passive: {
			id: "revive",
			name: "Resurrection",
			description: "Revive with 50% HP once per battle",
			trigger: "onTakeDamage",
		},
	},
	RABADON: {
		id: "RABADON",
		name: "Rabadon's Deathcap",
		description: "+25 ATK, +25 Mana",
		tier: 2,
		icon: "🎩",
		stats: { attack: 25, mana: 25 },
	},
	PHANTOM_DANCER: {
		id: "PHANTOM_DANCER",
		name: "Phantom Dancer",
		description: "+15 SPD, +15 DEF. Passive: Dodge attacks",
		tier: 2,
		icon: "💃",
		stats: { speed: 15, defense: 15 },
		passive: {
			id: "dodge",
			name: "Phantom Dance",
			description: "15% chance to dodge attacks",
			trigger: "onTakeDamage",
		},
	},
	THORNMAIL: {
		id: "THORNMAIL",
		name: "Thornmail",
		description: "+40 DEF. Passive: Reflect damage",
		tier: 2,
		icon: "🌵",
		stats: { defense: 40 },
		passive: {
			id: "thornmail",
			name: "Thorns",
			description: "Reflect 20% of incoming attack damage as true damage",
			trigger: "onTakeDamage",
		},
	},
};

// ─── ALL ITEMS ────────────────────────────────────────────────────────

export const ALL_ITEMS: Record<string, ItemDefinition> = {
	...BASE_ITEMS,
	...COMBINED_ITEMS,
};

export const getItemDefinition = (id: string): ItemDefinition | undefined =>
	ALL_ITEMS[id];

export const getAllBaseItems = (): ItemDefinition[] =>
	Object.values(BASE_ITEMS);

export const getRandomBaseItem = (): ItemDefinition => {
	const items = getAllBaseItems();
	return items[Math.floor(Math.random() * items.length)];
};
