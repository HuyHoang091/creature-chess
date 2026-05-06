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
	SkillDefinition,
} from "@creature-chess/models";

import { getCooldownForSpeed } from "../../../utils/getCooldownForSpeed";
import { getStats } from "../../../utils/getStats";
import { Stores } from "../../types";
import { SkillAction } from "./types";

const SKILL_CAST_TURN_DURATION = 3;
const SKILL_DAMAGE_MULTIPLIER = 2;
const BOUNCE_MAX_TARGETS = 3;
const BOUNCE_RANGE = 2;
const BUFF_ATTACK_BONUS = 0.3; // +30% attack
const HEAL_PERCENT = 0.25; // Heal 25% maxHP

// ===================== HELPER FUNCTIONS =====================

function getAllEnemies(board: BoardState<PieceModel>, ownerId: string): PieceModel[] {
	return Object.values(board.pieces).filter(
		(p) => p.ownerId !== ownerId && p.currentHealth > 0
	);
}

function getAllAllies(board: BoardState<PieceModel>, ownerId: string): PieceModel[] {
	return Object.values(board.pieces).filter(
		(p) => p.ownerId === ownerId && p.currentHealth > 0
	);
}

function calcDamage(attackerAtk: number, defenderDef: number): number {
	return Math.ceil((attackerAtk / defenderDef) * 8 * SKILL_DAMAGE_MULTIPLIER);
}

function applyDamage(
	piece: PieceModel,
	damage: number,
	attackerPosition: PiecePosition,
	board: BoardState<PieceModel>
): PieceModel {
	const pPos = BoardSelectors.getPiecePosition(board, piece.id);
	const newHealth = Math.max(piece.currentHealth - damage, 0);
	const defenderMana =
		newHealth > 0
			? Math.min(piece.currentMana + damage, piece.maxMana || 100)
			: piece.currentMana;

	return {
		...piece,
		currentHealth: newHealth,
		currentMana: defenderMana,
		hit: {
			direction: pPos
				? getRelativeDirection(pPos, attackerPosition)
				: { x: 0, y: 0 },
			damage,
		},
		lastBattleStats: {
			...piece.lastBattleStats!,
			damageTaken: piece.lastBattleStats!.damageTaken + damage,
		},
	};
}

// ===================== SKILL TYPE HANDLERS =====================

/** Sát thương đơn mục tiêu — Fatal Thrust style */
function doSingleDamage(
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string
): { affected: PieceModel[]; totalDamage: number } {
	const target = BoardSelectors.getPiece(board, targetId);
	if (!target || target.currentHealth <= 0) return { affected: [], totalDamage: 0 };

	const atkStats = getStats(attacker);
	const defStats = getStats(target);
	const damage = calcDamage(atkStats.attack, defStats.defense) * 2; // Single = extra strong
	const updated = applyDamage(target, damage, attackerPosition, board);

	return { affected: [updated], totalDamage: damage };
}

/** Sát thương vùng AoE — Flame Burst / Earthquake */
function doAoeDamage(
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string
): { affected: PieceModel[]; totalDamage: number } {
	const targetPosition = BoardSelectors.getPiecePosition(board, targetId);
	if (!targetPosition) return { affected: [], totalDamage: 0 };

	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;

	getAllEnemies(board, attacker.ownerId).forEach((enemy) => {
		const ePos = BoardSelectors.getPiecePosition(board, enemy.id);
		if (ePos && getDistance(targetPosition, ePos) <= 1) {
			const defStats = getStats(enemy);
			const damage = calcDamage(atkStats.attack, defStats.defense);
			affected.push(applyDamage(enemy, damage, attackerPosition, board));
			totalDamage += damage;
		}
	});

	return { affected, totalDamage };
}

