import { BoardSelectors } from "@shoki/board";

import {
	PlayerActions,
	PlayerAction,
	PlayerState,
	PlayerStateSelectors,
	getAllDefinitions,
} from "@creature-chess/gamemode";
import { getPiecesForStage } from "@creature-chess/gamemode/src/game/evolution";
import { Card, PieceModel, findRecipe, getItemDefinition } from "@creature-chess/models";
import { PIECES_TO_EVOLVE } from "@creature-chess/models/config";
import { GamemodeSettings } from "@creature-chess/models/settings";

import { getActions } from "@cc-server/bot/src/actions";
import { BrainAction } from "@cc-server/bot/src/brain";
import { PREFERRED_LOCATIONS } from "@cc-server/bot/src/preferredLocations";
import { BotPersonality } from "@cc-server/data";

import { BuildAdvicePlan } from "../build-advisor/types";

export type BuildAutoPlayLevel = 1 | 2 | 3 | 4;
export type BuildAutoPlayPreset = "balanced" | "stabilize" | "economy";

export type BuildAutoPlayPresetSettings = {
	preset: BuildAutoPlayPreset;
	label: string;
	personality: BotPersonality;
};

export const BUILD_AUTO_PLAY_PRESETS: Record<
	BuildAutoPlayPreset,
	BuildAutoPlayPresetSettings
> = {
	balanced: {
		preset: "balanced",
		label: "Cân bằng",
		personality: { ambition: 100, composure: 100, vision: 100 },
	},
	stabilize: {
		preset: "stabilize",
		label: "Giữ máu",
		personality: { ambition: 120, composure: 40, vision: 80 },
	},
	economy: {
		preset: "economy",
		label: "Tích tiền",
		personality: { ambition: 60, composure: 160, vision: 120 },
	},
};

export const normalizeBuildAutoPlayPreset = (
	preset: unknown
): BuildAutoPlayPreset | null =>
	preset === "balanced" || preset === "stabilize" || preset === "economy"
		? preset
		: null;

export const getBuildAutoPlayPresetSettings = (
	preset: BuildAutoPlayPreset = "balanced"
) => BUILD_AUTO_PLAY_PRESETS[preset];

export type PlannedUnit = {
	name: string;
	definitionId: number;
	cost: number;
	targetStars: number;
	priority: "core" | "support" | "transition" | "flex";
	reason: string;
};

export type PlannedItemAction = {
	itemId: string;
	targetPiece: string;
	action: "craft_now" | "equip_now" | "hold" | "temporary_holder";
	reason: string;
	from: string[];
};

export type NormalizedBuildPlan = {
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

export type BuildAutoPlayAction = {
	name: string;
	message: string;
	action: PlayerAction;
};

const definitionByName = new Map(
	getAllDefinitions().map((definition) => [
		definition.name.toLowerCase(),
		definition,
	])
);

const canonicalUnitName = (name: unknown) => {
	if (typeof name !== "string") {
		return null;
	}
	const definition = definitionByName.get(name.trim().toLowerCase());
	return definition?.name || null;
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
		targetStars: Number(source.targetStars) === 3 ? 3 : 2,
		priority,
		reason: typeof source.reason === "string" ? source.reason.trim() : "",
	};
};

const normalizeItemPlan = (itemPlan: unknown): PlannedItemAction[] => {
	if (!Array.isArray(itemPlan)) {
		return [];
	}

	return itemPlan
		.map((entry): PlannedItemAction | null => {
			if (!entry || typeof entry !== "object") {
				return null;
			}
			const source = entry as Record<string, unknown>;
			const targetPiece = canonicalUnitName(source.targetPiece);
			const itemId =
				typeof source.itemId === "string" && getItemDefinition(source.itemId)
					? source.itemId
					: null;
			if (!targetPiece || !itemId) {
				return null;
			}

			const action =
				source.action === "craft_now" ||
				source.action === "equip_now" ||
				source.action === "hold" ||
				source.action === "temporary_holder"
					? source.action
					: "hold";

			return {
				itemId,
				targetPiece,
				action,
				reason: typeof source.reason === "string" ? source.reason.trim() : "",
				from: Array.isArray(source.from)
					? source.from.filter(
							(item): item is string =>
								typeof item === "string" && !!getItemDefinition(item)
						)
					: [],
			};
		})
		.filter((entry): entry is PlannedItemAction => entry !== null);
};

