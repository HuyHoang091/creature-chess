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

export type TraitId =
	| "fire"
	| "water"
	| "earth"
	| "wood"
	| "metal"
	| "arcane"
	| "valiant"
	| "cunning";

export const allTraits: Trait[] = [
	{
		id: "fire",
		name: "Fire",
		icon: "fire",
		tiers: [],
	},
	{
		id: "water",
		name: "Water",
		icon: "water",
		tiers: [],
	},
	{
		id: "earth",
		name: "Earth",
		icon: "earth",
		tiers: [],
	},
	{
		id: "wood",
		name: "Wood",
		icon: "wood",
		tiers: [],
	},
	{
		id: "metal",
		name: "Metal",
		icon: "metal",
		tiers: [],
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
