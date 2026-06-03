import { createInitialBoardState } from "@shoki/board/src/state";

import { PlayerState, getDefinitionById } from "@creature-chess/gamemode";
import { Builders, GamePhase } from "@creature-chess/models";
import { PlayerStatus } from "@creature-chess/models/game/playerList";
import { StreakType } from "@creature-chess/models/player";

import { normalizeBuildAutoPlayPlan } from "../policy";
import {
	chooseItemPlanAction,
	findTargetPiece,
	isRecoverableHolder,
} from "../item-plan-executor";

const makePiece = (
	definitionId: number,
	id: string,
	stage = 0,
	items: { itemId: string }[] = []
) => {
	const definition = getDefinitionById(definitionId)!;
	return Builders.buildPieceModel({
		id,
		ownerId: "p1",
		definitionId,
		definition,
		stage,
		traits: definition.traits,
		items,
	});
};

const makeState = ({
	boardPieces = [],
	benchPieces = [],
	inventory = [],
}: {
	boardPieces?: ReturnType<typeof makePiece>[];
	benchPieces?: ReturnType<typeof makePiece>[];
	inventory?: string[];
} = {}): PlayerState => {
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
		board: { ...board, pieceLimit: 7 },
		bench,
		cardShop: { cards: [], locked: false },
		playerInfo: {
			status: PlayerStatus.CONNECTED,
			health: 100,
			streak: { type: StreakType.WIN, amount: 0 },
			battle: null,
			matchRewards: null,
			opponentId: null,
			opponentIsClone: false,
			potentialOpponentId: null,
			potentialOpponentIsClone: false,
			money: 20,
			ready: false,
			level: 7,
			xp: 0,
			inventory,
		},
		roundInfo: {
			round: 7,
			phase: GamePhase.PREPARING,
			phaseStartedAtSeconds: 0,
		},
		spectating: { id: null },
	};
};

const makePlan = (itemPlan: unknown[]) =>
	normalizeBuildAutoPlayPlan({
		planName: "Wood Budaye",
		primaryTraits: ["wood"],
		secondaryTraits: [],
		coreUnits: [{ name: "Budaye", priority: "core", targetStars: 2, reason: "core" }],
		transitionUnits: [{ name: "Nut", priority: "transition", reason: "holder" }],
		avoidUnits: [],
		rollStrategy: { summary: "" },
		itemPlan,
		shortTermSteps: [],
	} as any)!;

describe("item plan executor", () => {
	test("holds a component on a designated holder until carry appears", () => {
		const holder = makePiece(5, "nut-holder");
		const state = makeState({
			benchPieces: [holder],
			inventory: ["BF_SWORD"],
		});
		const plan = makePlan([
			{
				itemId: "INFINITY_EDGE",
				targetPiece: "Budaye",
				holderPiece: "Nut",
				action: "temporary_holder",
				reason: "hold sword",
				from: ["BF_SWORD", "BF_SWORD"],
			},
		]);

		const action = chooseItemPlanAction(state, plan);
		expect(action?.name).toContain("hold:BF_SWORD");
		expect(action?.action.type).toBe("equipItemPlayerAction");
		expect((action?.action.payload as { pieceId?: string }).pieceId).toBe(
			"nut-holder"
		);
	});

	test("recovers components by selling the holder once carry exists", () => {
		const carry = makePiece(1, "budaye");
		const holder = makePiece(5, "nut-holder", 0, [{ itemId: "BF_SWORD" }]);
		const state = makeState({
			boardPieces: [carry],
			benchPieces: [holder],
			inventory: ["BF_SWORD"],
		});
		const plan = makePlan([
			{
				itemId: "INFINITY_EDGE",
				targetPiece: "Budaye",
				holderPiece: "Nut",
				action: "temporary_holder",
				reason: "recover sword",
				from: ["BF_SWORD", "BF_SWORD"],
			},
		]);

		expect(findTargetPiece(state, "Budaye")?.id).toBe("budaye");
		expect(isRecoverableHolder(state, holder, plan)).toBe(true);

		const action = chooseItemPlanAction(state, plan);
		expect(action?.name).toContain("recover-item");
		expect(action?.action.type).toBe("sellPiecePlayerAction");
	});

	test("does not sell holder while carry is still missing", () => {
		const holder = makePiece(5, "nut-holder", 0, [{ itemId: "BF_SWORD" }]);
		const state = makeState({ benchPieces: [holder] });
		const plan = makePlan([
			{
				itemId: "INFINITY_EDGE",
				targetPiece: "Budaye",
				holderPiece: "Nut",
				action: "temporary_holder",
				reason: "keep holding",
				from: ["BF_SWORD", "BF_SWORD"],
			},
		]);

		expect(isRecoverableHolder(state, holder, plan)).toBe(false);
		expect(chooseItemPlanAction(state, plan)).toBeNull();
	});
});