export const normalizeBuildAutoPlayPlan = (
	plan: BuildAdvicePlan | null | undefined
): NormalizedBuildPlan | null => {
	if (!plan || typeof plan !== "object") {
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
	const allUnits = [...coreUnits, ...transitionUnits];
	if (allUnits.length === 0) {
		return null;
	}

	const avoidUnits = Array.isArray(plan.avoidUnits)
		? plan.avoidUnits
				.map(canonicalUnitName)
				.filter((name): name is string => name !== null)
		: [];

	return {
		planName:
			typeof plan.planName === "string" && plan.planName.trim()
				? plan.planName.trim()
				: "RAG Build",
		primaryTraits: Array.isArray(plan.primaryTraits)
			? plan.primaryTraits.filter(
					(trait): trait is string => typeof trait === "string"
				)
			: [],
		secondaryTraits: Array.isArray(plan.secondaryTraits)
			? plan.secondaryTraits.filter(
					(trait): trait is string => typeof trait === "string"
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
					(step): step is string => typeof step === "string"
				)
			: [],
		desiredUnitNames: new Set(allUnits.map((unit) => unit.name)),
		coreUnitNames: new Set(coreUnits.map((unit) => unit.name)),
		transitionUnitNames: new Set(transitionUnits.map((unit) => unit.name)),
		avoidUnitNames: new Set(avoidUnits),
		plannedUnitsByName: new Map(allUnits.map((unit) => [unit.name, unit])),
	};
};

const getAllPieces = (state: PlayerState) => [
	...BoardSelectors.getAllPieces(state.board),
	...BoardSelectors.getAllPieces(state.bench),
];

const countOwnedCopies = (state: PlayerState, definitionId: number) =>
	getAllPieces(state)
		.filter((piece) => piece.definitionId === definitionId)
		.reduce(
			(total, piece) =>
				total + getPiecesForStage(piece.stage, PIECES_TO_EVOLVE),
			0
		);

const getDesiredCopies = (stars: number) =>
	getPiecesForStage(stars - 1, PIECES_TO_EVOLVE);

const getUnitName = (pieceOrCard: PieceModel | Card) =>
	"name" in pieceOrCard ? pieceOrCard.name : pieceOrCard.definition.name;

export const getPiecePriorityScore = (
	pieceOrCard: PieceModel | Card,
	plan: NormalizedBuildPlan,
	personality: BotPersonality = BUILD_AUTO_PLAY_PRESETS.balanced.personality
) => {
	const name = getUnitName(pieceOrCard);
	let score = 0;
	if (plan.coreUnitNames.has(name)) {
		score = 300;
	} else if (plan.transitionUnitNames.has(name)) {
		score = 180;
	} else if (plan.avoidUnitNames.has(name)) {
		score = -200;
	} else if (
		pieceOrCard.traits.some((trait) => plan.primaryTraits.includes(trait))
	) {
		score = 40;
	}

	if (score <= 0) {
		return score;
	}

	return Math.round(score * (0.5 + personality.vision / 200));
};

export const canSafelySellPiece = (
	state: PlayerState,
	piece: PieceModel,
	plan: NormalizedBuildPlan
) => {
	if (plan.coreUnitNames.has(piece.definition.name)) {
		return false;
	}
	if (piece.stage >= 1 || (piece.items || []).length > 0) {
		return false;
	}
	if (getPiecePriorityScore(piece, plan) > 0) {
		return false;
	}

	const onBoard = !!BoardSelectors.getPiecePosition(state.board, piece.id);
	if (!onBoard) {
		return true;
	}

	const boardCount = BoardSelectors.getAllPieces(state.board).length;
	const replacement = BoardSelectors.getAllPieces(state.bench).some(
		(candidate) =>
			getPiecePriorityScore(candidate, plan) >
			getPiecePriorityScore(piece, plan)
	);
	return (
		boardCount - 1 >= PlayerStateSelectors.getPlayerLevel(state) || replacement
	);
};

export const pickSafeSellCandidate = (
	state: PlayerState,
	plan: NormalizedBuildPlan
) =>
	[
		...BoardSelectors.getAllPieces(state.bench).map((piece) => ({
			piece,
			onBench: true,
		})),
		...BoardSelectors.getAllPieces(state.board).map((piece) => ({
			piece,
			onBench: false,
		})),
	]
		.filter(({ piece }) => canSafelySellPiece(state, piece, plan))
		.sort(
			(a, b) =>
				Number(b.onBench) - Number(a.onBench) ||
				getPiecePriorityScore(a.piece, plan) -
					getPiecePriorityScore(b.piece, plan) ||
				a.piece.definition.cost - b.piece.definition.cost
		)[0]?.piece || null;

const getPreferredSort = (traits: string[]) => {
	const role = traits[1] as "valiant" | "arcane" | "cunning" | undefined;
	return role ? PREFERRED_LOCATIONS[role] : undefined;
};

const getPieceLocation = (state: PlayerState, pieceId: string) => {
	const board = BoardSelectors.getPiecePosition(state.board, pieceId);
	if (board) {
		return { type: "board" as const, location: board };
	}
	const bench = BoardSelectors.getPiecePosition(state.bench, pieceId);
	return bench
		? { type: "bench" as const, location: { x: bench.x, y: 0 } }
		: null;
};

const getRosterScore = (
	piece: PieceModel,
	plan: NormalizedBuildPlan,
	personality: BotPersonality
) => {
	const buildScore = getPiecePriorityScore(piece, plan, personality);
	const traitScore = piece.traits.filter(
		(trait) =>
			plan.primaryTraits.includes(trait) ||
			plan.secondaryTraits.includes(trait)
	).length;
	return (
		piece.stage * 1000 +
		Math.max(buildScore, 0) * 2 +
		traitScore * 40 +
		piece.definition.cost * 12
	);
};

const findRosterAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	level: BuildAutoPlayLevel,
	personality: BotPersonality
): BuildAutoPlayAction | null => {
	if (level < 2) {
		return null;
	}

	const board = BoardSelectors.getAllPieces(state.board);
	const candidate = BoardSelectors.getAllPieces(state.bench)
		.sort(
			(a, b) =>
				getRosterScore(b, plan, personality) -
				getRosterScore(a, plan, personality)
		)[0];
	if (!candidate) {
		return null;
	}

	const from = getPieceLocation(state, candidate.id);
	if (!from || from.type !== "bench") {
		return null;
	}

	if (board.length < PlayerStateSelectors.getPlayerLevel(state)) {
		const slot = BoardSelectors.getFirstEmptySlot(
			state.board,
			getPreferredSort(candidate.traits)
		);
		return slot
			? {
					name: `bench-to-board:${candidate.definition.name}`,
					message: `Đang triển khai ${candidate.definition.name} xuống sân...`,
					action: PlayerActions.dropPiecePlayerAction({
						pieceId: candidate.id,
						from,
						to: { type: "board", location: slot },
					}),
				}
			: null;
	}

	const candidateScore = getRosterScore(candidate, plan, personality);
	const replace = board
		.sort(
			(a, b) =>
				getRosterScore(a, plan, personality) -
				getRosterScore(b, plan, personality)
		)
		.find((piece) => candidateScore > getRosterScore(piece, plan, personality) + 25);
	if (!replace) {
		return null;
	}
	const to = getPieceLocation(state, replace.id);
	if (to?.type !== "board") {
		return null;
	}

	return {
		name: `swap-in:${candidate.definition.name}`,
		message: `Đang thay ${replace.definition.name} bằng ${candidate.definition.name} để giữ máu...`,
		action: PlayerActions.dropPiecePlayerAction({
			pieceId: candidate.id,
			from,
			to,
		}),
	};
};

