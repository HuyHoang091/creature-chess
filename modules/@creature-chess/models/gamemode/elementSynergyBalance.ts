export const ELEMENT_TRAIT_IDS = [
	"fire",
	"water",
	"earth",
	"wood",
	"metal",
] as const;

export type ElementTraitId = (typeof ELEMENT_TRAIT_IDS)[number];

export interface PieceBattleModifierSet {
	hpFlat?: number;
	hpPct?: number;
	attackFlat?: number;
	attackPct?: number;
	defenseFlat?: number;
	defensePct?: number;
	speedFlat?: number;
	speedPct?: number;
	startingManaFlat?: number;
	healAmpPct?: number;
	skillDamagePct?: number;
	damageReductionPct?: number;
}

export interface ElementSynergyTier extends PieceBattleModifierSet {
	amount: number;
}

export interface ElementTraitCountSeed {
	definitionId: number;
	traits: string[];
}

export const ELEMENT_SYNERGY_BALANCE: Record<
	ElementTraitId,
	ElementSynergyTier[]
> = {
	fire: [
		{ amount: 2, attackPct: 0.08 },
		{ amount: 4, attackPct: 0.16 },
		{ amount: 6, attackPct: 0.28 },
		{ amount: 8, attackPct: 0.4, skillDamagePct: 0.1 },
		{ amount: 10, attackPct: 0.55, skillDamagePct: 0.2 },
	],
	water: [
		{ amount: 2, startingManaFlat: 10 },
		{ amount: 4, startingManaFlat: 20 },
		{ amount: 6, startingManaFlat: 30 },
		{ amount: 8, startingManaFlat: 40, speedFlat: 20 },
		{ amount: 10, startingManaFlat: 50, speedFlat: 40 },
	],
	earth: [
		{ amount: 2, defensePct: 0.04 },
		{ amount: 4, defensePct: 0.08, hpPct: 0.03 },
		{ amount: 6, defensePct: 0.14, hpPct: 0.06 },
		{ amount: 8, defensePct: 0.2, hpPct: 0.1 },
		{ amount: 10, defensePct: 0.28, hpPct: 0.15, damageReductionPct: 0.05 },
	],
	wood: [
		{ amount: 2, hpPct: 0.06 },
		{ amount: 4, hpPct: 0.1 },
		{ amount: 6, hpPct: 0.15 },
		{ amount: 8, hpPct: 0.2, healAmpPct: 0.08 },
		{ amount: 10, hpPct: 0.26, healAmpPct: 0.15 },
	],
	metal: [
		{ amount: 2, defenseFlat: 5 },
		{ amount: 4, defenseFlat: 10 },
		{ amount: 6, defenseFlat: 16 },
		{ amount: 8, defenseFlat: 22, attackFlat: 8 },
		{ amount: 10, defenseFlat: 30, attackFlat: 14 },
	],
};

const MODIFIER_KEYS: Array<keyof PieceBattleModifierSet> = [
	"hpFlat",
	"hpPct",
	"attackFlat",
	"attackPct",
	"defenseFlat",
	"defensePct",
	"speedFlat",
	"speedPct",
	"startingManaFlat",
	"healAmpPct",
	"skillDamagePct",
	"damageReductionPct",
];

const formatPercent = (label: string, value?: number) => {
	if (!value) {
		return null;
	}

	return `${label} +${Math.round(value * 100)}%`;
};

const formatFlat = (label: string, value?: number) => {
	if (!value) {
		return null;
	}

	return `${label} +${value}`;
};

export const describeElementSynergyTier = (
	tier: ElementSynergyTier
): string => {
	const parts = [
		formatFlat("HP", tier.hpFlat),
		formatPercent("HP", tier.hpPct),
		formatFlat("ATK", tier.attackFlat),
		formatPercent("ATK", tier.attackPct),
		formatFlat("DEF", tier.defenseFlat),
		formatPercent("DEF", tier.defensePct),
		formatFlat("SPD", tier.speedFlat),
		formatPercent("SPD", tier.speedPct),
		formatFlat("Starting Mana", tier.startingManaFlat),
		formatPercent("Healing", tier.healAmpPct),
		formatPercent("Skill Damage", tier.skillDamagePct),
		formatPercent("Damage Reduction", tier.damageReductionPct),
	].filter((part): part is string => part !== null);

	return parts.join(", ");
};

export const getElementSynergyTier = (
	traitId: ElementTraitId,
	count: number
): ElementSynergyTier | null => {
	const tiers = ELEMENT_SYNERGY_BALANCE[traitId];
	let activeTier: ElementSynergyTier | null = null;

	for (const tier of tiers) {
		if (count < tier.amount) {
			break;
		}

		activeTier = tier;
	}

	return activeTier;
};

export const combineBattleModifiers = (
	modifierSets: Array<PieceBattleModifierSet | null | undefined>
): PieceBattleModifierSet | undefined => {
	const combined: PieceBattleModifierSet = {};
	let hasModifier = false;

	for (const modifiers of modifierSets) {
		if (!modifiers) {
			continue;
		}

		for (const key of MODIFIER_KEYS) {
			const value = modifiers[key];

			if (value === undefined || value === 0) {
				continue;
			}

			const currentValue = combined[key] ?? 0;
			combined[key] = currentValue + value;
			hasModifier = true;
		}
	}

	return hasModifier ? combined : undefined;
};

export const isElementTrait = (traitId: string): traitId is ElementTraitId =>
	ELEMENT_TRAIT_IDS.some((elementTraitId) => elementTraitId === traitId);

export const countUniqueElementTraits = (
	pieces: ElementTraitCountSeed[]
): Map<ElementTraitId, number> => {
	const definitionIdsByTrait = new Map<ElementTraitId, Set<number>>();

	for (const piece of pieces) {
		for (const traitId of piece.traits) {
			if (!isElementTrait(traitId)) {
				continue;
			}

			let definitionIds = definitionIdsByTrait.get(traitId);

			if (!definitionIds) {
				definitionIds = new Set<number>();
				definitionIdsByTrait.set(traitId, definitionIds);
			}

			definitionIds.add(piece.definitionId);
		}
	}

	const counts = new Map<ElementTraitId, number>();

	for (const [traitId, definitionIds] of definitionIdsByTrait.entries()) {
		counts.set(traitId, definitionIds.size);
	}

	return counts;
};
