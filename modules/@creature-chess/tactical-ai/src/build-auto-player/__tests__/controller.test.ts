import { createInitialBoardState } from "@shoki/board/src/state";

import { PlayerState } from "@creature-chess/gamemode";
import { GamePhase, RoundType } from "@creature-chess/models";
import { PlayerStatus } from "@creature-chess/models/game/playerList";
import { StreakType } from "@creature-chess/models/player";
import { GamemodeSettingsPresets } from "@creature-chess/models/settings";

import { BuildAutoPlayerController } from "../controller";
import { getPositioningAdvisor } from "../../integration/advisor-instance";

jest.mock("../../integration/advisor-instance", () => ({
	getPositioningAdvisor: jest.fn(),
}));

const makeState = (
	phase = GamePhase.PREPARING,
	roundType = RoundType.PVE_CREEP
): PlayerState => ({
	board: createInitialBoardState("board"),
	bench: createInitialBoardState("bench", { width: 9, height: 1 }),
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
		money: 0,
		ready: false,
		level: 1,
		xp: 0,
		inventory: [],
	},
	roundInfo: {
		round: 1,
		phase,
		phaseStartedAtSeconds: 0,
		roundType,
	},
	spectating: { id: null },
});

const plan = {
	planName: "Budaye",
	primaryTraits: ["wood"],
	secondaryTraits: [],
	coreUnits: [{ name: "Budaye", priority: "core", reason: "core" }],
	transitionUnits: [],
	avoidUnits: [],
	rollStrategy: { summary: "" },
	itemPlan: [],
	shortTermSteps: [],
};

const makeController = (
	state: PlayerState,
	roundInfoOverride?: () => PlayerState["roundInfo"]
) => {
	const entity = {
		id: "p1",
		select: (selector: (value: PlayerState) => unknown) => selector(state),
		put: jest.fn(),
		runSaga: jest.fn(),
	};
	const deps = {
		getRoundInfo: roundInfoOverride,
		getOpponentBoard: jest.fn(() => null),
		getPlayerBoard: jest.fn(() => null),
		getPotentialOpponentBoard: jest.fn(() => null),
		wait: jest.fn(async () => undefined),
	};
	return {
		controller: new BuildAutoPlayerController(
			entity as any,
			GamemodeSettingsPresets.default,
			deps
		),
		entity,
		deps,
	};
};

