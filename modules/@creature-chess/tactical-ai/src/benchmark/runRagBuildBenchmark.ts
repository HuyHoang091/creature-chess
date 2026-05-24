import http from "http";
import { writeFile } from "fs/promises";

import { put } from "redux-saga/effects";
import { call, delay, getContext, select, takeLatest } from "typed-redux-saga";

import { BoardSelectors, createBoardSlice } from "@shoki/board";

import {
	GameEvents,
	Gamemode,
	type PlayerAction,
	PlayerActions,
	PlayerCommands,
	PlayerEntity,
	PlayerEvents,
	PlayerState,
	PlayerStateSelectors,
	playerEntity,
	getAllDefinitions,
	getPlayerEntityDependencies,
} from "@creature-chess/gamemode";
import { createBuildAdviceContext } from "@creature-chess/tactical-ai/src/build-advisor/context";
import {
	BuildAdviceContext,
	BuildAdvicePlan,
} from "@creature-chess/tactical-ai/src/build-advisor/types";
import {
	Card,
	GamePhase,
	MAX_ITEM_SLOTS,
	PieceModel,
	findRecipe,
	getItemDefinition,
} from "@creature-chess/models";
import { GAME_PHASE_LENGTHS, PIECES_TO_EVOLVE } from "@creature-chess/models/config";

// Tăng thời gian chơi để CPU chạy kịp 4 trận đấu song song (bị scale xuống 0.005)
GAME_PHASE_LENGTHS[GamePhase.PLAYING] = 300_000;
GAME_PHASE_LENGTHS[GamePhase.PREPARING] = 45_000;
import { PlayerProfile } from "@creature-chess/models/player";
import {
	GamemodeSettings,
	GamemodeSettingsPresets,
} from "@creature-chess/models/settings";
import { ActionDecoder, PPOAgent, StateEncoder } from "@creature-chess/rl-bot";
import { getPiecesForStage } from "@creature-chess/gamemode/src/game/evolution";

import { botLogicSaga } from "@cc-server/bot";
import { getActions } from "@cc-server/bot/src/actions";
import { type BrainAction } from "@cc-server/bot/src/brain";
import { BOT_ACTION_TIME_MS } from "@cc-server/bot/src/constants";
import { PREFERRED_LOCATIONS } from "@cc-server/bot/src/preferredLocations";
import { putBenchOnBoard } from "@cc-server/bot/src/putBenchOnBoard";

type BenchmarkPersonality = {
	ambition: number;
	composure: number;
	vision: number;
};

type BenchmarkBotMode = "rule_based" | "hybrid" | "rl";

type BenchmarkConfig = {
	games: number;
	concurrency: number;
	outputPath: string;
	ragServiceUrl: string;
	ragTimeoutMs: number;
	timerScale: number;
	gameTimeoutMs: number;
	preparingTimeoutSeconds: number;
	nonRateLimitRetries: number;
	maxRateLimitBackoffMs: number;
	initialRateLimitBackoffMs: number;
	benchmarkBotMode: BenchmarkBotMode;
	rlModelPath: string;
	settings: GamemodeSettings;
};

type BuildAdviceResponse = {
	answer: string;
	sources?: string[];
	plan?: BuildAdvicePlan | null;
	retrieved_chunks?: number;
};

type JsonHttpResponse = {
	ok: boolean;
	status: number;
	body: any;
};

type PlannedUnit = {
	name: string;
	definitionId: number;
	cost: number;
	targetStars: number;
	priority: "core" | "support" | "transition" | "flex";
	reason: string;
};

type PlannedItemAction = {
	itemId: string;
	targetPiece: string;
	action: "craft_now" | "equip_now" | "hold" | "temporary_holder";
	reason: string;
	from: string[];
};

type NormalizedBuildPlan = {
	planName: string;
	primaryTraits: string[];
	secondaryTraits: string[];
	coreUnits: PlannedUnit[];
	transitionUnits: PlannedUnit[];
	avoidUnits: string[];
	rollStrategy: {
		summary: string;
		targetLevel: number | null;
		slowRollAt: number | null;
	};
	itemPlan: PlannedItemAction[];
	shortTermSteps: string[];
	desiredUnitNames: Set<string>;
	coreUnitNames: Set<string>;
	transitionUnitNames: Set<string>;
	avoidUnitNames: Set<string>;
	plannedUnitsByName: Map<string, PlannedUnit>;
};

type BenchmarkRagCall = {
	round: number;
	attempts: number;
	rateLimitRetries: number;
	durationMs: number;
	success: boolean;
	planName: string | null;
	error: string | null;
};

type BenchmarkPlanSnapshot = {
	round: number;
	planName: string;
	coreUnits: string[];
	transitionUnits: string[];
	shortTermSteps: string[];
};

type BenchmarkGameResult = {
	gameIndex: number;
	durationMs: number;
	rank: number;
	finishRound: number;
	top4: boolean;
	win: boolean;
	ragCalls: BenchmarkRagCall[];
	plans: BenchmarkPlanSnapshot[];
};

type BenchmarkSummary = {
	totalGames: number;
	completedGames: number;
	top4Rate: number;
	winRate: number;
	averageRank: number;
	benchmarkBotMode: BenchmarkBotMode;
	expectedRagCalls: number;
	totalRagCalls: number;
	successfulRagCalls: number;
	totalRateLimitRetries: number;
	outputPath: string;
	results: BenchmarkGameResult[];
};

type MutableBenchmarkState = {
	currentPlan: NormalizedBuildPlan | null;
	ragCalls: BenchmarkRagCall[];
	plans: BenchmarkPlanSnapshot[];
};

type BenchmarkAction = {
	name: string;
	action: ReturnType<
		| typeof PlayerActions.buyCardPlayerAction
		| typeof PlayerActions.buyXpPlayerAction
		| typeof PlayerActions.rerollCardsPlayerAction
		| typeof PlayerActions.sellPiecePlayerAction
		| typeof PlayerActions.dropPiecePlayerAction
		| typeof PlayerActions.equipItemPlayerAction
		| typeof PlayerActions.craftItemInventoryPlayerAction
	>;
};

const ORIGINAL_SET_TIMEOUT = global.setTimeout.bind(global);
const ORIGINAL_CLEAR_TIMEOUT = global.clearTimeout.bind(global);
const ORIGINAL_SET_INTERVAL = global.setInterval.bind(global);
const ORIGINAL_CLEAR_INTERVAL = global.clearInterval.bind(global);

const BENCHMARK_BUILD_ROUNDS = new Set([4, 15]);

const BENCHMARK_BOT_ID = "rag-build-benchmark-bot";
const BENCHMARK_BOT_NAME = "[RAG] Benchmark";
const DEFAULT_BENCHMARK_BOT_MODE: BenchmarkBotMode = "hybrid";

const DEFAULT_BOT_PERSONALITY: BenchmarkPersonality = {
	ambition: 120,
	composure: 120,
	vision: 120,
};

const OPPONENT_PERSONALITIES: BenchmarkPersonality[] = [
	{ ambition: 70, composure: 140, vision: 90 },
	{ ambition: 95, composure: 110, vision: 130 },
	{ ambition: 140, composure: 75, vision: 100 },
	{ ambition: 115, composure: 145, vision: 80 },
	{ ambition: 90, composure: 95, vision: 145 },
	{ ambition: 155, composure: 105, vision: 70 },
	{ ambition: 125, composure: 85, vision: 135 },
];

