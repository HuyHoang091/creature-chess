import wait from "delay";
import { call, delay as sagaDelay } from "redux-saga/effects";

import { BoardSelectors, BoardState } from "@shoki/board";

import {
	PlayerActions,
	PlayerEntity,
	PlayerState,
} from "@creature-chess/gamemode";
import {
	GamePhase,
	PieceModel,
	RoundInfoState,
	RoundType,
	getRoundType,
} from "@creature-chess/models";
import { GamemodeSettings } from "@creature-chess/models/settings";

import { BuildAdvicePlan } from "../build-advisor/types";
import { getPositioningAdvisor } from "../integration/advisor-instance";
import { PieceMove } from "../positioning-advisor/types";
import {
	DEFAULT_TICK_DELAY_MS,
	delayForKind,
} from "./action-delays";
import {
	BuildAutoPlayLevel,
	BuildAutoPlayPreset,
	NormalizedBuildPlan,
	chooseBuildAutoPlayAction,
	normalizeBuildAutoPlayPlan,
	normalizeBuildAutoPlayPreset,
} from "./policy";
import {
	LobbyPlayerSnapshot,
	LobbyTempo,
	TempoSnapshot,
	appendTempoSnapshot,
	createTempoSnapshot,
	detectLobbyTempo,
	resolveEffectivePreset,
} from "./tempo-heuristic";

export type BuildAutoPlayActivity =
	| "analyzing"
	| "choosing_action"
	| "acting"
	| "waiting"
	| "error"
	| "disabled";

export type BuildAutoPlayStatus = {
	enabled: boolean;
	level: BuildAutoPlayLevel | null;
	preset: BuildAutoPlayPreset | null;
	effectivePreset: BuildAutoPlayPreset | null;
	lobbyTempo: LobbyTempo | null;
	planName: string | null;
	round: number | null;
	activity: BuildAutoPlayActivity;
	message: string;
	recentSteps: string[];
};

type ControllerDeps = {
	getRoundInfo?: () => RoundInfoState;
	getOpponentBoard: (playerId: string) => BoardState<PieceModel> | null;
	getPlayerBoard?: (playerId: string) => BoardState<PieceModel> | null;
	getPotentialOpponentBoard?: (
		playerId: string
	) => BoardState<PieceModel> | null;
	getLobbyPlayers?: () => LobbyPlayerSnapshot[];
	wait?: (milliseconds: number) => Promise<void>;
};

type TacticalQueueResult = "queued" | "done" | "waiting";

const MAX_RECENT_STEPS = 5;

const getBoardSignature = (board: BoardState<PieceModel>) =>
	JSON.stringify({
		pieces: Object.fromEntries(
			Object.entries(board.pieces).map(([id, piece]) => [
				id,
				{
					definitionId: piece.definitionId,
					stage: piece.stage,
					items: (piece.items || []).map((item) => item.itemId),
				},
			])
		),
		piecePositions: board.piecePositions,
	});

export class BuildAutoPlayerController {
	private enabled = false;
	private level: BuildAutoPlayLevel | null = null;
	private preset: BuildAutoPlayPreset | null = null;
	private plan: NormalizedBuildPlan | null = null;
	private recentSteps: string[] = [];
	private activity: BuildAutoPlayActivity = "disabled";
	private message = "Coach auto đang tắt.";
	private subscribers = new Set<(status: BuildAutoPlayStatus) => void>();
	private tacticalMoves: PieceMove[] = [];
	private tacticalMovesRound: number | null = null;
	private lastPositionedRound: number | null = null;
	private tacticalBlockedRound: number | null = null;
	private readyRound: number | null = null;
	private activeRound: number | null = null;
	private activePhaseKey: string | null = null;
	private nextTickDelayMs = DEFAULT_TICK_DELAY_MS;
	private tempoHistory: TempoSnapshot[] = [];
	private lobbyTempo: LobbyTempo = "neutral";
	private effectivePreset: BuildAutoPlayPreset | null = null;
	private tempoSnapshotRound: number | null = null;

	public constructor(
		private entity: PlayerEntity,
		private settings: GamemodeSettings,
		private deps: ControllerDeps
	) {
		const controller = this;
		entity.runSaga(function* () {
			while (true) {
				yield sagaDelay(controller.nextTickDelayMs);
				yield call(() => controller.tick());
			}
		});
	}