const getPieceById = (state: PlayerState, pieceId: unknown) =>
	typeof pieceId === "string"
		? getAllPieces(state).find((piece) => piece.id === pieceId) || null
		: null;

const getActionItemPlanBonus = (
	action: PlayerAction,
	state: PlayerState,
	plan: NormalizedBuildPlan
) => {
	if (action.type === "equipItemPlayerAction") {
		const { pieceId, inventoryIndex } = action.payload as {
			pieceId?: string;
			inventoryIndex?: number;
		};
		const itemId =
			typeof inventoryIndex === "number"
				? state.playerInfo.inventory[inventoryIndex]
				: null;
		const piece = getPieceById(state, pieceId);
		return itemId &&
			piece &&
			plan.itemPlan.some(
				(item) =>
					item.itemId === itemId && item.targetPiece === piece.definition.name
			)
			? 300
			: 0;
	}

	if (action.type === "craftItemInventoryPlayerAction") {
		const { fromIndex, toIndex } = action.payload as {
			fromIndex?: number;
			toIndex?: number;
		};
		const from =
			typeof fromIndex === "number" ? state.playerInfo.inventory[fromIndex] : null;
		const to =
			typeof toIndex === "number" ? state.playerInfo.inventory[toIndex] : null;
		const result = from && to ? findRecipe(from, to) : null;
		return result && plan.itemPlan.some((item) => item.itemId === result)
			? 300
			: 0;
	}

	return 0;
};

const getActionBuildBias = (
	action: PlayerAction,
	state: PlayerState,
	plan: NormalizedBuildPlan,
	personality: BotPersonality
) => {
	if (action.type === "buyCardPlayerAction") {
		const index = (action.payload as { index?: number }).index;
		const card =
			typeof index === "number" ? state.cardShop.cards[index] : null;
		if (!card) {
			return 0;
		}
		const planned = plan.plannedUnitsByName.get(card.name);
		const targetReached =
			planned &&
			countOwnedCopies(state, card.definitionId) >=
				getDesiredCopies(planned.targetStars);
		return targetReached
			? 0
			: Math.max(getPiecePriorityScore(card, plan, personality), 0) * 20;
	}

	return getActionItemPlanBonus(action, state, plan);
};

