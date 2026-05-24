import {
	PlayerState,
	getAllDefinitions,
} from "@creature-chess/gamemode";
import { getPiecesForStage } from "@creature-chess/gamemode/src/game/evolution";
import {
	CARD_COST_CHANCES,
	CARD_DEFINITION_QUANTITIES,
} from "@creature-chess/gamemode/src/game/cardDeck";
import {
	BoardSelectors,
	BoardState,
} from "@shoki/board";
import {
	Card,
	findRecipe,
	GamePhase,
	getItemDefinition,
	PieceModel,
} from "@creature-chess/models";
import { PIECES_TO_EVOLVE } from "@creature-chess/models/config";
import { TraitId } from "@creature-chess/models/gamemode/traits";
import { PlayerStatus } from "@creature-chess/models/game/playerList";
import { StreakType } from "@creature-chess/models/player";
import { allTraitsMap } from "@creature-chess/models/gamemode/traits";

import {
	BuildAdviceContext,
	BuildCostOddsByLevel,
	BuildCraftableItemSummary,
	BuildItemSummary,
	BuildPieceSummary,
	BuildPoolByCostSummary,
	BuildShopCardSummary,
	BuildTraitCountSummary,
	BuildUnitPoolEntry,
	BuildUnitProgressEntry,
} from "./types";

type BuildAdviceContextInput = {
	playerId: string;
	playerState: PlayerState;
	allPlayerStates: PlayerState[];
	round: number;
	phase: GamePhase;
};

const getBoardPieces = (board: BoardState<PieceModel>) =>
	BoardSelectors.getAllPieces(board);

const getCopyCountForPiece = (piece: PieceModel) =>
	getPiecesForStage(piece.stage, PIECES_TO_EVOLVE);

const summarizeItem = (itemId: string): BuildItemSummary => {
	const definition = getItemDefinition(itemId);

	return {
		id: itemId,
		name: definition?.name || itemId,
		description: definition?.description || "",
		tier: definition?.tier || 0,
	};
};

const summarizePiece = (
	piece: PieceModel,
	location: "board" | "bench"
): BuildPieceSummary => ({
	id: piece.id,
	name: piece.definition.name,
	definitionId: piece.definitionId,
	cost: piece.definition.cost,
	stage: piece.stage + 1,
	copyCount: getCopyCountForPiece(piece),
	traits: piece.definition.traits,
	location,
	items: (piece.items || []).map((item) => summarizeItem(item.itemId)),
});

const summarizeCard = (card: Card): BuildShopCardSummary => ({
	id: card.id,
	name: card.name,
	definitionId: card.definitionId,
	cost: card.cost,
	traits: card.traits,
});

const tallyTraits = (pieces: PieceModel[]): Record<TraitId, number> => {
	const counts = {} as Record<TraitId, number>;

	for (const piece of pieces) {
		for (const trait of piece.definition.traits) {
			counts[trait] = (counts[trait] || 0) + 1;
		}
	}

	return counts;
};