	public start(
		rawPlan: BuildAdvicePlan,
		level: unknown,
		presetInput: unknown = "balanced"
	) {
		if (level !== 1 && level !== 2 && level !== 3 && level !== 4) {
			throw new Error("Invalid auto-play level");
		}

		const preset = normalizeBuildAutoPlayPreset(presetInput);
		if (!preset) {
			throw new Error("Invalid auto-play preset");
		}

		const plan = normalizeBuildAutoPlayPlan(rawPlan);
		if (!plan) {
			throw new Error("Build plan is empty or invalid");
		}

		this.enabled = true;
		this.level = level;
		this.preset = preset;
		this.plan = plan;
		this.recentSteps = [];
		this.tacticalMoves = [];
		this.tacticalMovesRound = null;
		this.lastPositionedRound = null;
		this.tacticalBlockedRound = null;
		this.readyRound = null;
		this.activeRound = null;
		this.activePhaseKey = null;
		this.nextTickDelayMs = DEFAULT_TICK_DELAY_MS;
		this.tempoHistory = [];
		this.lobbyTempo = "neutral";
		this.effectivePreset = preset;
		this.tempoSnapshotRound = null;
		this.publish(
			"analyzing",
			`Coach đã nhận build ${plan.planName} và bắt đầu đọc ván đấu.`,
			true
		);
		return this.getStatus();
	}

	public stop(message = "Coach đã tắt auto.") {
		this.enabled = false;
		this.level = null;
		this.preset = null;
		this.plan = null;
		this.tacticalMoves = [];
		this.tacticalMovesRound = null;
		this.tacticalBlockedRound = null;
		this.tempoHistory = [];
		this.lobbyTempo = "neutral";
		this.effectivePreset = null;
		this.tempoSnapshotRound = null;
		this.nextTickDelayMs = DEFAULT_TICK_DELAY_MS;
		this.publish("disabled", message, true);
		return this.getStatus();
	}

	public getStatus(): BuildAutoPlayStatus {
		const state = this.getCurrentState();
		return {
			enabled: this.enabled,
			level: this.level,
			preset: this.preset,
			effectivePreset: this.enabled ? this.effectivePreset : null,
			lobbyTempo: this.enabled ? this.lobbyTempo : null,
			planName: this.plan?.planName || null,
			round: state.roundInfo.round || null,
			activity: this.activity,
			message: this.message,
			recentSteps: [...this.recentSteps],
		};
	}

	public subscribe(callback: (status: BuildAutoPlayStatus) => void) {
		this.subscribers.add(callback);
		callback(this.getStatus());
		return () => this.subscribers.delete(callback);
	}

	private getCurrentState(): PlayerState {
		const state = this.entity.select((value: PlayerState) => value);
		const roundInfo = this.deps.getRoundInfo?.();
		return roundInfo ? { ...state, roundInfo } : state;
	}

	private publish(
		activity: BuildAutoPlayActivity,
		message: string,
		remember = false
	) {
		if (this.activity === activity && this.message === message && !remember) {
			return;
		}

		this.activity = activity;
		this.message = message;
		if (remember) {
			this.recentSteps = [...this.recentSteps, message].slice(
				-MAX_RECENT_STEPS
			);
		}
		const status = this.getStatus();
		this.subscribers.forEach((subscriber) => subscriber(status));
	}

	private resetLifecycleState(state: PlayerState) {
		const round = state.roundInfo.round;
		const phaseKey = [
			round,
			state.roundInfo.phase,
			state.roundInfo.phaseStartedAtSeconds,
		].join(":");
		if (this.activeRound === round && this.activePhaseKey === phaseKey) {
			return;
		}

		this.activeRound = round;
		this.activePhaseKey = phaseKey;
		this.tacticalMoves = [];
		this.tacticalMovesRound = null;
		this.lastPositionedRound = null;
		this.tacticalBlockedRound = null;
		if (state.roundInfo.phase === GamePhase.PREPARING) {
			this.readyRound = null;
		}
	}

	private updateTempoState(state: PlayerState) {
		const round = state.roundInfo.round;
		if (this.tempoSnapshotRound === round) {
			return;
		}

		const lobbyPlayers = this.deps.getLobbyPlayers?.() || [
			{
				health: state.playerInfo.health,
				status: state.playerInfo.status,
			},
		];
		this.tempoHistory = appendTempoSnapshot(
			this.tempoHistory,
			createTempoSnapshot(round, lobbyPlayers)
		);
		this.tempoSnapshotRound = round;
		this.lobbyTempo = detectLobbyTempo(this.tempoHistory);
		this.effectivePreset = resolveEffectivePreset(
			this.preset || "balanced",
			this.lobbyTempo
		);
	}