describe("BuildAutoPlayerController", () => {
	test("rejects an invalid plan and keeps status disabled", () => {
		const { controller } = makeController(makeState());
		expect(() => controller.start({ coreUnits: [] } as any, 2)).toThrow(
			"Build plan is empty or invalid"
		);
		expect(controller.getStatus().enabled).toBe(false);
	});

	test("waits outside preparing phase without dispatching gameplay actions", async () => {
		const { controller, entity } = makeController(
			makeState(GamePhase.PLAYING, RoundType.PVP)
		);
		controller.start(plan as any, 2);
		await (controller as any).tick();
		expect(entity.put).not.toHaveBeenCalled();
		expect(controller.getStatus().activity).toBe("waiting");
	});

	test("full auto readies on PvE after skipping tactical positioning", async () => {
		const { controller, entity, deps } = makeController(makeState());
		controller.start(plan as any, 4);
		await (controller as any).tick();
		expect(deps.getOpponentBoard).not.toHaveBeenCalled();
		expect(entity.put).toHaveBeenCalledWith(
			expect.objectContaining({ type: "readyUpPlayerAction" })
		);
	});

	test("resets ready marker when preparing starts again with a new phase timestamp", async () => {
		const state = makeState();
		const { controller, entity } = makeController(state);
		controller.start(plan as any, 4);

		await (controller as any).tick();
		expect(entity.put).toHaveBeenCalledTimes(1);

		state.roundInfo.phase = GamePhase.PLAYING;
		state.roundInfo.phaseStartedAtSeconds = 10;
		state.playerInfo.ready = false;
		await (controller as any).tick();
		expect(entity.put).toHaveBeenCalledTimes(1);

		state.roundInfo.phase = GamePhase.PREPARING;
		state.roundInfo.phaseStartedAtSeconds = 20;
		await (controller as any).tick();
		expect(entity.put).toHaveBeenCalledTimes(2);
		expect(entity.put).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: "readyUpPlayerAction" })
		);
	});

	test("uses gamemode round info when player round info is stale", async () => {
		const state = makeState(GamePhase.PREPARING, RoundType.PVE_CREEP);
		let liveRoundInfo = { ...state.roundInfo };
		const { controller, entity } = makeController(state, () => liveRoundInfo);
		controller.start(plan as any, 4);

		await (controller as any).tick();
		expect(entity.put).toHaveBeenCalledTimes(1);

		liveRoundInfo = {
			...liveRoundInfo,
			round: 2,
			phase: GamePhase.PREPARING,
			phaseStartedAtSeconds: 200,
			roundType: RoundType.PVE_CREEP,
		};
		state.playerInfo.ready = true;
		await (controller as any).tick();

		expect(entity.put).toHaveBeenCalledTimes(2);
		expect(controller.getStatus().round).toBe(2);
	});

	test("does not dispatch an action if phase changes while thinking", async () => {
		const state = makeState(GamePhase.PREPARING, RoundType.PVP);
		state.cardShop.cards = [
			{
				id: "budaye-card",
				definitionId: 1,
				name: "Budaye",
				cost: 1,
				traits: ["wood"],
			} as any,
		];
		state.playerInfo.money = 10;
		const { controller, entity, deps } = makeController(state);
		deps.wait.mockImplementation(async () => {
			state.roundInfo.phase = GamePhase.PLAYING;
		});

		controller.start(plan as any, 2);
		await (controller as any).tick();

		expect(entity.put).not.toHaveBeenCalled();
		expect(controller.getStatus().activity).toBe("waiting");
	});

	test("continues in preparing when ready flag is stale from a previous phase", async () => {
		const state = makeState(GamePhase.PREPARING, RoundType.PVE_CREEP);
		state.playerInfo.ready = true;
		state.roundInfo.phaseStartedAtSeconds = 99;
		const { controller, entity } = makeController(state);

		controller.start(plan as any, 4);
		await (controller as any).tick();

		expect(entity.put).toHaveBeenCalledWith(
			expect.objectContaining({ type: "readyUpPlayerAction" })
		);
	});

	test("uses tactical advisor during PvP preparing and dispatches queued moves", async () => {
		const state = makeState(GamePhase.PREPARING, RoundType.PVP);
		state.playerInfo.opponentId = "p2";
		state.board.pieces.unit = { id: "unit" } as any;
		state.board.piecePositions["0,0"] = "unit";
		const { controller, entity, deps } = makeController(state);
		(deps.getPlayerBoard as jest.Mock).mockReturnValue({
			...createInitialBoardState("board"),
			pieces: { enemy: { id: "enemy" } as any },
			piecePositions: { "0,0": "enemy" },
		});
		(getPositioningAdvisor as jest.Mock).mockResolvedValue({
			getAdvice: jest.fn(async () => ({
				moves: [{ pieceId: "unit", targetX: 1, targetY: 0 }],
			})),
		});

		controller.start(plan as any, 1);
		await (controller as any).tick();
		await (controller as any).tick();

		expect(getPositioningAdvisor).toHaveBeenCalled();
		expect(entity.put).toHaveBeenCalledWith(
			expect.objectContaining({ type: "dropPiecePlayerAction" })
		);
	});

	test("subscription receives current enabled state for reconnect and stop disables it", () => {
		const { controller } = makeController(makeState());
		controller.start(plan as any, 3);
		const subscriber = jest.fn();
		controller.subscribe(subscriber);
		expect(subscriber).toHaveBeenCalledWith(
			expect.objectContaining({ enabled: true, level: 3, planName: "Budaye" })
		);
		expect(controller.stop()).toEqual(
			expect.objectContaining({ enabled: false, activity: "disabled" })
		);
	});
});
