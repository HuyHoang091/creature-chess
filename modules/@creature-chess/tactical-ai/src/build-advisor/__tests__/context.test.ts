import { createInitialBoardState } from "@shoki/board/src/state";
import {
	Card,
	Builders,
	GamePhase,
	RoundInfoState,
} from "@creature-chess/models";
import { PIECES_TO_EVOLVE } from "@creature-chess/models/config";
import { PlayerStatus } from "@creature-chess/models/game/playerList";
import { StreakType } from "@creature-chess/models/player";
import {
	getDefinitionById,
	PlayerState,
} from "@creature-chess/gamemode";
import { getPiecesForStage } from "@creature-chess/gamemode/src/game/evolution";

import { createBuildAdviceContext } from "../context";

const roundInfo: RoundInfoState = {
	round: 7,
	phase: GamePhase.PREPARING,
	phaseStartedAtSeconds: 0,
};

const makeCard = (
	definitionId: number,
	name: string,
	cost: number
): Card => ({
	id: `card-${definitionId}-${name}-${cost}`,
	definitionId,
	name,
	cost,
	traits: [],
});

const makePiece = (definitionId: number, stage: number, ownerId = "p1") =>
	{
		const definition = getDefinitionById(definitionId)!;

		return Builders.buildPieceModel({
			id: `${ownerId}-${definitionId}-${stage}`,
			ownerId,
			definitionId,
			stage,
			definition,
			traits: definition.traits,
			items: [],
		});
	};

const makePlayerState = ({
	playerId,
	level,
	money,
	health,
	inventory = [],
	boardPieces = [],
	benchPieces = [],
	cards = [],
}: {
	playerId: string;
	level: number;
	money: number;
	health: number;
	inventory?: string[];
	boardPieces?: ReturnType<typeof makePiece>[];
	benchPieces?: ReturnType<typeof makePiece>[];
	cards?: Card[];
}): PlayerState => {
	const board = createInitialBoardState<ReturnType<typeof makePiece>>("board");
	const bench = createInitialBoardState<ReturnType<typeof makePiece>>("bench", {
		width: 9,
		height: 1,
	});

	boardPieces.forEach((piece, index) => {
		board.pieces[piece.id] = piece;
		board.piecePositions[`${index},0`] = piece.id;
	});
	benchPieces.forEach((piece, index) => {
		bench.pieces[piece.id] = piece;
		bench.piecePositions[`${index},0`] = piece.id;
	});

	return {
		board: {
			...board,
			pieceLimit: level,
		},
		bench,
		cardShop: {
			cards,
			locked: false,
		},
		playerInfo: {
			status: PlayerStatus.CONNECTED,
			health,
			streak: {
				type: StreakType.WIN,
				amount: 2,
			},
			battle: null,
			matchRewards: null,
			opponentId: null,
			opponentIsClone: false,
			potentialOpponentId: null,
			potentialOpponentIsClone: false,
			money,
			ready: false,
			level,
			xp: 0,
			inventory,
		},
		roundInfo,
		spectating: {
			id: null,
		},
	};
};

describe("createBuildAdviceContext", () => {
	test("builds accurate pool, odds, and inventory context for /build", () => {
		const playerState = makePlayerState({
			playerId: "p1",
			level: 4,
			money: 18,
			health: 73,
			inventory: ["BF_SWORD", "BF_SWORD", "TEAR"],
			boardPieces: [makePiece(1, 0, "p1")],
			benchPieces: [makePiece(1, 1, "p1")],
			cards: [makeCard(1, "Budaye", 1), makeCard(9, "Bamboon", 2)],
		});
		const otherState = makePlayerState({
			playerId: "p2",
			level: 5,
			money: 10,
			health: 65,
			boardPieces: [makePiece(1, 0, "p2")],
		});

		const context = createBuildAdviceContext({
			playerId: "p1",
			playerState,
			allPlayerStates: [playerState, otherState],
			round: 7,
			phase: GamePhase.PREPARING,
		});

		const budaye = context.unitPool.find((entry) => entry.definitionId === 1);

		expect(context.player.level).toBe(4);
		expect(context.currentLevelOdds.oddsByCost[1]).toBe(50);
		expect(context.currentLevelOdds.oddsByCost[2]).toBe(35);
		expect(context.player.craftableInventoryItems).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					result: expect.objectContaining({ id: "INFINITY_EDGE" }),
				}),
			])
		);
		expect(context.ownedUnitProgress).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					definitionId: 1,
					totalClientCopies:
						getPiecesForStage(0, PIECES_TO_EVOLVE) +
						getPiecesForStage(1, PIECES_TO_EVOLVE) +
						1,
				}),
			])
		);
		expect(budaye).toEqual(
			expect.objectContaining({
				totalCopies: 29,
				copiesHeldByClientBoardAndBench: 4,
				copiesVisibleInClientShop: 1,
				copiesHeldByClient: 5,
				copiesHeldByOthers: 1,
				copiesOutOfPool: 6,
				remainingCopies: 23,
			})
		);
	});
});