const summarizeTraitCounts = (
	counts: Record<TraitId, number>
): BuildTraitCountSummary[] =>
	Object.entries(counts)
		.map(([id, count]) => ({
			id: id as TraitId,
			name: allTraitsMap.get(id as TraitId)?.name || id,
			count,
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

const countCardsByDefinition = (cards: Card[]) => {
	const counts = new Map<number, number>();

	for (const card of cards) {
		counts.set(card.definitionId, (counts.get(card.definitionId) || 0) + 1);
	}

	return counts;
};

const countPieceCopiesByDefinition = (pieces: PieceModel[]) => {
	const counts = new Map<number, number>();

	for (const piece of pieces) {
		counts.set(
			piece.definitionId,
			(counts.get(piece.definitionId) || 0) + getCopyCountForPiece(piece)
		);
	}

	return counts;
};

const buildCraftableInventoryItems = (
	inventory: string[]
): BuildCraftableItemSummary[] => {
	const seen = new Set<string>();
	const craftable: BuildCraftableItemSummary[] = [];

	for (let i = 0; i < inventory.length; i++) {
		for (let j = i + 1; j < inventory.length; j++) {
			const itemA = inventory[i];
			const itemB = inventory[j];
			const resultId = findRecipe(itemA, itemB);

			if (!resultId) {
				continue;
			}

			const key = [itemA, itemB, resultId].sort().join("|");

			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			craftable.push({
				from: [itemA, itemB],
				result: summarizeItem(resultId),
			});
		}
	}

	return craftable.sort((a, b) => a.result.name.localeCompare(b.result.name));
};

const buildLevelOdds = (): BuildCostOddsByLevel[] =>
	CARD_COST_CHANCES[0].map((_, levelIndex) => ({
		level: levelIndex + 1,
		oddsByCost: CARD_COST_CHANCES.reduce<Record<number, number>>(
			(output, chances, costIndex) => {
				output[costIndex + 1] = chances[levelIndex];
				return output;
			},
			{}
		),
	}));

const buildOwnedUnitProgress = (
	playerPieces: PieceModel[],
	playerCards: Card[]
): BuildUnitProgressEntry[] => {
	const pieceCounts = countPieceCopiesByDefinition(playerPieces);
	const shopCounts = countCardsByDefinition(playerCards);
	const definitionIds = new Set<number>([
		...pieceCounts.keys(),
		...shopCounts.keys(),
	]);

	return getAllDefinitions()
		.filter((definition) => definitionIds.has(definition.id))
		.map((definition) => {
			const ownedCopies = pieceCounts.get(definition.id) || 0;
			const shopCopies = shopCounts.get(definition.id) || 0;
			const totalClientCopies = ownedCopies + shopCopies;
			const starsOwned = playerPieces
				.filter((piece) => piece.definitionId === definition.id)
				.map((piece) => piece.stage + 1)
				.sort((a, b) => b - a);
			const nextUpgradeStars =
				totalClientCopies >= 9 ? null : totalClientCopies >= 3 ? 3 : 2;
			const copiesNeededForNextUpgrade =
				nextUpgradeStars === null
					? null
					: nextUpgradeStars === 2
						? Math.max(0, 3 - totalClientCopies)
						: Math.max(0, 9 - totalClientCopies);

			return {
				definitionId: definition.id,
				name: definition.name,
				cost: definition.cost,
				totalClientCopies,
				ownedCopies,
				shopCopies,
				starsOwned,
				nextUpgradeStars,
				copiesNeededForNextUpgrade,
			};
		})
		.sort(
			(a, b) =>
				a.cost - b.cost ||
				b.totalClientCopies - a.totalClientCopies ||
				a.name.localeCompare(b.name)
		);
};

export const createBuildAdviceContext = ({
	playerId,
	playerState,
	allPlayerStates,
	round,
	phase,
}: BuildAdviceContextInput): BuildAdviceContext => {
	const boardPieces = getBoardPieces(playerState.board);
	const benchPieces = getBoardPieces(playerState.bench);
	const playerPieces = [...boardPieces, ...benchPieces];
	const playerCards = playerState.cardShop.cards.filter(
		(card): card is Card => card !== null
	);

	const relevantPlayerStates = allPlayerStates.filter(
		(state) => state.playerInfo.status !== PlayerStatus.QUIT
	);

	const allPieces = relevantPlayerStates.flatMap((state) => [
		...getBoardPieces(state.board),
		...getBoardPieces(state.bench),
	]);
	const allShopCards = relevantPlayerStates.flatMap((state) =>
		state.cardShop.cards.filter((card): card is Card => card !== null)
	);

	const allPieceCopyCounts = countPieceCopiesByDefinition(allPieces);
	const allShopCardCounts = countCardsByDefinition(allShopCards);
	const playerPieceCopyCounts = countPieceCopiesByDefinition(playerPieces);
	const playerShopCardCounts = countCardsByDefinition(playerCards);

	const unitPool: BuildUnitPoolEntry[] = getAllDefinitions()
		.map((definition) => {
			const totalCopies = CARD_DEFINITION_QUANTITIES[definition.cost - 1];
			const copiesOnBoardsAndBenches = allPieceCopyCounts.get(definition.id) || 0;
			const copiesInAllShops = allShopCardCounts.get(definition.id) || 0;
			const copiesOutOfPool = copiesOnBoardsAndBenches + copiesInAllShops;
			const copiesHeldByClientBoardAndBench =
				playerPieceCopyCounts.get(definition.id) || 0;
			const copiesVisibleInClientShop =
				playerShopCardCounts.get(definition.id) || 0;
			const copiesHeldByClient =
				copiesHeldByClientBoardAndBench + copiesVisibleInClientShop;
			const copiesHeldByOthers = Math.max(
				0,
				copiesOutOfPool - copiesHeldByClient
			);

			return {
				definitionId: definition.id,
				name: definition.name,
				cost: definition.cost,
				totalCopies,
				remainingCopies: Math.max(0, totalCopies - copiesOutOfPool),
				copiesOutOfPool,
				copiesHeldByClient,
				copiesHeldByClientBoardAndBench,
				copiesVisibleInClientShop,
				copiesHeldByOthers,
				copiesVisibleInAllShops: copiesInAllShops,
			};
		})
		.sort(
			(a, b) =>
				a.cost - b.cost ||
				a.remainingCopies - b.remainingCopies ||
				b.copiesHeldByClient - a.copiesHeldByClient ||
				a.name.localeCompare(b.name)
		);

	const poolByCost: BuildPoolByCostSummary[] = [1, 2, 3, 4, 5].map((cost) => {
		const unitsAtCost = unitPool.filter((entry) => entry.cost === cost);

		return {
			cost,
			totalRemainingCopies: unitsAtCost.reduce(
				(total, entry) => total + entry.remainingCopies,
				0
			),
			totalCopiesOutOfPool: unitsAtCost.reduce(
				(total, entry) => total + entry.copiesOutOfPool,
				0
			),
			definitionCount: unitsAtCost.length,
		};
	});

	const allLevelOdds = buildLevelOdds();
	const currentLevelOdds =
		allLevelOdds.find((entry) => entry.level === playerState.playerInfo.level) ||
		allLevelOdds[0];
	const boardTraitCounts = summarizeTraitCounts(tallyTraits(boardPieces));
	const ownedTraitCounts = summarizeTraitCounts(tallyTraits(playerPieces));
	const boardPieceLimit = playerState.board.pieceLimit;

	return {
		requestType: "build",
		round,
		phase: GamePhase[phase] || String(phase),
		phaseId: phase,
		player: {
			playerId,
			level: playerState.playerInfo.level,
			xp: playerState.playerInfo.xp,
			money: playerState.playerInfo.money,
			health: playerState.playerInfo.health,
			streak: {
				type:
					playerState.playerInfo.streak.type === StreakType.WIN
						? "win"
						: "loss",
				amount: playerState.playerInfo.streak.amount,
			},
			boardSlotsUsed: boardPieces.length,
			boardSlotsAvailable:
				boardPieceLimit === null
					? null
					: Math.max(0, boardPieceLimit - boardPieces.length),
			benchSlotsUsed: benchPieces.length,
			benchSlotsAvailable: Math.max(
				0,
				playerState.bench.size.width - benchPieces.length
			),
			activeBoardTraits: boardTraitCounts,
			ownedTraits: ownedTraitCounts,
			boardPieces: boardPieces.map((piece) => summarizePiece(piece, "board")),
			benchPieces: benchPieces.map((piece) => summarizePiece(piece, "bench")),
			shopCards: playerCards.map(summarizeCard),
			inventoryItems: playerState.playerInfo.inventory.map(summarizeItem),
			craftableInventoryItems: buildCraftableInventoryItems(
				playerState.playerInfo.inventory
			),
		},
		currentLevelOdds,
		allLevelOdds,
		poolByCost,
		unitPool,
		ownedUnitProgress: buildOwnedUnitProgress(playerPieces, playerCards),
		notes: [
			"remainingCopies = totalCopiesPerUnit - copies currently on all boards, benches, and shops.",
			"star conversion uses base-copy counts: 1-star=1, 2-star=3, 3-star=9.",
			"copiesHeldByClient includes both owned copies and cards currently visible in the client's shop.",
		],
	};
};
