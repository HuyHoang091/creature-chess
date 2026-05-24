import { GamePhase } from "@creature-chess/models";
import { TraitId } from "@creature-chess/models/gamemode/traits";

export interface BuildItemSummary {
	id: string;
	name: string;
	description: string;
	tier: number;
}

export interface BuildCraftableItemSummary {
	from: [string, string];
	result: BuildItemSummary;
}

export interface BuildPieceSummary {
	id: string;
	name: string;
	definitionId: number;
	cost: number;
	stage: number;
	copyCount: number;
	traits: TraitId[];
	location: "board" | "bench";
	items: BuildItemSummary[];
}

export interface BuildShopCardSummary {
	id: string;
	name: string;
	definitionId: number;
	cost: number;
	traits: TraitId[];
}

export interface BuildTraitCountSummary {
	id: TraitId;
	name: string;
	count: number;
}

export interface BuildCostOddsByLevel {
	level: number;
	oddsByCost: Record<number, number>;
}

export interface BuildPoolByCostSummary {
	cost: number;
	totalRemainingCopies: number;
	totalCopiesOutOfPool: number;
	definitionCount: number;
}

export interface BuildUnitPoolEntry {
	definitionId: number;
	name: string;
	cost: number;
	totalCopies: number;
	remainingCopies: number;
	copiesOutOfPool: number;
	copiesHeldByClient: number;
	copiesHeldByClientBoardAndBench: number;
	copiesVisibleInClientShop: number;
	copiesHeldByOthers: number;
	copiesVisibleInAllShops: number;
}

export interface BuildUnitProgressEntry {
	definitionId: number;
	name: string;
	cost: number;
	totalClientCopies: number;
	ownedCopies: number;
	shopCopies: number;
	starsOwned: number[];
	nextUpgradeStars: number | null;
	copiesNeededForNextUpgrade: number | null;
}

export interface BuildPlayerSummary {
	playerId: string;
	level: number;
	xp: number;
	money: number;
	health: number;
	streak: {
		type: string;
		amount: number;
	};
	boardSlotsUsed: number;
	boardSlotsAvailable: number | null;
	benchSlotsUsed: number;
	benchSlotsAvailable: number;
	activeBoardTraits: BuildTraitCountSummary[];
	ownedTraits: BuildTraitCountSummary[];
	boardPieces: BuildPieceSummary[];
	benchPieces: BuildPieceSummary[];
	shopCards: BuildShopCardSummary[];
	inventoryItems: BuildItemSummary[];
	craftableInventoryItems: BuildCraftableItemSummary[];
}

export interface BuildAdviceContext {
	requestType: "build";
	round: number;
	phase: string;
	phaseId: GamePhase;
	player: BuildPlayerSummary;
	currentLevelOdds: BuildCostOddsByLevel;
	allLevelOdds: BuildCostOddsByLevel[];
	poolByCost: BuildPoolByCostSummary[];
	unitPool: BuildUnitPoolEntry[];
	ownedUnitProgress: BuildUnitProgressEntry[];
	notes: string[];
}

export interface BuildAdvicePlanUnit {
	name: string;
	definitionId?: number | null;
	cost?: number | null;
	targetStars?: number | null;
	priority: "core" | "support" | "transition" | "flex";
	reason: string;
}

export interface BuildAdvicePlanItemAction {
	itemId: string;
	targetPiece: string;
	action: "craft_now" | "equip_now" | "hold" | "temporary_holder";
	reason: string;
	from?: string[];
}

export interface BuildAdvicePlan {
	planName: string;
	primaryTraits: string[];
	secondaryTraits: string[];
	coreUnits: BuildAdvicePlanUnit[];
	transitionUnits: BuildAdvicePlanUnit[];
	avoidUnits: string[];
	rollStrategy: {
		summary: string;
		targetLevel?: number | null;
		slowRollAt?: number | null;
	};
	itemPlan: BuildAdvicePlanItemAction[];
	shortTermSteps: string[];
}