const BENCHMARK_PLAYER_PROFILE: PlayerProfile = {
	picture: 1,
	title: null,
};

const definitionByName = new Map(
	getAllDefinitions().map((definition) => [definition.name.toLowerCase(), definition])
);

const sleepReal = (ms: number) =>
	new Promise<void>((resolve) => ORIGINAL_SET_TIMEOUT(resolve, ms));

const benchmarkLogger: any = {
	info: () => undefined,
	warn: () => undefined,
	error: (...args: any[]) => console.error(...args),
	debug: () => undefined,
	verbose: () => undefined,
	silly: () => undefined,
	child: () => benchmarkLogger,
};

let benchmarkRlAgent: PPOAgent | null = null;
let benchmarkRlStateEncoder: StateEncoder | null = null;
let benchmarkRlActionDecoder: ActionDecoder | null = null;


const parseEnvNumber = (value: string | undefined, fallback: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBenchmarkBotMode = (
	value: string | undefined
): BenchmarkBotMode => {
	if (value === "rule_based" || value === "hybrid" || value === "rl") {
		return value;
	}

	return DEFAULT_BENCHMARK_BOT_MODE;
};

const getBenchmarkConfig = (): BenchmarkConfig => ({
	games: parseEnvNumber(process.env.RAG_BUILD_BENCHMARK_GAMES, 100),
	concurrency: parseEnvNumber(process.env.RAG_BUILD_BENCHMARK_CONCURRENCY, 5),
	outputPath:
		process.env.RAG_BUILD_BENCHMARK_OUTPUT ||
		`rag-build-benchmark-${Date.now()}.json`,
	ragServiceUrl: process.env.RAG_SERVICE_URL || "http://localhost:8003",
	ragTimeoutMs: parseEnvNumber(process.env.RAG_BUILD_BENCHMARK_RAG_TIMEOUT_MS, 600000),
	timerScale: parseEnvNumber(process.env.RAG_BUILD_BENCHMARK_TIMER_SCALE, 0),
	gameTimeoutMs: parseEnvNumber(
		process.env.RAG_BUILD_BENCHMARK_GAME_TIMEOUT_MS,
		1800000
	),
	preparingTimeoutSeconds: parseEnvNumber(
		process.env.RAG_BUILD_BENCHMARK_PREPARING_TIMEOUT_SECONDS,
		172800
	),
	nonRateLimitRetries: parseEnvNumber(
		process.env.RAG_BUILD_BENCHMARK_NON_429_RETRIES,
		5
	),
	maxRateLimitBackoffMs: parseEnvNumber(
		process.env.RAG_BUILD_BENCHMARK_MAX_429_BACKOFF_MS,
		60000
	),
	initialRateLimitBackoffMs: parseEnvNumber(
		process.env.RAG_BUILD_BENCHMARK_INITIAL_429_BACKOFF_MS,
		4000
	),
	benchmarkBotMode: parseBenchmarkBotMode(
		process.env.RAG_BUILD_BENCHMARK_BOT_MODE || process.env.BOT_MODE
	),
	rlModelPath:
		process.env.RL_MODEL_PATH ||
		"modules/@creature-chess/rl-bot/training/models/final",
	settings: {
		...GamemodeSettingsPresets.default,
		battleTurnDuration: 0, // Bỏ qua delay animation giữa các turn để tính combat ngay lập tức
	},
});

const installScaledTimers = (scale: number) => {
	if (!(scale > 0 && scale < 1)) {
		return () => undefined;
	}

	const scaleDelay = (value?: number) => {
		if (!Number.isFinite(value)) {
			return value;
		}

		return Math.max(0, Math.floor((value as number) * scale));
	};

	global.setTimeout = ((handler: any, timeout?: number, ...args: any[]) =>
		ORIGINAL_SET_TIMEOUT(handler, scaleDelay(timeout), ...args)) as typeof setTimeout;
	global.clearTimeout = ((timeoutId: any) =>
		ORIGINAL_CLEAR_TIMEOUT(timeoutId)) as typeof clearTimeout;
	global.setInterval = ((handler: any, timeout?: number, ...args: any[]) =>
		ORIGINAL_SET_INTERVAL(handler, scaleDelay(timeout), ...args)) as typeof setInterval;
	global.clearInterval = ((intervalId: any) =>
		ORIGINAL_CLEAR_INTERVAL(intervalId)) as typeof clearInterval;

	return () => {
		global.setTimeout = ORIGINAL_SET_TIMEOUT as typeof setTimeout;
		global.clearTimeout = ORIGINAL_CLEAR_TIMEOUT as typeof clearTimeout;
		global.setInterval = ORIGINAL_SET_INTERVAL as typeof setInterval;
		global.clearInterval = ORIGINAL_CLEAR_INTERVAL as typeof clearInterval;
	};
};

const httpPostJson = (
	url: string,
	body: object,
	timeoutMs: number = 120000
): Promise<JsonHttpResponse> =>
	new Promise((resolve, reject) => {
		const data = JSON.stringify(body);
		const request = http.request(
			url,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(data),
				},
				timeout: timeoutMs,
			},
			(response) => {
				let responseText = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => (responseText += chunk));
				response.on("end", () => {
					try {
						resolve({
							ok:
								(response.statusCode || 0) >= 200 &&
								(response.statusCode || 0) < 300,
							status: response.statusCode || 0,
							body: responseText ? JSON.parse(responseText) : {},
						});
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		request.on("timeout", () => {
			request.destroy();
			reject(new Error(`Request timed out after ${timeoutMs}ms`));
		});

		request.on("error", reject);
		request.write(data);
		request.end();
	});

const isRateLimitErrorText = (value: string | null | undefined) => {
	const text = (value || "").toLowerCase();
	return (
		text.includes("429") ||
		text.includes("too many requests") ||
		text.includes("rate limit") ||
		text.includes("rate-limit") ||
		text.includes("quota")
	);
};

const canonicalUnitName = (name: unknown) => {
	if (typeof name !== "string") {
		return null;
	}

	const trimmed = name.trim();
	if (!trimmed) {
		return null;
	}

	return definitionByName.get(trimmed.toLowerCase())?.name || trimmed;
};

const normalizeTargetStars = (value: unknown) => {
	const parsed = Number(value);
	if (parsed === 3) {
		return 3;
	}
	return 2;
};

const normalizePlanUnit = (
	unit: unknown,
	fallbackPriority: PlannedUnit["priority"]
): PlannedUnit | null => {
	if (!unit || typeof unit !== "object") {
		return null;
	}

	const source = unit as Record<string, unknown>;
	const name = canonicalUnitName(source.name);
	if (!name) {
		return null;
	}

	const definition = definitionByName.get(name.toLowerCase());
	if (!definition) {
		return null;
	}

	const priority =
		source.priority === "core" ||
		source.priority === "support" ||
		source.priority === "transition" ||
		source.priority === "flex"
			? source.priority
			: fallbackPriority;

	return {
		name,
		definitionId: definition.id,
		cost: definition.cost,
		targetStars: normalizeTargetStars(source.targetStars),
		priority,
		reason:
			typeof source.reason === "string" && source.reason.trim()
				? source.reason.trim()
				: "",
	};
};

const normalizeItemPlan = (itemPlan: unknown): PlannedItemAction[] => {
	if (!Array.isArray(itemPlan)) {
		return [];
	}

	return itemPlan
		.map((entry) => {
			if (!entry || typeof entry !== "object") {
				return null;
			}

			const source = entry as Record<string, unknown>;
			const itemId =
				typeof source.itemId === "string" && getItemDefinition(source.itemId)
					? source.itemId
					: null;
			const targetPiece = canonicalUnitName(source.targetPiece);

			if (!itemId || !targetPiece) {
				return null;
			}

			const action =
				source.action === "craft_now" ||
				source.action === "equip_now" ||
				source.action === "hold" ||
				source.action === "temporary_holder"
					? source.action
					: "hold";

			const from = Array.isArray(source.from)
				? source.from.filter(
						(item): item is string =>
							typeof item === "string" && !!getItemDefinition(item)
				  )
				: [];

			return {
				itemId,
				targetPiece,
				action,
				reason:
					typeof source.reason === "string" && source.reason.trim()
						? source.reason.trim()
						: "",
				from,
			};
		})
		.filter((entry): entry is PlannedItemAction => entry !== null);
};

const normalizeBuildPlan = (plan: BuildAdvicePlan | null | undefined) => {
	if (!plan) {
		return null;
	}

	const coreUnits = Array.isArray(plan.coreUnits)
		? plan.coreUnits
				.map((unit) => normalizePlanUnit(unit, "core"))
				.filter((unit): unit is PlannedUnit => unit !== null)
		: [];
	const transitionUnits = Array.isArray(plan.transitionUnits)
		? plan.transitionUnits
				.map((unit) => normalizePlanUnit(unit, "transition"))
				.filter((unit): unit is PlannedUnit => unit !== null)
		: [];
	const allPlannedUnits = [...coreUnits, ...transitionUnits];

	if (allPlannedUnits.length === 0) {
		return null;
	}

	const plannedUnitsByName = new Map<string, PlannedUnit>();
	allPlannedUnits.forEach((unit) => plannedUnitsByName.set(unit.name, unit));

	const avoidUnits = Array.isArray(plan.avoidUnits)
		? plan.avoidUnits
				.map((name) => canonicalUnitName(name))
				.filter((name): name is string => name !== null)
		: [];

	return {
		planName:
			typeof plan.planName === "string" && plan.planName.trim()
				? plan.planName.trim()
				: "RAG Build",
		primaryTraits: Array.isArray(plan.primaryTraits)
			? plan.primaryTraits.filter(
					(trait): trait is string => typeof trait === "string" && trait.trim() !== ""
			  )
			: [],
		secondaryTraits: Array.isArray(plan.secondaryTraits)
			? plan.secondaryTraits.filter(
					(trait): trait is string => typeof trait === "string" && trait.trim() !== ""
			  )
			: [],
		coreUnits,
		transitionUnits,
		avoidUnits,
		rollStrategy: {
			summary:
				typeof plan.rollStrategy?.summary === "string"
					? plan.rollStrategy.summary
					: "",
			targetLevel:
				typeof plan.rollStrategy?.targetLevel === "number"
					? plan.rollStrategy.targetLevel
					: null,
			slowRollAt:
				typeof plan.rollStrategy?.slowRollAt === "number"
					? plan.rollStrategy.slowRollAt
					: null,
		},
		itemPlan: normalizeItemPlan(plan.itemPlan),
		shortTermSteps: Array.isArray(plan.shortTermSteps)
			? plan.shortTermSteps.filter(
					(step): step is string => typeof step === "string" && step.trim() !== ""
			  )
			: [],
		desiredUnitNames: new Set(allPlannedUnits.map((unit) => unit.name)),
		coreUnitNames: new Set(coreUnits.map((unit) => unit.name)),
		transitionUnitNames: new Set(transitionUnits.map((unit) => unit.name)),
		avoidUnitNames: new Set(avoidUnits),
		plannedUnitsByName,
	};
};

const createPlayerEntityForBenchmark = (
	gamemode: Gamemode,
	playerId: string,
	name: string,
	settings: GamemodeSettings
) => {
	const boardSlices = {
		boardSlice: createBoardSlice<PieceModel>(`benchmark-${playerId}-board`, {
			width: settings.boardWidth,
			height: settings.boardHalfHeight,
		}),
		benchSlice: createBoardSlice<PieceModel>(`benchmark-${playerId}-bench`, {
			width: settings.benchSize,
			height: 1,
		}),
	};

	return playerEntity(
		playerId,
		{
			logger: benchmarkLogger,
			gamemode,
			boardSlices,
			settings,
		},
		{
			match: null,
			name,
			profile: BENCHMARK_PLAYER_PROFILE,
			finishPosition: -1,
			finishRound: -1,
		}
	);
};

const initialiseBenchmarkPlayer = (
	entity: PlayerEntity,
	settings: GamemodeSettings
) => {
	entity.runSaga(function* () {
		yield put(
			PlayerCommands.playerInfoCommands.updateMoneyCommand(settings.startingMoney)
		);
		yield put(
			PlayerCommands.playerInfoCommands.updateLevelCommand({
				level: settings.startingLevel,
				xp: 0,
			})
		);
	});
};

const getAllPiecesForState = (state: PlayerState) => [
	...BoardSelectors.getAllPieces(state.board),
	...BoardSelectors.getAllPieces(state.bench),
];

const getCopyCountForPiece = (piece: PieceModel) =>
	getPiecesForStage(piece.stage, PIECES_TO_EVOLVE);

const countOwnedCopies = (state: PlayerState, definitionId: number) =>
	getAllPiecesForState(state)
		.filter((piece) => piece.definitionId === definitionId)
		.reduce((total, piece) => total + getCopyCountForPiece(piece), 0);

const getDesiredCopiesForStars = (targetStars: number) =>
	getPiecesForStage(targetStars - 1, PIECES_TO_EVOLVE);

const getPieceLocation = (state: PlayerState, pieceId: string) => {
	const boardPosition = BoardSelectors.getPiecePosition(state.board, pieceId);
	if (boardPosition) {
		return {
			type: "board" as const,
			location: { x: boardPosition.x, y: boardPosition.y },
		};
	}

	const benchPosition = BoardSelectors.getPiecePosition(state.bench, pieceId);
	if (benchPosition) {
		return {
			type: "bench" as const,
			location: { x: benchPosition.x, y: 0 },
		};
	}

	return null;
};

const getUnitName = (pieceOrCard: PieceModel | Card) =>
	"name" in pieceOrCard ? pieceOrCard.name : pieceOrCard.definition.name;

const getUnitTraits = (pieceOrCard: PieceModel | Card) => pieceOrCard.traits;

const getPiecePriorityScore = (
	pieceOrCard: PieceModel | Card,
	plan: NormalizedBuildPlan
) => {
	const name = getUnitName(pieceOrCard);
	if (!name) {
		return 0;
	}

	if (plan.coreUnitNames.has(name)) {
		return 300;
	}

	if (plan.transitionUnitNames.has(name)) {
		return 180;
	}

	if (plan.avoidUnitNames.has(name)) {
		return -200;
	}

	const traits = getUnitTraits(pieceOrCard);
	const sharesPrimaryTrait = traits.some((trait) => plan.primaryTraits.includes(trait));
	if (sharesPrimaryTrait) {
		return 40;
	}

	return 0;
};

const pickSellCandidate = (state: PlayerState, plan: NormalizedBuildPlan) => {
	const candidates = BoardSelectors.getAllPieces(state.bench)
		.concat(BoardSelectors.getAllPieces(state.board))
		.filter((piece) => {
			if ((piece.items || []).length > 0) {
				return false;
			}

			return getPiecePriorityScore(piece, plan) <= 0;
		})
		.sort(
			(a, b) =>
				getPiecePriorityScore(a, plan) - getPiecePriorityScore(b, plan) ||
				a.definition.cost - b.definition.cost ||
				a.stage - b.stage
		);

	return candidates[0] || null;
};

const getPreferredSort = (traits: string[]) => {
	const role = traits[1] as "valiant" | "arcane" | "cunning" | undefined;
	return role ? PREFERRED_LOCATIONS[role] : undefined;
};

const findBestShopBuyAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
): BenchmarkAction | null => {
	const money = PlayerStateSelectors.getPlayerMoney(state);
	const cards = state.cardShop.cards;

	let bestCandidate: { index: number; card: Card; score: number } | null = null;

	for (let index = 0; index < cards.length; index++) {
		const card = cards[index];
		if (!card || money < card.cost) {
			continue;
		}

		const score = getPiecePriorityScore(card, plan);
		if (score <= 0) {
			continue;
		}

		const plannedUnit = plan.plannedUnitsByName.get(card.name);
		if (plannedUnit) {
			const currentCopies = countOwnedCopies(state, card.definitionId);
			const desiredCopies = getDesiredCopiesForStars(plannedUnit.targetStars);

			if (currentCopies >= desiredCopies) {
				continue;
			}
		}

		const weightedScore =
			score +
			card.cost * 10 +
			(plan.coreUnitNames.has(card.name) ? 40 : 0) +
			(plan.transitionUnitNames.has(card.name) ? 10 : 0);

		if (!bestCandidate || weightedScore > bestCandidate.score) {
			bestCandidate = { index, card, score: weightedScore };
		}
	}

	if (!bestCandidate) {
		return null;
	}

	const candidate = bestCandidate;

	const pieceCount = PlayerStateSelectors.getAllPieceCount(state);
	const maxPieces = PlayerStateSelectors.getPlayerLevel(state) + settings.benchSize;

	if (pieceCount >= maxPieces) {
		const sellCandidate = pickSellCandidate(state, plan);
		if (!sellCandidate) {
			return null;
		}

		return {
			name: `sell-for-space:${sellCandidate.definition.name}`,
			action: PlayerActions.sellPiecePlayerAction({ pieceId: sellCandidate.id }),
		};
	}

	return {
		name: `buy:${candidate.card.name}`,
		action: PlayerActions.buyCardPlayerAction({
			index: candidate.index,
			sortPositions: getPreferredSort(candidate.card.traits),
		}),
	};
};

const getBoardLimit = (state: PlayerState) =>
	PlayerStateSelectors.getPlayerLevel(state);

const findBestBoardPromotionAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BenchmarkAction | null => {
	const boardPieces = BoardSelectors.getAllPieces(state.board);
	const benchPieces = BoardSelectors.getAllPieces(state.bench)
		.filter((piece) => getPiecePriorityScore(piece, plan) > 0)
		.sort(
			(a, b) =>
				getPiecePriorityScore(b, plan) - getPiecePriorityScore(a, plan) ||
				b.definition.cost - a.definition.cost ||
				b.stage - a.stage
		);
	const boardLimit = getBoardLimit(state);

	if (benchPieces.length === 0) {
		return null;
	}

	const candidate = benchPieces[0];
	const from = getPieceLocation(state, candidate.id);

	if (!from || from.type !== "bench") {
		return null;
	}

	if (boardPieces.length < boardLimit) {
		const emptySlot = BoardSelectors.getFirstEmptySlot(
			state.board,
			getPreferredSort(candidate.traits)
		);

		if (!emptySlot) {
			return null;
		}

		return {
			name: `bench-to-board:${candidate.definition.name}`,
			action: PlayerActions.dropPiecePlayerAction({
				pieceId: candidate.id,
				from,
				to: {
					type: "board",
					location: { x: emptySlot.x, y: emptySlot.y },
				},
			}),
		};
	}

	const replaceableBoardPiece = boardPieces
		.filter(
			(piece) =>
				getPiecePriorityScore(piece, plan) <
				getPiecePriorityScore(candidate, plan)
		)
		.sort(
			(a, b) =>
				getPiecePriorityScore(a, plan) - getPiecePriorityScore(b, plan) ||
				a.definition.cost - b.definition.cost ||
				a.stage - b.stage
		)[0];

	if (!replaceableBoardPiece) {
		return null;
	}

	const to = getPieceLocation(state, replaceableBoardPiece.id);
	if (!to || to.type !== "board") {
		return null;
	}

	return {
		name: `swap-in:${candidate.definition.name}`,
		action: PlayerActions.dropPiecePlayerAction({
			pieceId: candidate.id,
			from,
			to,
		}),
	};
};

const findTargetPiece = (state: PlayerState, targetName: string) =>
	getAllPiecesForState(state)
		.filter((piece) => piece.definition.name === targetName)
		.sort(
			(a, b) =>
				b.stage - a.stage ||
				b.definition.cost - a.definition.cost ||
				((b.items || []).length - (a.items || []).length)
		)[0] || null;

const findInventoryIndex = (
	inventory: string[],
	itemId: string,
	usedIndices: Set<number> = new Set()
) => {
	for (let index = 0; index < inventory.length; index++) {
		if (!usedIndices.has(index) && inventory[index] === itemId) {
			return index;
		}
	}

	return -1;
};

const createRecoverItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BenchmarkAction | null => {
	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);

		if (!targetPiece) {
			continue;
		}

		const inventory = state.playerInfo.inventory || [];
		const firstIndex =
			itemAction.from.length >= 1
				? findInventoryIndex(inventory, itemAction.from[0])
				: -1;
		const secondIndex =
			itemAction.from.length >= 2 && firstIndex >= 0
				? findInventoryIndex(inventory, itemAction.from[1], new Set([firstIndex]))
				: -1;

		const hasReadyItem = inventory.includes(itemAction.itemId);
		const hasRecipeInInventory = firstIndex >= 0 && secondIndex >= 0;

		if (hasReadyItem || hasRecipeInInventory) {
			continue;
		}

		const holder = getAllPiecesForState(state)
			.filter((piece) => piece.id !== targetPiece.id)
			.filter((piece) => getPiecePriorityScore(piece, plan) <= 0)
			.find((piece) =>
				(piece.items || []).some((item) =>
					item.itemId === itemAction.itemId || itemAction.from.includes(item.itemId)
				)
			);

		if (holder) {
			return {
				name: `recover-item:${holder.definition.name}`,
				action: PlayerActions.sellPiecePlayerAction({ pieceId: holder.id }),
			};
		}
	}

	return null;
};

const createCraftItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BenchmarkAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (!targetPiece) {
			continue;
		}

		if (itemAction.from.length < 2) {
			continue;
		}

		const firstIndex = findInventoryIndex(inventory, itemAction.from[0]);
		if (firstIndex < 0) {
			continue;
		}

		const secondIndex = findInventoryIndex(
			inventory,
			itemAction.from[1],
			new Set([firstIndex])
		);
		if (secondIndex < 0) {
			continue;
		}

		const result = findRecipe(itemAction.from[0], itemAction.from[1]);
		if (result !== itemAction.itemId) {
			continue;
		}

		return {
			name: `craft:${itemAction.itemId}`,
			action: PlayerActions.craftItemInventoryPlayerAction({
				fromIndex: firstIndex,
				toIndex: secondIndex,
			}),
		};
	}

	return null;
};

const pieceHasItem = (piece: PieceModel, itemId: string) =>
	(piece.items || []).some((item) => item.itemId === itemId);

const createEquipPlannedItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BenchmarkAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);

		if (!targetPiece) {
			continue;
		}

		if (pieceHasItem(targetPiece, itemAction.itemId)) {
			continue;
		}

		if ((targetPiece.items || []).length >= MAX_ITEM_SLOTS) {
			continue;
		}

		const inventoryIndex = findInventoryIndex(inventory, itemAction.itemId);
		if (inventoryIndex < 0) {
			continue;
		}

		return {
			name: `equip:${itemAction.itemId}->${targetPiece.definition.name}`,
			action: PlayerActions.equipItemPlayerAction({
				pieceId: targetPiece.id,
				inventoryIndex,
			}),
		};
	}

	return null;
};

const createHoldComponentAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BenchmarkAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (targetPiece) {
			continue;
		}

		for (const componentId of itemAction.from) {
			const inventoryIndex = findInventoryIndex(inventory, componentId);
			if (inventoryIndex < 0) {
				continue;
			}

			const temporaryHolder = BoardSelectors.getAllPieces(state.bench)
				.concat(BoardSelectors.getAllPieces(state.board))
				.filter((piece) => getPiecePriorityScore(piece, plan) <= 0)
				.find((piece) => {
					const items = piece.items || [];
					if (items.length >= MAX_ITEM_SLOTS) {
						return false;
					}

					const hasBaseItem = items.some((item) => {
						const itemDefinition = getItemDefinition(item.itemId);
						return itemDefinition?.tier === 1;
					});

					return !hasBaseItem;
				});

			if (!temporaryHolder) {
				continue;
			}

			return {
				name: `hold:${componentId}->${temporaryHolder.definition.name}`,
				action: PlayerActions.equipItemPlayerAction({
					pieceId: temporaryHolder.id,
					inventoryIndex,
				}),
			};
		}
	}

	return null;
};

const createBuyXpAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
): BenchmarkAction | null => {
	const level = PlayerStateSelectors.getPlayerLevel(state);
	const money = PlayerStateSelectors.getPlayerMoney(state);
	const targetLevel = plan.rollStrategy.targetLevel;
	const slowRollAt = plan.rollStrategy.slowRollAt;

	if (targetLevel && level < targetLevel) {
		const reserve = slowRollAt && level < slowRollAt ? 10 : 20;
		if (money - settings.buyXpCost >= reserve) {
			return {
				name: "buy-xp",
				action: PlayerActions.buyXpPlayerAction(),
			};
		}
	}

	return null;
};

const createRerollAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
): BenchmarkAction | null => {
	const money = PlayerStateSelectors.getPlayerMoney(state);
	if (money < settings.rerollCost) {
		return null;
	}

	const level = PlayerStateSelectors.getPlayerLevel(state);
	const slowRollAt = plan.rollStrategy.slowRollAt;
	const targetLevel = plan.rollStrategy.targetLevel;

	const missingCoreUnit = plan.coreUnits.some((unit) => {
		const copies = countOwnedCopies(state, unit.definitionId);
		return copies < getDesiredCopiesForStars(unit.targetStars);
	});

	if (!missingCoreUnit) {
		return null;
	}

	if (slowRollAt && level === slowRollAt && money > 50 + settings.rerollCost) {
		return {
			name: "reroll-slow-roll",
			action: PlayerActions.rerollCardsPlayerAction(),
		};
	}

	if (targetLevel && level >= targetLevel && money > 20 + settings.rerollCost) {
		return {
			name: "reroll-target-level",
			action: PlayerActions.rerollCardsPlayerAction(),
		};
	}

	return null;
};

const chooseNextPlanAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
) =>
	createRecoverItemAction(state, plan) ||
	createCraftItemAction(state, plan) ||
	createEquipPlannedItemAction(state, plan) ||
	findBestShopBuyAction(state, plan, settings) ||
	findBestBoardPromotionAction(state, plan) ||
	createBuyXpAction(state, plan, settings) ||
	createRerollAction(state, plan, settings) ||
	createHoldComponentAction(state, plan);

const getBenchmarkRlAgent = () => {
	if (!benchmarkRlAgent) {
		benchmarkRlAgent = new PPOAgent();
	}

	return benchmarkRlAgent;
};

const getBenchmarkRlStateEncoder = () => {
	if (!benchmarkRlStateEncoder) {
		benchmarkRlStateEncoder = new StateEncoder();
	}

	return benchmarkRlStateEncoder;
};

const getBenchmarkRlActionDecoder = () => {
	if (!benchmarkRlActionDecoder) {
		benchmarkRlActionDecoder = new ActionDecoder();
	}

	return benchmarkRlActionDecoder;
};

const isRlBenchmarkMode = (mode: BenchmarkBotMode) =>
	mode === "hybrid" || mode === "rl";

let benchmarkRlLoadPromise: Promise<boolean> | null = null;

const ensureBenchmarkRlModelLoaded = (modelPath: string): Promise<boolean> => {
	if (benchmarkRlLoadPromise) {
		return benchmarkRlLoadPromise;
	}

	benchmarkRlLoadPromise = (async () => {
		try {
			await getBenchmarkRlAgent().loadModel(modelPath);
			console.log(
				`[rag-build-benchmark] RL bot loaded model from ${modelPath}`
			);
			return true;
		} catch (error: any) {
			console.warn(
				`[rag-build-benchmark] RL bot failed to load model from ${modelPath}: ${
					error?.message || "unknown error"
				}`
			);
			return false;
		}
	})();

	return benchmarkRlLoadPromise;
};

const createPlanMaintenanceAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
) =>
	createRecoverItemAction(state, plan) ||
	createCraftItemAction(state, plan) ||
	createEquipPlannedItemAction(state, plan) ||
	createHoldComponentAction(state, plan);

const getInventoryRecipeSignature = (items: string[]) => items.slice().sort().join("|");

const scoreBuyCardActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	action: PlayerAction
) => {
	const payload = (action as any).payload as { index?: number } | undefined;
	const index = payload?.index;
	const card = typeof index === "number" ? state.cardShop.cards[index] : null;

	if (!card) {
		return -100_000;
	}

	const priority = getPiecePriorityScore(card, plan);
	if (priority <= 0) {
		return priority * 300;
	}

	let score = priority * 200;
	const plannedUnit = plan.plannedUnitsByName.get(card.name);

	if (plannedUnit) {
		const currentCopies = countOwnedCopies(state, card.definitionId);
		const desiredCopies = getDesiredCopiesForStars(plannedUnit.targetStars);
		const missingCopies = desiredCopies - currentCopies;

		if (missingCopies <= 0) {
			score -= 45_000;
		} else {
			score += missingCopies * 5_000;
		}
	}

	return score;
};

const scoreSellPieceActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	action: PlayerAction
) => {
	const payload = (action as any).payload as { pieceId?: string } | undefined;
	const pieceId = payload?.pieceId;
	const piece =
		typeof pieceId === "string"
			? getAllPiecesForState(state).find((candidate) => candidate.id === pieceId) || null
			: null;

	if (!piece) {
		return -100_000;
	}

	const priority = getPiecePriorityScore(piece, plan);

	if (priority >= 180) {
		return -120_000;
	}

	if (priority > 0) {
		return -65_000;
	}

	return 0;
};

const scoreBuyXpActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
) => {
	const level = PlayerStateSelectors.getPlayerLevel(state);
	const money = PlayerStateSelectors.getPlayerMoney(state);
	const targetLevel = plan.rollStrategy.targetLevel;
	const slowRollAt = plan.rollStrategy.slowRollAt;

	if (!targetLevel) {
		return -10_000;
	}

	if (level >= targetLevel) {
		return -20_000;
	}

	const reserve = slowRollAt && level < slowRollAt ? 10 : 20;
	if (money - settings.buyXpCost < reserve) {
		return -25_000;
	}

	return 22_000 + (targetLevel - level) * 2_000;
};

const hasMissingCoreUnit = (state: PlayerState, plan: NormalizedBuildPlan) =>
	plan.coreUnits.some((unit) => {
		const copies = countOwnedCopies(state, unit.definitionId);
		return copies < getDesiredCopiesForStars(unit.targetStars);
	});

const scoreRerollActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings
) => {
	const money = PlayerStateSelectors.getPlayerMoney(state);
	const level = PlayerStateSelectors.getPlayerLevel(state);
	const targetLevel = plan.rollStrategy.targetLevel;
	const slowRollAt = plan.rollStrategy.slowRollAt;

	if (!hasMissingCoreUnit(state, plan)) {
		return -35_000;
	}

	if (slowRollAt && level === slowRollAt && money > 50 + settings.rerollCost) {
		return 20_000;
	}

	if (targetLevel && level >= targetLevel && money > 20 + settings.rerollCost) {
		return 15_000;
	}

	return -12_000;
};

const scoreCraftItemActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	action: PlayerAction
) => {
	const payload = (action as any).payload as
		| { fromIndex?: number; toIndex?: number }
		| undefined;
	const fromIndex = payload?.fromIndex;
	const toIndex = payload?.toIndex;
	const inventory = state.playerInfo.inventory || [];

	if (typeof fromIndex !== "number" || typeof toIndex !== "number") {
		return -50_000;
	}

	const first = inventory[fromIndex];
	const second = inventory[toIndex];
	if (!first || !second) {
		return -50_000;
	}

	const resultItemId = findRecipe(first, second);
	if (!resultItemId) {
		return -50_000;
	}

	const signature = getInventoryRecipeSignature([first, second]);
	const desiredRecipe = plan.itemPlan.some(
		(itemAction) =>
			itemAction.itemId === resultItemId &&
			getInventoryRecipeSignature(itemAction.from) === signature
	);

	if (desiredRecipe) {
		return 75_000;
	}

	const consumesPlannedComponent = plan.itemPlan.some((itemAction) =>
		itemAction.from.some((componentId) => componentId === first || componentId === second)
	);

	return consumesPlannedComponent ? -90_000 : -15_000;
};

const scoreEquipItemActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	action: PlayerAction
) => {
	const payload = (action as any).payload as
		| { pieceId?: string; inventoryIndex?: number }
		| undefined;
	const pieceId = payload?.pieceId;
	const inventoryIndex = payload?.inventoryIndex;
	const inventory = state.playerInfo.inventory || [];
	const itemId = typeof inventoryIndex === "number" ? inventory[inventoryIndex] : null;
	const piece =
		typeof pieceId === "string"
			? getAllPiecesForState(state).find((candidate) => candidate.id === pieceId) || null
			: null;

	if (!piece || !itemId) {
		return -40_000;
	}

	const matchingTarget = plan.itemPlan.find(
		(itemAction) =>
			itemAction.itemId === itemId &&
			itemAction.targetPiece === piece.definition.name
	);
	if (matchingTarget) {
		return 60_000;
	}

	const itemDefinition = getItemDefinition(itemId);
	const isBaseComponent = itemDefinition?.tier === 1;
	const componentNeededForPlan = plan.itemPlan.some((itemAction) =>
		itemAction.from.includes(itemId)
	);

	if (isBaseComponent && componentNeededForPlan) {
		if (getPiecePriorityScore(piece, plan) <= 0) {
			const hasBaseItem = (piece.items || []).some((item) => {
				const def = getItemDefinition(item.itemId);
				return def?.tier === 1;
			});
			if (hasBaseItem) {
				return -50_000;
			}
			return 5_000;
		}
		return -35_000;
	}

	if (plan.desiredUnitNames.has(piece.definition.name)) {
		return -15_000;
	}

	return 0;
};

const scoreBotActionForPlan = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings,
	action: PlayerAction
) => {
	switch (action.type) {
		case "buyCardPlayerAction":
			return scoreBuyCardActionForPlan(state, plan, action);
		case "sellPiecePlayerAction":
			return scoreSellPieceActionForPlan(state, plan, action);
		case "buyXpPlayerAction":
			return scoreBuyXpActionForPlan(state, plan, settings);
		case "rerollCardsPlayerAction":
			return scoreRerollActionForPlan(state, plan, settings);
		case "craftItemInventoryPlayerAction":
			return scoreCraftItemActionForPlan(state, plan, action);
		case "equipItemPlayerAction":
			return scoreEquipItemActionForPlan(state, plan, action);
		default:
			return 0;
	}
};

const selectGuidedBotAction = (
	state: PlayerState,
	personality: BenchmarkPersonality,
	settings: GamemodeSettings,
	plan: NormalizedBuildPlan | null
) => {
	const actions = getActions(state, personality as any, settings);

	if (actions.length === 0) {
		return null;
	}

	let bestAction: { action: BrainAction; playerAction: PlayerAction; score: number } | null =
		null;

	for (const action of actions) {
		const playerAction = action.action() as PlayerAction;
		let planScore = plan
			? scoreBotActionForPlan(state, plan, settings, playerAction)
			: 0;

		if (!plan && (playerAction.type === "craftItemInventoryPlayerAction" || playerAction.type === "equipItemPlayerAction")) {
			planScore = -100_000;
		}

		const score = action.value + planScore;

		if (!bestAction || score > bestAction.score) {
			bestAction = { action, playerAction, score };
		}
	}

	return bestAction;
};

const runPlanExecution = function* (plan: NormalizedBuildPlan, settings: GamemodeSettings) {
	let actionCount = 0;

	while (actionCount < 20) {
		const state: PlayerState = yield* select();

		if (state.roundInfo.phase !== GamePhase.PREPARING) {
			return;
		}

		const action = chooseNextPlanAction(state, plan, settings);
		if (!action) {
			return;
		}

		yield put(action.action);
		actionCount += 1;
		yield* delay(25);
	}
};

const runGuidedBotPreparation = function* (
	personality: BenchmarkPersonality,
	plan: NormalizedBuildPlan | null,
	settings: GamemodeSettings
) {
	let actionCount = 0;

	while (actionCount < 60) {
		const state: PlayerState = yield* select();

		if (state.roundInfo.phase !== GamePhase.PREPARING) {
			return;
		}

		const bestAction = selectGuidedBotAction(state, personality, settings, plan);
		if (!bestAction) {
			return;
		}

		yield put(bestAction.playerAction);
		actionCount += 1;
		yield* delay(BOT_ACTION_TIME_MS);
		yield* call(putBenchOnBoard);
	}
};