/** Sát thương bật nảy — Chain Lightning */
function doBounceDamage(
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string
): { affected: PieceModel[]; totalDamage: number } {
	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;
	const hitIds = new Set<string>();

	let currentTargetId = targetId;
	for (let bounce = 0; bounce < BOUNCE_MAX_TARGETS; bounce++) {
		const target = BoardSelectors.getPiece(board, currentTargetId);
		const tPos = BoardSelectors.getPiecePosition(board, currentTargetId);
		if (!target || !tPos || target.currentHealth <= 0) break;

		const defStats = getStats(target);
		const damageDecay = 1 - bounce * 0.2; // 100% → 80% → 60%
		const damage = Math.ceil(calcDamage(atkStats.attack, defStats.defense) * damageDecay);
		affected.push(applyDamage(target, damage, attackerPosition, board));
		totalDamage += damage;
		hitIds.add(currentTargetId);

		// Tìm con quân gần nhất chưa bị đánh
		let nearest: { id: string; dist: number } | null = null;
		getAllEnemies(board, attacker.ownerId).forEach((enemy) => {
			if (hitIds.has(enemy.id)) return;
			const ePos = BoardSelectors.getPiecePosition(board, enemy.id);
			if (!ePos) return;
			const dist = getDistance(tPos, ePos);
			if (dist <= BOUNCE_RANGE && (!nearest || dist < nearest.dist)) {
				nearest = { id: enemy.id, dist };
			}
		});
		if (!nearest) break;
		currentTargetId = (nearest as { id: string; dist: number }).id;
	}

	return { affected, totalDamage };
}

/** Sát thương xuyên thẳng — Laser Beam */
function doLineDamage(
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string
): { affected: PieceModel[]; totalDamage: number } {
	const targetPosition = BoardSelectors.getPiecePosition(board, targetId);
	if (!targetPosition) return { affected: [], totalDamage: 0 };

	// Tính hướng đi từ attacker → target
	const dx = targetPosition.x - attackerPosition.x;
	const dy = targetPosition.y - attackerPosition.y;
	const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
	const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;

	// Quét tối đa 7 ô theo hướng
	for (let step = 1; step <= 7; step++) {
		const checkX = attackerPosition.x + dirX * step;
		const checkY = attackerPosition.y + dirY * step;
		if (checkX < 0 || checkX >= board.size.width || checkY < 0 || checkY >= board.size.height) break;

		getAllEnemies(board, attacker.ownerId).forEach((enemy) => {
			const ePos = BoardSelectors.getPiecePosition(board, enemy.id);
			if (ePos && ePos.x === checkX && ePos.y === checkY) {
				const defStats = getStats(enemy);
				const damage = calcDamage(atkStats.attack, defStats.defense);
				affected.push(applyDamage(enemy, damage, attackerPosition, board));
				totalDamage += damage;
			}
		});
	}

	return { affected, totalDamage };
}

/** Buff bản thân — Rage Mode */
function doBuffSingle(
	attacker: PieceModel
): { affected: PieceModel[] } {
	// Tăng 30% attack cho bản thân (thông qua tạm thời tăng HP vì model không có buff field)
	// Workaround: Hồi 25% maxHP cho bản thân như một "shield"
	const healAmount = Math.ceil(attacker.maxHealth * HEAL_PERCENT);
	const newHealth = Math.min(attacker.currentHealth + healAmount, attacker.maxHealth);
	return {
		affected: [{
			...attacker,
			currentHealth: newHealth,
			currentMana: 0,
		}],
	};
}

/** Hồi máu đơn mục tiêu / bản thân — Mend */
function doHealSingle(
	board: BoardState<PieceModel>,
	attacker: PieceModel
): { affected: PieceModel[] } {
	// Tìm đồng đội (hoặc bản thân) có HP thấp nhất
	const allies = getAllAllies(board, attacker.ownerId);
	let weakest = attacker;
	let lowestPercent = attacker.currentHealth / attacker.maxHealth;
	allies.forEach((ally) => {
		const pct = ally.currentHealth / ally.maxHealth;
		if (pct < lowestPercent) {
			weakest = ally;
			lowestPercent = pct;
		}
	});

	const healAmount = Math.ceil(weakest.maxHealth * 0.35);
	const newHealth = Math.min(weakest.currentHealth + healAmount, weakest.maxHealth);

	return {
		affected: [{
			...weakest,
			currentHealth: newHealth,
		}],
	};
}

