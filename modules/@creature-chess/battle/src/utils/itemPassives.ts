import { BoardState } from "@shoki/board";

import {
	getItemDefinition,
	PieceModel,
	PieceStatusEffect,
} from "@creature-chess/models";

import { PieceCombatState, PieceInfoStore } from "../state";
import { getStats } from "./getStats";

const FROZEN_HEART_DURATION_TURNS = 20;
const FROZEN_HEART_SPEED_PENALTY = 20;
const GUARDIAN_ANGEL_REVIVE_HEALTH_RATIO = 0.5;
const GUARDIAN_ANGEL_DYING_TURNS = 10;
const GUARDIAN_ANGEL_REVIVING_TURNS = 8;
const SLOW_STATUS_EFFECT: PieceStatusEffect = { type: "slow" };
const REVIVING_STATUS_EFFECT: PieceStatusEffect = { type: "reviving" };

type Stores = {
	combatStore: PieceInfoStore<PieceCombatState>;
};

function createVisualEffect(
	text: string,
	color: string,
	options: {
		variant?: "damage" | "skillDamage" | "heal" | "label";
		tone?: "neutral" | "ice" | "gold" | "warning";
		sourcePieceId?: string;
	} = {}
) {
	return {
		id: Math.random().toString(36).slice(2),
		text,
		color,
		...options,
	};
}

export function hasPassive(piece: PieceModel, passiveId: string) {
	return (
		piece.items?.some((item) => {
			const definition = getItemDefinition(item.itemId);
			return definition?.passive?.id === passiveId;
		}) ?? false
	);
}

function isPieceReviving({ combatStore }: Stores, pieceId: string) {
	return combatStore.getPiece(pieceId).state.type === "reviving";
}

export function hasPendingRevive(
	piece: PieceModel,
	{ combatStore }: Stores
) {
	const pieceState = combatStore.getPiece(piece.id).state;

	return (
		pieceState.type === "reviving" ||
		(pieceState.type === "dying" &&
			pieceState.payload.reviveAtTurn !== undefined &&
			pieceState.payload.reviveHealth !== undefined &&
			pieceState.payload.reviveMana !== undefined)
	);
}

export function isPieceSlowed(
	piece: PieceModel,
	currentTurn: number,
	{ combatStore }: Stores
) {
	return (combatStore.getPiece(piece.id).slowUntilTurn || 0) > currentTurn;
}

export function getEffectiveSpeed(
	piece: PieceModel,
	currentTurn: number,
	stores: Stores
) {
	const baseSpeed = getStats(piece).speed;
	const speedPenalty = isPieceSlowed(piece, currentTurn, stores)
		? FROZEN_HEART_SPEED_PENALTY
		: 0;
	return Math.max(1, baseSpeed - speedPenalty);
}

export function getPieceStatusEffects(
	piece: PieceModel,
	currentTurn: number,
	stores: Stores
): PieceStatusEffect[] {
	if (isPieceReviving(stores, piece.id)) {
		return [REVIVING_STATUS_EFFECT];
	}

	return isPieceSlowed(piece, currentTurn, stores) ? [SLOW_STATUS_EFFECT] : [];
}

export function syncPieceStatusEffects(
	board: BoardState<PieceModel>,
	currentTurn: number,
	stores: Stores
): BoardState<PieceModel> {
	let changed = false;

	const pieces = Object.fromEntries(
		Object.entries(board.pieces).map(([pieceId, piece]) => {
			const statusEffects = getPieceStatusEffects(piece, currentTurn, stores);
			const currentEffects = piece.statusEffects ?? [];
			const effectChanged =
				currentEffects.length !== statusEffects.length ||
				currentEffects.some(
					(effect, index) => effect.type !== statusEffects[index]?.type
				);

			if (!effectChanged) {
				return [pieceId, piece];
			}

			changed = true;
			return [pieceId, { ...piece, statusEffects }];
		})
	);

	return changed ? { ...board, pieces } : board;
}

export function applyFrozenHeartSlow(
	piece: PieceModel,
	currentTurn: number,
	{ combatStore }: Stores
) {
	combatStore.updatePiecePartial(piece.id, {
		slowUntilTurn: currentTurn + FROZEN_HEART_DURATION_TURNS,
	});

	return createVisualEffect("Slow", "#b7f3ff", {
		variant: "label",
		tone: "ice",
	});
}

export function resolveRevive(
	currentTurn: number,
	piece: PieceModel,
	resultingHealth: number,
	{ combatStore }: Stores
) {
	const combatState = combatStore.getPiece(piece.id);
	const canRevive =
		resultingHealth <= 0 &&
		hasPassive(piece, "revive") &&
		!combatState.reviveUsed;

	if (!canRevive) {
		return {
			health: resultingHealth,
			mana: piece.currentMana,
			revived: false,
		};
	}

	combatStore.updatePiecePartial(piece.id, {
		reviveUsed: true,
		state: {
			type: "dying",
			payload: {
				dieAtTurn: currentTurn + GUARDIAN_ANGEL_DYING_TURNS,
				reviveAtTurn:
					currentTurn +
					GUARDIAN_ANGEL_DYING_TURNS +
					GUARDIAN_ANGEL_REVIVING_TURNS,
				reviveHealth: Math.max(
					1,
					Math.ceil(piece.maxHealth * GUARDIAN_ANGEL_REVIVE_HEALTH_RATIO)
				),
				reviveMana: 0,
			},
		},
	});

	return {
		health: 0,
		mana: piece.currentMana,
		revived: false,
		reviveScheduled: true,
	};
}
