import {
	BoardSelectors,
	BoardSlice,
	BoardState,
	PiecePosition,
} from "@shoki/board";

import {
	getDistance,
	getRelativeDirection,
	PieceModel,
} from "@creature-chess/models";

import { getCooldownForSpeed } from "../../../utils/getCooldownForSpeed";
import { getHitDamage } from "../../../utils/getHitDamage";
import { getNewAttackerFacingAway } from "../../../utils/getNewAttackerFacingAway";
import { getStats } from "../../../utils/getStats";
import {
	applyFrozenHeartSlow,
	getEffectiveSpeed,
	getPieceStatusEffects,
	hasPassive,
	resolveRevive,
} from "../../../utils/itemPassives";
import { inAttackRange } from "../../../utils/inAttackRange";
import { Stores } from "../../types";
import { HitAction } from "./types";

const ATTACK_TURN_DURATION = 2;
const MOVE_TURN_DURATION = 2;

export function doHit(
	currentTurn: number,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	action: HitAction,
	{ combatStore }: Stores
): BoardState<PieceModel> {
	const target = BoardSelectors.getPiece(board, action.payload.targetId);
	const targetPosition = BoardSelectors.getPiecePosition(
		board,
		action.payload.targetId
	);

	if (!target || !targetPosition) {
		return board;
	}

	const attackerStats = getStats(attacker);

	const inRange = inAttackRange(
		attackerPosition,
		targetPosition,
		attackerStats.attackType
	);

	if (!inRange) {
		return board;
	}

	let damage = getHitDamage(attacker, target);
	let isDodged = false;

	if (hasPassive(target, "dodge") && Math.random() < 0.15) {
		damage = 0;
		isDodged = true;
	}

	let slowEffect;
	if (!isDodged && hasPassive(target, "slow_nearby")) {
		slowEffect = applyFrozenHeartSlow(attacker, currentTurn, { combatStore });
	}

	const defenderResult = resolveRevive(
		currentTurn,
		target,
		Math.max(target.currentHealth - damage, 0),
		{ combatStore }
	);

	let reflectedDamage = 0;
	if (!isDodged && hasPassive(target, "thornmail")) {
		reflectedDamage = Math.floor(damage * 0.2);
	}

	let healAmount = 0;
	if (!isDodged && hasPassive(attacker, "lifesteal")) {
		healAmount = Math.floor(damage * 0.2);
	}

	const attackerResult = resolveRevive(
		currentTurn,
		attacker,
		Math.max(
			Math.min(
				attacker.currentHealth - reflectedDamage + healAmount,
				attacker.maxHealth
			),
			0
		),
		{ combatStore }
	);

	const manaOnAttack = 10;
	const manaOnDefend = damage;

	const newAttackerMana =
		attackerResult.health > 0
			? Math.min(attacker.currentMana + manaOnAttack, attacker.maxMana || 100)
			: attackerResult.mana;
	const newDefenderMana = defenderResult.revived
		? defenderResult.mana
		: defenderResult.health > 0
			? Math.min(target.currentMana + manaOnDefend, target.maxMana || 100)
			: target.currentMana;

	const attackerDirection = getRelativeDirection(
		attackerPosition,
		targetPosition
	);
	const attackerDistance = getDistance(attackerPosition, targetPosition);
	const attackerFacingAway = getNewAttackerFacingAway(
		attacker.facingAway,
		attackerDirection
	);

	const canAttackAtTurn =
		currentTurn +
		ATTACK_TURN_DURATION +
		getCooldownForSpeed(getEffectiveSpeed(attacker, currentTurn, { combatStore }));
	const canMoveAtTurn =
		currentTurn +
		MOVE_TURN_DURATION +
		getCooldownForSpeed(getEffectiveSpeed(attacker, currentTurn, { combatStore }));

	combatStore.updatePiecePartial(attacker.id, {
		canAttackAtTurn,
		canMoveAtTurn,
	});

	const canBeAttackedAtTurn = currentTurn + MOVE_TURN_DURATION + 2;
	combatStore.updatePiecePartial(target.id, { canBeAttackedAtTurn });

	const attackerVisualEffects = [...(attacker.visualEffects ?? [])];
	const defenderVisualEffects = [...(target.visualEffects ?? [])];

	if (isDodged) {
		defenderVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: "Dodge!",
			color: "#ffffff",
			variant: "label",
			tone: "neutral",
			sourcePieceId: attacker.id,
		});
	}

	if (!isDodged && damage > 0) {
		defenderVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: `-${damage}`,
			color: "#ffffff",
			variant: "damage",
			sourcePieceId: attacker.id,
		});
	}

	if (reflectedDamage > 0) {
		defenderVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: "Thorns",
			color: "#ffaa00",
			variant: "label",
			tone: "warning",
			sourcePieceId: attacker.id,
		});
		attackerVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: `-${reflectedDamage}`,
			color: "#ff0000",
			variant: "damage",
			sourcePieceId: target.id,
		});
	}

	if (healAmount > 0) {
		attackerVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: `+${healAmount}`,
			color: "#00ff00",
			variant: "heal",
			sourcePieceId: target.id,
		});
	}

	if (slowEffect) {
		attackerVisualEffects.push(slowEffect);
	}

	const newAttacker: PieceModel = {
		...attacker,
		currentHealth: attackerResult.health,
		currentMana: newAttackerMana,
		attacking: {
			attackType: attackerStats.attackType,
			distance: attackerDistance,
			direction: attackerDirection,
			damage,
		},
		facingAway: attackerFacingAway,
		lastBattleStats: {
			...attacker.lastBattleStats!,
			damageDealt: attacker.lastBattleStats!.damageDealt + damage,
		},
		statusEffects: getPieceStatusEffects(attacker, currentTurn, {
			combatStore,
		}),
		visualEffects: attackerVisualEffects,
	};

	const defender: PieceModel = {
		...target,
		currentHealth: defenderResult.health,
		currentMana: newDefenderMana,
		hit: {
			direction: getRelativeDirection(targetPosition, attackerPosition),
			damage,
		},
		lastBattleStats: {
			...target.lastBattleStats!,
			damageTaken: target.lastBattleStats!.damageTaken + damage,
		},
		statusEffects: getPieceStatusEffects(target, currentTurn, {
			combatStore,
		}),
		visualEffects: defenderVisualEffects,
	};

	return boardSlice.boardReducer(
		board,
		boardSlice.commands.updateBoardPiecesCommand([newAttacker, defender])
	);
}