/** Hồi máu AoE — Nature Blessing */
function doHealAoe(
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition
): { affected: PieceModel[] } {
	const allies = getAllAllies(board, attacker.ownerId);
	const affected: PieceModel[] = [];

	allies.forEach((ally) => {
		const aPos = BoardSelectors.getPiecePosition(board, ally.id);
		if (aPos && getDistance(attackerPosition, aPos) <= 2) {
			const healAmount = Math.ceil(ally.maxHealth * 0.2);
			const newHealth = Math.min(ally.currentHealth + healAmount, ally.maxHealth);
			affected.push({
				...ally,
				currentHealth: newHealth,
			});
		}
	});

	return { affected };
}

// ===================== MAIN SKILL HANDLER =====================

export function doSkill(
	currentTurn: number,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	action: SkillAction,
	{ combatStore }: Stores
): BoardState<PieceModel> {
	const stats = getStats(attacker);
	const skill: SkillDefinition | undefined = stats.skill;

	// Fallback nếu không có skill definition → dùng AoE damage mặc định
	const skillType = skill?.type ?? "damage";
	const skillTarget = skill?.target ?? "aoe";
	const skillName = skill?.name ?? "Explosion";

	let affectedPieces: PieceModel[] = [];
	let totalDamage = 0;

	// ========== DAMAGE skills ==========
	if (skillType === "damage") {
		switch (skillTarget) {
			case "single": {
				const result = doSingleDamage(board, attacker, attackerPosition, action.payload.targetId);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				break;
			}
			case "aoe": {
				const result = doAoeDamage(board, attacker, attackerPosition, action.payload.targetId);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				break;
			}
			case "bounce": {
				const result = doBounceDamage(board, attacker, attackerPosition, action.payload.targetId);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				break;
			}
			case "line": {
				const result = doLineDamage(board, attacker, attackerPosition, action.payload.targetId);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				break;
			}
		}
	}
	// ========== BUFF skills ==========
	else if (skillType === "buff") {
		const result = doBuffSingle(attacker);
		affectedPieces = result.affected;
	}
	// ========== SUPPORT (heal) skills ==========
	else if (skillType === "support") {
		if (skillTarget === "aoe") {
			const result = doHealAoe(board, attacker, attackerPosition);
			affectedPieces = result.affected;
		} else {
			const result = doHealSingle(board, attacker);
			affectedPieces = result.affected;
		}
	}

	// Cooldown sau khi tung chiêu
	const attackerStats = getStats(attacker);
	const canAttackAtTurn =
		currentTurn + SKILL_CAST_TURN_DURATION + getCooldownForSpeed(attackerStats.speed);
	const canMoveAtTurn =
		currentTurn + SKILL_CAST_TURN_DURATION + getCooldownForSpeed(attackerStats.speed);

	combatStore.updatePiecePartial(attacker.id, {
		canAttackAtTurn,
		canMoveAtTurn,
	});

	affectedPieces.forEach((t) => {
		if (t.id !== attacker.id) {
			combatStore.updatePiecePartial(t.id, {
				canBeAttackedAtTurn: currentTurn + SKILL_CAST_TURN_DURATION + 1,
			});
		}
	});

	// Toạ độ mục tiêu để UI vẽ hiệu ứng
	const skillTargetsCoords = affectedPieces
		.map((t) => BoardSelectors.getPiecePosition(board, t.id)!)
		.filter(Boolean);

	// Cập nhật attacker: reset mana, đánh dấu skillCast cho UI
	const isAttackerInAffected = affectedPieces.some((p) => p.id === attacker.id);
	const newAttacker: PieceModel = {
		...(isAttackerInAffected
			? affectedPieces.find((p) => p.id === attacker.id)!
			: attacker),
		currentMana: 0,
		skillCast: {
			skillName,
			skillType,
			skillTarget,
			targets: skillTargetsCoords,
		},
		lastBattleStats: {
			...(attacker.lastBattleStats ?? { damageDealt: 0, damageTaken: 0, turnsSurvived: 0 }),
			damageDealt: (attacker.lastBattleStats?.damageDealt ?? 0) + totalDamage,
		},
	};

	// Loại attacker khỏi affected để không duplicate
	const otherAffected = affectedPieces.filter((p) => p.id !== attacker.id);

	return boardSlice.boardReducer(
		board,
		boardSlice.commands.updateBoardPiecesCommand([newAttacker, ...otherAffected])
	);
}