const runBenchmarkRlPositioning = function* (config: BenchmarkConfig) {
	const rlReady = yield* call(ensureBenchmarkRlModelLoaded, config.rlModelPath);
	if (!rlReady) {
		return false;
	}

	const deps = yield* getPlayerEntityDependencies();

	yield* delay(500);

	let currentState: PlayerState = yield* select();

	for (let attempt = 0; attempt < 5; attempt++) {
		if (currentState.playerInfo.opponentId) {
			break;
		}

		yield* delay(100);
		currentState = yield* select();
	}

	let enemyBoard: any = undefined;
	const opponentId = currentState.playerInfo.opponentId;
	if (opponentId && opponentId !== "creep") {
		const opponent = deps.gamemode.getPlayerById(opponentId);
		if (opponent) {
			enemyBoard = opponent.select((state: PlayerState) => state.board);
		}
	}

	const rlState = getBenchmarkRlStateEncoder().encode(
		currentState.board,
		enemyBoard
	);
	const { action } = getBenchmarkRlAgent().act(rlState);
	const decoder = getBenchmarkRlActionDecoder();
	const moves = decoder.decodeAction(action, currentState.board);

	for (const move of moves) {
		const piece = BoardSelectors.getPiece(currentState.board, move.pieceId);
		if (!piece) {
			continue;
		}

		const currentPosition = BoardSelectors.getPiecePosition(
			currentState.board,
			move.pieceId
		);
		if (!currentPosition) {
			continue;
		}

		yield put(
			PlayerActions.dropPiecePlayerAction({
				pieceId: move.pieceId,
				from: { type: "board", location: currentPosition },
				to: {
					type: "board",
					location: { x: move.targetX, y: move.targetY },
				},
			})
		);

		yield* delay(100);
	}

	if (action.payload.adjustment) {
		const adjustments = decoder.applyAdjustment(action, currentState.board);
		for (const adjustment of adjustments) {
			const currentPosition = BoardSelectors.getPiecePosition(
				currentState.board,
				adjustment.pieceId
			);
			if (!currentPosition) {
				continue;
			}

			yield put(
				PlayerActions.dropPiecePlayerAction({
					pieceId: adjustment.pieceId,
					from: { type: "board", location: currentPosition },
					to: {
						type: "board",
						location: { x: adjustment.targetX, y: adjustment.targetY },
					},
				})
			);

			yield* delay(100);
		}
	}

	yield put(PlayerActions.readyUpPlayerAction());

	return true;
};

const buildBenchmarkQuery = () =>
	[
		"Recommend the strongest realistic build for the current state.",
		"This plan will control an automated benchmark bot.",
		"Keep it conservative and executable from the current board, bench, shop, economy, and items.",
	].join(" ");

const requestBuildPlanWithRetry = async (
	config: BenchmarkConfig,
	context: BuildAdviceContext,
	round: number
) => {
	let attempts = 0;
	let rateLimitRetries = 0;
	const startedAt = Date.now();
	let lastError = "Unknown build advice failure";

	while (true) {
		attempts += 1;

		try {
			const response = await httpPostJson(
				`${config.ragServiceUrl}/build-advice`,
				{
					query: buildBenchmarkQuery(),
					context,
				},
				config.ragTimeoutMs
			);
			const body = response.body as BuildAdviceResponse;
			const plan = normalizeBuildPlan(body.plan);
			const answer =
				typeof body.answer === "string" ? body.answer : "Missing answer";
			const rateLimited =
				response.status === 429 || isRateLimitErrorText(answer);

			if (rateLimited) {
				lastError = answer;
				rateLimitRetries += 1;
				const backoffMs = Math.min(
					config.maxRateLimitBackoffMs,
					config.initialRateLimitBackoffMs * 2 ** (rateLimitRetries - 1)
				);
				await sleepReal(backoffMs);
				continue;
			}

			if (!response.ok) {
				lastError = `HTTP ${response.status}`;
				if (attempts < config.nonRateLimitRetries) {
					await sleepReal(1000 * attempts);
					continue;
				}

				return {
					call: {
						round,
						attempts,
						rateLimitRetries,
						durationMs: Date.now() - startedAt,
						success: false,
						planName: null,
						error: lastError,
					},
					plan: null,
				};
			}

			if (!plan) {
				lastError = answer;
				if (attempts < config.nonRateLimitRetries) {
					await sleepReal(1000 * attempts);
					continue;
				}

				return {
					call: {
						round,
						attempts,
						rateLimitRetries,
						durationMs: Date.now() - startedAt,
						success: false,
						planName: null,
						error: lastError,
					},
					plan: null,
				};
			}

			return {
				call: {
					round,
					attempts,
					rateLimitRetries,
					durationMs: Date.now() - startedAt,
					success: true,
					planName: plan.planName,
					error: null,
				},
				plan,
			};
		} catch (error: any) {
			lastError = error?.message || "Request failed";
			if (attempts < config.nonRateLimitRetries) {
				await sleepReal(1000 * attempts);
				continue;
			}

			return {
				call: {
					round,
					attempts,
					rateLimitRetries,
					durationMs: Date.now() - startedAt,
					success: false,
					planName: null,
					error: lastError,
				},
				plan: null,
			};
		}
	}
};

const ragBuildBenchmarkBotSaga = function* (
	personality: BenchmarkPersonality,
	config: BenchmarkConfig,
	benchmarkState: MutableBenchmarkState,
	getBuildAdviceContext: (playerId: string) => BuildAdviceContext | null
) {
	const playerId = yield* getContext<string>("id");

	yield takeLatest(GameEvents.gamePhaseStartedEvent, function* ({ payload }) {
		const state: PlayerState = yield* select();
		const round = payload.round ?? state.roundInfo.round;
		const alive = state.playerInfo.health > 0;

		if (payload.phase === GamePhase.PLAYING) {
			if (alive) {
				const boardCount = BoardSelectors.getAllPieces(state.board).length;
				const benchCount = BoardSelectors.getAllPieces(state.bench).length;
				console.log(`[${playerId}] HP: ${state.playerInfo.health} | Board: ${boardCount} | Bench: ${benchCount}`);

				yield put(PlayerEvents.clientFinishMatchEvent());
			}
			return;
		}

		if (payload.phase !== GamePhase.PREPARING) {
			return;
		}

		yield* delay(1000);

		if (BENCHMARK_BUILD_ROUNDS.has(round)) {
			const context = getBuildAdviceContext(playerId);
			if (context) {
				const { call: ragCall, plan } = yield* call(
					requestBuildPlanWithRetry,
					config,
					context,
					round
				);

				benchmarkState.ragCalls.push(ragCall);

				if (plan) {
					benchmarkState.currentPlan = plan;
					benchmarkState.plans.push({
						round,
						planName: plan.planName,
						coreUnits: plan.coreUnits.map((unit) => unit.name),
						transitionUnits: plan.transitionUnits.map((unit) => unit.name),
						shortTermSteps: plan.shortTermSteps,
					});
				}
			}
		}

		if (!alive) {
			return;
		}

		if (benchmarkState.currentPlan) {
			yield* call(runPlanExecution, benchmarkState.currentPlan, config.settings);
		}

		yield* call(
			runGuidedBotPreparation,
			personality,
			benchmarkState.currentPlan,
			config.settings
		);

		if (isRlBenchmarkMode(config.benchmarkBotMode)) {
			const positioned = yield* call(runBenchmarkRlPositioning, config);
			if (!positioned) {
				yield put(PlayerActions.readyUpPlayerAction());
			}
		} else {
			yield put(PlayerActions.readyUpPlayerAction());
		}
	});
};