	private scheduleNextDelay(kind: "shop" | "tactical") {
		this.nextTickDelayMs = delayForKind(kind);
	}

	private async tick() {
		if (!this.enabled || !this.level || !this.plan) {
			return;
		}

		let state = this.getCurrentState();
		let round = state.roundInfo.round;
		this.resetLifecycleState(state);
		this.updateTempoState(state);

		if (state.playerInfo.health <= 0) {
			this.stop("Coach đã dừng auto vì người chơi đã bị loại.");
			return;
		}

		if (state.roundInfo.phase !== GamePhase.PREPARING) {
			this.tacticalMoves = [];
			this.tacticalMovesRound = null;
			this.lastPositionedRound = null;
			this.tacticalBlockedRound = null;
			this.publish(
				"waiting",
				"Đang combat, Coach tạm dừng và sẽ tiếp tục khi vào preparing..."
			);
			return;
		}

		if (state.playerInfo.ready && this.readyRound === round) {
			this.publish("waiting", "Coach đã khóa hành động, chờ round tiếp theo...");
			return;
		}

		if (this.tacticalMovesRound !== round) {
			this.tacticalMoves = [];
			this.tacticalMovesRound = null;
		}

		if (this.tacticalMoves.length > 0) {
			this.applyNextTacticalMove(state, round);
			return;
		}

		if (this.lastPositionedRound === round) {
			this.finalizeAfterTactical(round);
			return;
		}

		this.publish(
			"choosing_action",
			"Đang lượng giá cửa hàng, bench và bàn cờ..."
		);
		await (this.deps.wait || wait)(delayForKind("thinking"));

		state = this.getCurrentState();
		round = state.roundInfo.round;
		this.resetLifecycleState(state);

		if (!this.enabled) {
			return;
		}
		if (state.roundInfo.phase !== GamePhase.PREPARING) {
			this.tacticalMoves = [];
			this.tacticalMovesRound = null;
			this.lastPositionedRound = null;
			this.tacticalBlockedRound = null;
			this.publish(
				"waiting",
				"Đang combat, Coach tạm dừng và sẽ tiếp tục khi vào preparing..."
			);
			return;
		}
		if (state.playerInfo.ready && this.readyRound === round) {
			this.publish("waiting", "Coach đã khóa hành động, chờ round tiếp theo...");
			return;
		}

		const action = chooseBuildAutoPlayAction(
			state,
			this.plan,
			this.settings,
			this.level,
			this.effectivePreset || this.preset || "balanced"
		);
		if (action) {
			const latestState = this.getCurrentState();
			if (
				latestState.roundInfo.phase !== GamePhase.PREPARING ||
				(latestState.playerInfo.ready && this.readyRound === round)
			) {
				this.publish(
					"waiting",
					"Phase đã đổi, Coach dừng lệnh hiện tại và chờ preparing..."
				);
				return;
			}
			this.scheduleNextDelay("shop");
			this.publish("acting", action.message, true);
			this.entity.put(action.action);
			return;
		}

		if (this.lastPositionedRound !== round) {
			if (this.tacticalBlockedRound === round) {
				this.publish(
					"waiting",
					"Chưa hoàn tất xếp quân, Coach sẽ thử lại ở nhịp tiếp theo."
				);
				return;
			}

			const tacticalResult = await this.queueTacticalPositioning(state);
			if (tacticalResult === "queued" || tacticalResult === "waiting") {
				return;
			}
		}

		this.finalizeAfterTactical(round);
	}

	private finalizeAfterTactical(round: number) {
		if (this.level === 4 && this.readyRound !== round) {
			this.readyRound = round;
			this.scheduleNextDelay("shop");
			this.publish("acting", "Đã hoàn tất chuỗi hành động, đang sẵn sàng...", true);
			this.entity.put(PlayerActions.readyUpPlayerAction());
			return;
		}

		this.scheduleNextDelay("shop");
		this.publish("waiting", "Đã hoàn tất chuỗi hành động, chờ round tiếp theo...");
	}

