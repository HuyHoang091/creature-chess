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
	getItemDefinition,
} from "@creature-chess/models";

import { getCooldownForSpeed } from "../../../utils/getCooldownForSpeed";
import { getHitDamage } from "../../../utils/getHitDamage";
import { getNewAttackerFacingAway } from "../../../utils/getNewAttackerFacingAway";
import { getStats } from "../../../utils/getStats";
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

	const hasPassive = (p: PieceModel, passiveId: string) => {
		return p.items?.some((item) => {
			const def = getItemDefinition(item.itemId);
			return def?.passive?.id === passiveId;
		});
	};

	let damage = getHitDamage(attacker, target);
	let isDodged = false;

	// DODGE
	if (hasPassive(target, "dodge") && Math.random() < 0.15) {
		damage = 0;
		isDodged = true;
	}

	const newDefenderHealth = Math.max(target.currentHealth - damage, 0);

	// THORNMAIL
	let reflectedDamage = 0;
	if (!isDodged && hasPassive(target, "thornmail")) {
		reflectedDamage = Math.floor(damage * 0.2); // 20%
	}

	// LIFESTEAL
	let healAmount = 0;
	if (!isDodged && hasPassive(attacker, "lifesteal")) {
		healAmount = Math.floor(damage * 0.2);
	}

	const newAttackerHealth = Math.max(
		Math.min(attacker.currentHealth - reflectedDamage + healAmount, attacker.maxHealth),
		0
	);

	const MANA_ON_ATTACK = 10;
	// Người chơi bị đánh cũng sẽ nhận lượng Mana bằng với lượng sát thương (cap tại MaxMana)
	const MANA_ON_DEFEND = damage;

	const newAttackerMana = Math.min(attacker.currentMana + MANA_ON_ATTACK, attacker.maxMana || 100);
	const newDefenderMana = newDefenderHealth > 0 ? Math.min(target.currentMana + MANA_ON_DEFEND, target.maxMana || 100) : target.currentMana;

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
		getCooldownForSpeed(attackerStats.speed);
	const canMoveAtTurn =
		currentTurn + MOVE_TURN_DURATION + getCooldownForSpeed(attackerStats.speed);

	combatStore.updatePiecePartial(attacker.id, {
		canAttackAtTurn,
		canMoveAtTurn,
	});

	const canBeAttackedAtTurn = currentTurn + MOVE_TURN_DURATION + 2;

	combatStore.updatePiecePartial(target.id, { canBeAttackedAtTurn });

	const attackerVisualEffects = [];
	const defenderVisualEffects = [];

	if (isDodged) {
		defenderVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: "Dodge!",
			color: "#ffffff"
		});
	}

	if (reflectedDamage > 0) {
		defenderVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: "Thorns",
			color: "#ffaa00"
		});
		attackerVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: `-${reflectedDamage}`,
			color: "#ff0000"
		});
	}

	if (healAmount > 0) {
		attackerVisualEffects.push({
			id: Math.random().toString(36).substring(7),
			text: `+${healAmount}`,
			color: "#00ff00"
		});
	}

	const newAttacker: PieceModel = {
		...attacker,
		currentHealth: newAttackerHealth,
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
		visualEffects: attackerVisualEffects,
	};

	const defender: PieceModel = {
		...target,
		currentHealth: newDefenderHealth,
		currentMana: newDefenderMana,
		hit: {
			direction: getRelativeDirection(targetPosition, attackerPosition),
			damage,
		},
		lastBattleStats: {
			...target.lastBattleStats!,
			damageTaken: target.lastBattleStats!.damageTaken + damage,
		},
		visualEffects: defenderVisualEffects,
	};

	return boardSlice.boardReducer(
		board,
		boardSlice.commands.updateBoardPiecesCommand([newAttacker, defender])
	);
}
