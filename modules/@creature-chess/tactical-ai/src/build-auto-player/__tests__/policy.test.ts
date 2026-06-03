import { createInitialBoardState } from "@shoki/board/src/state";

import { PlayerState, getDefinitionById } from "@creature-chess/gamemode";
import { Builders, Card, GamePhase } from "@creature-chess/models";
import { PlayerStatus } from "@creature-chess/models/game/playerList";
import { StreakType } from "@creature-chess/models/player";
import { GamemodeSettingsPresets } from "@creature-chess/models/settings";

import {
	canSafelySellPiece,
	chooseBuildAutoPlayAction,
	normalizeBuildAutoPlayPlan,
} from "../policy";

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

const makeCard = (definitionId: number, id = `card-${definitionId}`): Card => {
	const definition = getDefinitionById(definitionId)!;
	return {
		id,
		definitionId,
		name: definition.name,
		cost: definition.cost,
		traits: definition.traits,
	};
};

const makeState = ({
	level = 1,
	money = 20,
	boardPieces = [],
	benchPieces = [],
	cards = [],
	inventory = [],
}: {
	level?: number;
	money?: number;
	boardPieces?: ReturnType<typeof makePiece>[];
	benchPieces?: ReturnType<typeof makePiece>[];
	cards?: Card[];
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
		board: { ...board, pieceLimit: level },
		bench,
		cardShop: { cards, locked: false },
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
			money,
			ready: false,
			level,
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

const makePlan = (overrides: Record<string, unknown> = {}) =>
	normalizeBuildAutoPlayPlan({
		planName: "Wood Budaye",
		primaryTraits: ["wood"],
		secondaryTraits: [],
		coreUnits: [
			{
				name: "Budaye",
				priority: "core",
				targetStars: 2,
				reason: "core",
			},
		],
		transitionUnits: [],
		avoidUnits: [],
		rollStrategy: { summary: "" },
		itemPlan: [],
		shortTermSteps: [],
		...overrides,
	} as any)!;

describe("build auto-play policy", () => {
	test("normalizes known units and rejects an empty invalid plan", () => {
		expect(
			normalizeBuildAutoPlayPlan({
				planName: "invalid",
				coreUnits: [{ name: "MissingNo" }],
				transitionUnits: [],
			} as any)
		).toBeNull();

		const plan = makePlan({
			transitionUnits: [{ name: "Bamboon", priority: "transition" }],
		});
		expect(plan.coreUnits[0]).toEqual(
			expect.objectContaining({ name: "Budaye", definitionId: 1 })
		);
		expect(plan.transitionUnits[0]).toEqual(
			expect.objectContaining({ name: "Bamboon", definitionId: 9 })
		);
	});

	test("level 1 does not buy units while level 2 does", () => {
		const state = makeState({ cards: [makeCard(1)] });
		const plan = makePlan();
		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 1)
		).toBeNull();
		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 2)
				?.name
		).toContain("buy");
	});

	test("never sells core, upgraded, or item-carrying units", () => {
		const plan = makePlan();
		const state = makeState();
		expect(canSafelySellPiece(state, makePiece(1, "core"), plan)).toBe(false);
		expect(canSafelySellPiece(state, makePiece(3, "upgraded", 1), plan)).toBe(
			false
		);
		expect(
			canSafelySellPiece(
				state,
				makePiece(3, "holder", 0, [{ itemId: "BF_SWORD" }]),
				plan
			)
		).toBe(false);
		expect(canSafelySellPiece(state, makePiece(3, "trash"), plan)).toBe(true);
	});

	test("only level 4 sells trash to make room for a planned unit", () => {
		const board = [makePiece(3, "board-trash")];
		const bench = Array.from({ length: 9 }, (_, index) =>
			makePiece(4, `bench-trash-${index}`)
		);
		const state = makeState({
			boardPieces: board,
			benchPieces: bench,
			cards: [makeCard(1)],
		});
		const plan = makePlan();

		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 2)
		).toBeNull();
		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 4)
				?.name
		).toMatch(/sell/);
	});

	test("only level 4 crafts generic valid items", () => {
		const state = makeState({ money: 0, inventory: ["BF_SWORD", "BF_SWORD"] });
		const plan = makePlan();

		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 3)
		).toBeNull();
		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 4)
				?.name
		).toContain("craft");
	});

	test("equips an explicitly crafted item on its planned unit", () => {
		const state = makeState({
			boardPieces: [makePiece(1, "budaye")],
			inventory: ["INFINITY_EDGE"],
		});
		const plan = makePlan({
			itemPlan: [
				{
					itemId: "INFINITY_EDGE",
					targetPiece: "Budaye",
					action: "craft_now",
					reason: "carry item",
					from: ["BF_SWORD", "BF_SWORD"],
				},
			],
		});

		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 4)
				?.name
		).toContain("equip");
	});

	test("level 4 prioritizes itemPlan hold before generic craft", () => {
		const holder = makePiece(5, "nut-holder");
		const state = makeState({
			benchPieces: [holder],
			inventory: ["BF_SWORD"],
		});
		const plan = makePlan({
			itemPlan: [
				{
					itemId: "INFINITY_EDGE",
					targetPiece: "Budaye",
					holderPiece: "Nut",
					action: "temporary_holder",
					reason: "hold sword",
					from: ["BF_SWORD", "BF_SWORD"],
				},
			],
		});

		expect(
			chooseBuildAutoPlayAction(state, plan, GamemodeSettingsPresets.default, 4)
				?.name
		).toContain("hold:");
	});
});