const isActionAllowed = (
	action: PlayerAction,
	state: PlayerState,
	plan: NormalizedBuildPlan,
	level: BuildAutoPlayLevel
) => {
	switch (action.type) {
		case "buyCardPlayerAction":
			return level >= 2;
		case "buyXpPlayerAction":
		case "rerollCardsPlayerAction":
			return level >= 3;
		case "craftItemInventoryPlayerAction":
		case "equipItemPlayerAction":
			return level >= 4;
		case "sellPiecePlayerAction": {
			const piece = getPieceById(
				state,
				(action.payload as { pieceId?: string }).pieceId
			);
			return level >= 4 && !!piece && canSafelySellPiece(state, piece, plan);
		}
		default:
			return false;
	}
};

const getBotActionMessage = (
	action: BrainAction,
	playerAction: PlayerAction,
	state: PlayerState
) => {
	switch (playerAction.type) {
		case "sellPiecePlayerAction": {
			const piece = getPieceById(
				state,
				(playerAction.payload as { pieceId?: string }).pieceId
			);
			return piece
				? `Đang bán ${piece.definition.name} để dọn bench an toàn...`
				: "Đang dọn bench an toàn...";
		}
		case "buyCardPlayerAction": {
			const index = (playerAction.payload as { index?: number }).index;
			const card =
				typeof index === "number" ? state.cardShop.cards[index] : null;
			return card
				? `Đang mua ${card.name} theo ưu tiên đội hình...`
				: "Đang mua tướng theo ưu tiên đội hình...";
		}
		case "buyXpPlayerAction":
			return "Đang mua kinh nghiệm theo nhịp trận...";
		case "rerollCardsPlayerAction":
			return "Đang reroll cửa hàng theo nhịp trận...";
		case "craftItemInventoryPlayerAction":
			return "Đang ghép trang bị có thể dùng ngay...";
		case "equipItemPlayerAction": {
			const piece = getPieceById(
				state,
				(playerAction.payload as { pieceId?: string }).pieceId
			);
			return piece
				? `Đang gắn trang bị cho ${piece.definition.name}...`
				: "Đang gắn trang bị lên tướng phù hợp...";
		}
		default:
			return `Đang thực hiện hành động ${action.name}...`;
	}
};

const findBotLikeAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings,
	level: BuildAutoPlayLevel,
	personality: BotPersonality
): BuildAutoPlayAction | null => {
	const candidate = getActions(state, personality, settings)
		.map((botAction) => {
			const action = botAction.action() as PlayerAction;
			if (!isActionAllowed(action, state, plan, level)) {
				return null;
			}
			return {
				botAction,
				action,
				score:
					botAction.value +
					getActionBuildBias(action, state, plan, personality),
			};
		})
		.filter(
			(entry): entry is NonNullable<typeof entry> => entry !== null
		)
		.sort((a, b) => b.score - a.score)[0];

	if (!candidate) {
		return null;
	}

	return {
		name: `bot:${candidate.botAction.name}`,
		message: getBotActionMessage(
			candidate.botAction,
			candidate.action,
			state
		),
		action: candidate.action,
	};
};

const findProactiveCleanupAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings,
	level: BuildAutoPlayLevel
): BuildAutoPlayAction | null => {
	if (level < 4) {
		return null;
	}

	const maxPieces =
		PlayerStateSelectors.getPlayerLevel(state) + settings.benchSize;
	if (PlayerStateSelectors.getAllPieceCount(state) < maxPieces) {
		return null;
	}

	const sell = pickSafeSellCandidate(state, plan);
	return sell
		? {
				name: `sell-for-space:${sell.definition.name}`,
				message: `Đang bán ${sell.definition.name} để mở chỗ trống an toàn...`,
				action: PlayerActions.sellPiecePlayerAction({ pieceId: sell.id }),
			}
		: null;
};

export const chooseBuildAutoPlayAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	settings: GamemodeSettings,
	level: BuildAutoPlayLevel,
	preset: BuildAutoPlayPreset = "balanced"
) => {
	const { personality } = getBuildAutoPlayPresetSettings(preset);
	return (
		findProactiveCleanupAction(state, plan, settings, level) ||
		findBotLikeAction(state, plan, settings, level, personality) ||
		findRosterAction(state, plan, level, personality)
	);
};