const createBuildContextResolver = (
	entities: PlayerEntity[],
	gamemode: Gamemode
) => {
	return (playerId: string) => {
		const player = entities.find((entity) => entity.id === playerId);
		if (!player) {
			return null;
		}

		const playerState = player.select((state: PlayerState) => state);
		const allPlayerStates = entities.map((entity) =>
			entity.select((state: PlayerState) => state)
		);
		const roundInfo = gamemode.getRoundInfo();

		return createBuildAdviceContext({
			playerId,
			playerState,
			allPlayerStates,
			round: roundInfo.round,
			phase: roundInfo.phase,
		});
	};
};

const runSingleBenchmarkGame = async (
	gameIndex: number,
	config: BenchmarkConfig
): Promise<BenchmarkGameResult> => {
	const startedAt = Date.now();
	const gameId = `rag-build-benchmark-${gameIndex}`;
	const gamemode = new Gamemode(gameId, benchmarkLogger, config.settings);
	const entities: PlayerEntity[] = [];
	const benchmarkState: MutableBenchmarkState = {
		currentPlan: null,
		ragCalls: [],
		plans: [],
	};

	const getBuildAdviceContext = createBuildContextResolver(entities, gamemode);

	const benchmarkEntity = createPlayerEntityForBenchmark(
		gamemode,
		BENCHMARK_BOT_ID,
		BENCHMARK_BOT_NAME,
		config.settings
	);
	initialiseBenchmarkPlayer(benchmarkEntity, config.settings);
	benchmarkEntity.runSaga(
		ragBuildBenchmarkBotSaga,
		DEFAULT_BOT_PERSONALITY,
		config,
		benchmarkState,
		getBuildAdviceContext
	);
	entities.push(benchmarkEntity);

	OPPONENT_PERSONALITIES.forEach((personality, index) => {
		const entity = createPlayerEntityForBenchmark(
			gamemode,
			`benchmark-opponent-${gameIndex}-${index + 1}`,
			`[BOT] Opponent ${index + 1}`,
			config.settings
		);
		initialiseBenchmarkPlayer(entity, config.settings);
		entity.runSaga(botLogicSaga, personality as any);
		entities.push(entity);
	});

	let timeoutId: ReturnType<typeof ORIGINAL_SET_TIMEOUT> | null = null;

	const finishResult = await Promise.race([
		new Promise<never>((_, reject) => {
			timeoutId = ORIGINAL_SET_TIMEOUT(
				() =>
					reject(
						new Error(
							`Benchmark game ${gameIndex} timed out after ${config.gameTimeoutMs}ms`
						)
					),
				config.gameTimeoutMs
			);
		}),
		new Promise<{
			position: number;
			finishRound: number;
		}>((resolve) => {
			gamemode.onFinish(({ players }) => {
				const benchmarkPlayer = players.find(
					(player) => player.id === BENCHMARK_BOT_ID
				);
				resolve({
					position: benchmarkPlayer?.position || 8,
					finishRound: benchmarkPlayer?.finishRound || 0,
				});
			});

			gamemode.start(entities);
		}),
	]);

	if (timeoutId) {
		ORIGINAL_CLEAR_TIMEOUT(timeoutId);
	}

	return {
		gameIndex,
		durationMs: Date.now() - startedAt,
		rank: finishResult.position,
		finishRound: finishResult.finishRound,
		top4: finishResult.position <= 4,
		win: finishResult.position === 1,
		ragCalls: benchmarkState.ragCalls,
		plans: benchmarkState.plans,
	};
};

const summarizeResults = (
	results: BenchmarkGameResult[],
	outputPath: string,
	config: BenchmarkConfig
): BenchmarkSummary => {
	const completedGames = results.length;
	const top4Games = results.filter((result) => result.top4).length;
	const winGames = results.filter((result) => result.win).length;
	const totalRank = results.reduce((sum, result) => sum + result.rank, 0);
	const allRagCalls = results.flatMap((result) => result.ragCalls);

	return {
		totalGames: completedGames,
		completedGames,
		top4Rate: completedGames > 0 ? top4Games / completedGames : 0,
		winRate: completedGames > 0 ? winGames / completedGames : 0,
		averageRank: completedGames > 0 ? totalRank / completedGames : 0,
		benchmarkBotMode: config.benchmarkBotMode,
		expectedRagCalls: completedGames * BENCHMARK_BUILD_ROUNDS.size,
		totalRagCalls: allRagCalls.length,
		successfulRagCalls: allRagCalls.filter((call) => call.success).length,
		totalRateLimitRetries: allRagCalls.reduce(
			(sum, call) => sum + call.rateLimitRetries,
			0
		),
		outputPath,
		results,
	};
};

export const runRagBuildBenchmark = async () => {
	const config = getBenchmarkConfig();
	const restoreTimers = installScaledTimers(config.timerScale);
	const originalBotMode = process.env.BOT_MODE;
	const originalPreparingLength = GAME_PHASE_LENGTHS[GamePhase.PREPARING];

	process.env.BOT_MODE = "rule_based";
	GAME_PHASE_LENGTHS[GamePhase.PREPARING] = config.preparingTimeoutSeconds;

	try {
		const results: BenchmarkGameResult[] = [];

		console.log(
			`[rag-build-benchmark] mode=${config.benchmarkBotMode} timerScale=${config.timerScale} settings=default concurrency=${config.concurrency}`
		);

		let completedGamesCount = 0;
		const gameIndices = Array.from({ length: config.games }, (_, i) => i + 1);

		const workers = Array.from({ length: config.concurrency }, async () => {
			while (gameIndices.length > 0) {
				const gameIndex = gameIndices.shift();
				if (gameIndex === undefined) break;

				console.log(
					`[rag-build-benchmark] Starting game ${gameIndex}/${config.games}`
				);
				try {
					const result = await runSingleBenchmarkGame(gameIndex, config);
					results.push(result);
					completedGamesCount++;
					console.log(
						`[rag-build-benchmark] Finished game ${gameIndex}/${config.games} (Total: ${completedGamesCount}/${config.games}) rank=${result.rank} top4=${result.top4} ragCalls=${result.ragCalls.length}`
					);
				} catch (error) {
					console.error(`[rag-build-benchmark] Game ${gameIndex} failed:`, error);
				}
			}
		});

		await Promise.all(workers);

		const summary = summarizeResults(results, config.outputPath, config);
		await writeFile(summary.outputPath, JSON.stringify(summary, null, 2), "utf8");

		console.log(
			`[rag-build-benchmark] Completed ${summary.completedGames} games | ragCalls=${summary.totalRagCalls}/${summary.expectedRagCalls} | top4=${(
				summary.top4Rate * 100
			).toFixed(1)}% | win=${(summary.winRate * 100).toFixed(1)}% | avgRank=${summary.averageRank.toFixed(2)}`
		);

		return summary;
	} finally {
		if (originalBotMode === undefined) {
			delete process.env.BOT_MODE;
		} else {
			process.env.BOT_MODE = originalBotMode;
		}

		GAME_PHASE_LENGTHS[GamePhase.PREPARING] = originalPreparingLength;
		restoreTimers();
	}
};