	private applyNextTacticalMove(state: PlayerState, round: number) {
		const move = this.tacticalMoves.shift();
		if (!move) {
			return;
		}

		const position = BoardSelectors.getPiecePosition(state.board, move.pieceId);
		if (!position) {
			this.tacticalMoves = [];
			this.tacticalBlockedRound = round;
			this.publish(
				"error",
				"Nước xếp quân không còn hợp lệ, Coach sẽ thử lại ở nhịp tiếp theo.",
				true
			);
			return;
		}

		const latestState = this.getCurrentState();
		if (latestState.roundInfo.phase !== GamePhase.PREPARING) {
			this.tacticalMoves = [];
			this.tacticalMovesRound = null;
			this.publish(
				"waiting",
				"Đã vào combat, Coach dừng xếp quân và chờ preparing..."
			);
			return;
		}

		this.scheduleNextDelay("tactical");
		this.publish(
			"acting",
			`Đang áp dụng phương án: chuyển quân đến (${move.targetX},${move.targetY})...`,
			true
		);
		this.entity.put(
			PlayerActions.dropPiecePlayerAction({
				pieceId: move.pieceId,
				from: { type: "board", location: position },
				to: {
					type: "board",
					location: { x: move.targetX, y: move.targetY },
				},
			})
		);

		if (this.tacticalMoves.length === 0) {
			this.lastPositionedRound = round;
		}
	}

	private async queueTacticalPositioning(
		state: PlayerState
	): Promise<TacticalQueueResult> {
		const round = state.roundInfo.round;
		const roundType = state.roundInfo.roundType || getRoundType(round);
		if (roundType !== RoundType.PVP) {
			this.lastPositionedRound = round;
			return "done";
		}

		const opponentId = state.playerInfo.opponentId;
		const myBoard = state.board;
		const opponentBoard =
			this.deps.getOpponentBoard(this.entity.id) ||
			this.deps.getPlayerBoard?.(opponentId || "");
		if (
			!opponentId ||
			opponentId === "creep" ||
			Object.keys(myBoard.pieces).length === 0 ||
			!opponentBoard ||
			Object.keys(opponentBoard.pieces).length === 0
		) {
			this.lastPositionedRound = round;
			this.publish(
				"waiting",
				"Chưa đủ dữ liệu đối thủ, Coach bỏ qua xếp quân round này..."
			);
			return "done";
		}

		const boardSignature = getBoardSignature(myBoard);
		this.publish("analyzing", "Đang phân tích đối thủ chính...");

		try {
			const advisor = await getPositioningAdvisor();
			let stopPhaseWatcher = false;
			const advicePromise = advisor
				.getAdvice(myBoard, opponentBoard, undefined, {
					selectionMode: "max",
				})
				.then((advice) => ({ type: "advice" as const, advice }))
				.catch((error) => ({ type: "error" as const, error }));
			const phaseExitPromise = (async () => {
				while (!stopPhaseWatcher) {
					await (this.deps.wait || wait)(100);
					const latest = this.getCurrentState();
					if (
						!this.enabled ||
						latest.roundInfo.round !== round ||
						latest.roundInfo.phase !== GamePhase.PREPARING
					) {
						return { type: "phase-exit" as const };
					}
				}
				return { type: "cancelled" as const };
			})();
			const tacticalResult = await Promise.race([
				advicePromise,
				phaseExitPromise,
			]);
			stopPhaseWatcher = true;
			if (tacticalResult.type === "phase-exit") {
				this.tacticalMoves = [];
				this.tacticalMovesRound = null;
				this.publish(
					"waiting",
					"Đã vào combat, Coach dừng phân tích và chờ preparing..."
				);
				return "waiting";
			}
			if (tacticalResult.type === "cancelled") {
				return "waiting";
			}
			if (tacticalResult.type === "error") {
				throw tacticalResult.error;
			}
			const advice = tacticalResult.advice;
			const currentState = this.getCurrentState();

			if (
				!this.enabled ||
				currentState.roundInfo.round !== round ||
				currentState.roundInfo.phase !== GamePhase.PREPARING
			) {
				return "waiting";
			}

			if (getBoardSignature(currentState.board) !== boardSignature) {
				this.publish(
					"analyzing",
					"Đội hình vừa thay đổi, Coach sẽ phân tích lại..."
				);
				return "waiting";
			}

			if (!advice) {
				this.tacticalBlockedRound = round;
				this.publish("error", "Coach chưa tìm được phương án xếp quân.", true);
				return "waiting";
			}

			this.tacticalMoves = advice.moves;
			this.tacticalMovesRound = round;
			if (this.tacticalMoves.length === 0) {
				this.lastPositionedRound = round;
				return "done";
			}

			return "queued";
		} catch (error: any) {
			this.tacticalBlockedRound = round;
			this.publish(
				"error",
				`Không thể hoàn tất xếp quân: ${error?.message || "unknown error"}`,
				true
			);
			return "waiting";
		}
	}
}
