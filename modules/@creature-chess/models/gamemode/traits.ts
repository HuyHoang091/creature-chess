import {
	type ElementTraitId,
	ELEMENT_SYNERGY_BALANCE,
	describeElementSynergyTier,
} from "./elementSynergyBalance";

export interface Trait {
	id: TraitId;
	name: string;
	icon: string;
	tiers: {
		amount: number;
		description: string;
	}[];
}

/**
 * Một bản đồ các ID đặc điểm với số lượng hiện tại của chúng. Được sử dụng cho logic trận đấu và hiển thị trong trò chơi.
 */
export type TraitSet = Map<TraitId, number>;

export type TraitId = ElementTraitId | "arcane" | "valiant" | "cunning";

const getElementTraitTiers = (traitId: ElementTraitId) =>
	ELEMENT_SYNERGY_BALANCE[traitId].map((tier) => ({
		amount: tier.amount,
		description: describeElementSynergyTier(tier),
	}));

export const allTraits: Trait[] = [
	{
		id: "fire",
		name: "Fire",
		icon: "fire",
		tiers: getElementTraitTiers("fire"),
	},
	{
		id: "water",
		name: "Water",
		icon: "water",
		tiers: getElementTraitTiers("water"),
	},
	{
		id: "earth",
		name: "Earth",
		icon: "earth",
		tiers: getElementTraitTiers("earth"),
	},
	{
		id: "wood",
		name: "Wood",
		icon: "wood",
		tiers: getElementTraitTiers("wood"),
	},
	{
		id: "metal",
		name: "Metal",
		icon: "metal",
		tiers: getElementTraitTiers("metal"),
	},
	{
		id: "arcane",
		name: "Arcane",
		icon: "arcane",
		tiers: [],
	},
	{
		id: "valiant",
		name: "Valiant",
		icon: "valiant",
		tiers: [],
	},
	{
		id: "cunning",
		name: "Cunning",
		icon: "cunning",
		tiers: [],
	},
];

export const allTraitsMap = new Map<TraitId, Trait>(
	allTraits.map((trait) => [trait.id, trait])
);
