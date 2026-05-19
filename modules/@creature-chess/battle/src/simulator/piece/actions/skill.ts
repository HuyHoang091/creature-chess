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
import {
	applyFrozenHeartSlow,
	getEffectiveSpeed,
	getLifestealHealAmount,
	getPieceStatusEffects,
	getThornmailReflectDamage,
	hasPassive,
	resolveRevive,
	shouldDodge,
} from "../../../utils/itemPassives";
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

type SkillDamageResult = {
	piece: PieceModel;
	actualDamage: number;
	reflectedDamage: number;
	dodged: boolean;
	triggeredFrozenHeart: boolean;
};

function applyDamage(
	currentTurn: number,
	attacker: PieceModel,
	piece: PieceModel,
	damage: number,
	attackerPosition: PiecePosition,
	board: BoardState<PieceModel>,
	stores: Stores
): SkillDamageResult {
	const pPos = BoardSelectors.getPiecePosition(board, piece.id);
	const dodged = shouldDodge(piece);
	const actualDamage = dodged ? 0 : damage;
	const reviveResult = resolveRevive(
		currentTurn,
		piece,
		Math.max(piece.currentHealth - actualDamage, 0),
		stores
	);
	const reflectedDamage = dodged ? 0 : getThornmailReflectDamage(piece, attacker);
	const defenderMana =
		reviveResult.revived
			? reviveResult.mana
			: reviveResult.health > 0
			? Math.min(piece.currentMana + actualDamage, piece.maxMana || 100)
			: piece.currentMana;
	const visualEffects = [...(piece.visualEffects ?? [])];

	if (dodged) {
		visualEffects.push(
			createSkillVisualEffect("Dodge!", {
				variant: "label",
				tone: "neutral",
				sourcePieceId: attacker.id,
			})
		);
	}

	if (!dodged && reflectedDamage > 0) {
		visualEffects.push(
			createSkillVisualEffect("Thorns", {
				variant: "label",
				tone: "warning",
				sourcePieceId: attacker.id,
				color: "#ffaa00",
			})
		);
	}

	return {
		piece: {
			...piece,
			currentHealth: reviveResult.health,
			currentMana: defenderMana,
			hit: {
				direction: pPos
					? getRelativeDirection(pPos, attackerPosition)
					: { x: 0, y: 0 },
				damage: actualDamage,
			},
			lastBattleStats: {
				...piece.lastBattleStats!,
				damageTaken: piece.lastBattleStats!.damageTaken + actualDamage,
			},
			visualEffects,
		},
		actualDamage,
		reflectedDamage,
		dodged,
		triggeredFrozenHeart: !dodged && hasPassive(piece, "slow_nearby"),
	};
}

function createSkillVisualEffect(
	text: string,
	options: {
		variant: "damage" | "skillDamage" | "heal" | "label";
		tone?: "neutral" | "ice" | "gold" | "warning";
		sourcePieceId?: string;
		color?: string;
	}
) {
	return {
		id: Math.random().toString(36).slice(2),
		text,
		color:
			options.color ??
			(options.variant === "heal"
				? "#00ff99"
				: options.variant === "damage"
					? "#ff7f7f"
				: options.variant === "skillDamage"
					? "#75f8ff"
					: "#ffffff"),
		variant: options.variant,
		tone: options.tone,
		sourcePieceId: options.sourcePieceId,
	};
}

function appendSkillVisualEffects(
	board: BoardState<PieceModel>,
	pieces: PieceModel[],
	attacker: PieceModel,
	skillName: string,
	skillType: "damage" | "buff" | "support",
	skillTarget: "single" | "aoe" | "bounce" | "line"
) {
	if (pieces.length === 0) {
		return pieces;
	}

	if (skillType === "damage") {
		const primaryTargetId = pieces[0]?.id;

		return pieces.map((piece) => {
			const visualEffects = [...(piece.visualEffects ?? [])];

			if (piece.id !== attacker.id && piece.hit?.damage) {
				visualEffects.push(
					createSkillVisualEffect(`-${piece.hit.damage}`, {
						variant: "skillDamage",
						sourcePieceId: attacker.id,
					})
				);

				if (skillName === "Flame Burst" && piece.id === primaryTargetId) {
					visualEffects.push(
						createSkillVisualEffect("Burn", {
							variant: "label",
							tone: "warning",
							sourcePieceId: attacker.id,
							color: "#ffb18a",
						})
					);
				}
			}

			return {
				...piece,
				visualEffects,
			};
		});
	}

	if (skillType === "buff") {
		return pieces.map((piece) => {
			if (piece.id !== attacker.id) {
				return piece;
			}

			const healAmount = Math.max(piece.currentHealth - attacker.currentHealth, 0);
			const visualEffects = [...(piece.visualEffects ?? [])];

			if (healAmount > 0) {
				visualEffects.push(
					createSkillVisualEffect(`+${healAmount}`, {
						variant: "heal",
						sourcePieceId: attacker.id,
					})
				);
			}

			visualEffects.push(
				createSkillVisualEffect(`Rage +${Math.round(BUFF_ATTACK_BONUS * 100)}%`, {
					variant: "label",
					tone: "gold",
					sourcePieceId: attacker.id,
					color: "#ffd888",
				})
			);

			return {
				...piece,
				visualEffects,
			};
		});
	}

	return pieces.map((piece) => {
		const previousHealth =
			BoardSelectors.getPiece(board, piece.id)?.currentHealth ?? piece.currentHealth;
		const healAmount = Math.max(piece.currentHealth - previousHealth, 0);
		const visualEffects = [...(piece.visualEffects ?? [])];

		if (healAmount > 0) {
			visualEffects.push(
				createSkillVisualEffect(`+${healAmount}`, {
					variant: "heal",
					sourcePieceId: attacker.id,
				})
			);
		}

		return {
			...piece,
			visualEffects,
		};
	});
}

// ===================== SKILL TYPE HANDLERS =====================

/** Sát thương đơn mục tiêu — Fatal Thrust style */
function doSingleDamage(
	currentTurn: number,
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string,
	stores: Stores
): {
	affected: PieceModel[];
	totalDamage: number;
	reflectedDamage: number;
	triggeredFrozenHeart: boolean;
} {
	const target = BoardSelectors.getPiece(board, targetId);
	if (!target || target.currentHealth <= 0) {
		return {
			affected: [],
			totalDamage: 0,
			reflectedDamage: 0,
			triggeredFrozenHeart: false,
		};
	}

	const atkStats = getStats(attacker);
	const defStats = getStats(target);
	const damage = calcDamage(atkStats.attack, defStats.defense) * 2; // Single = extra strong
	const result = applyDamage(
		currentTurn,
		attacker,
		target,
		damage,
		attackerPosition,
		board,
		stores
	);

	return {
		affected: [result.piece],
		totalDamage: result.actualDamage,
		reflectedDamage: result.reflectedDamage,
		triggeredFrozenHeart: result.triggeredFrozenHeart,
	};
}

/** Sát thương vùng AoE — Flame Burst / Earthquake */
function doAoeDamage(
	currentTurn: number,
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string,
	stores: Stores
): {
	affected: PieceModel[];
	totalDamage: number;
	reflectedDamage: number;
	triggeredFrozenHeart: boolean;
} {
	const targetPosition = BoardSelectors.getPiecePosition(board, targetId);
	if (!targetPosition) {
		return {
			affected: [],
			totalDamage: 0,
			reflectedDamage: 0,
			triggeredFrozenHeart: false,
		};
	}

	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;
	let reflectedDamage = 0;
	let triggeredFrozenHeart = false;

	getAllEnemies(board, attacker.ownerId).forEach((enemy) => {
		const ePos = BoardSelectors.getPiecePosition(board, enemy.id);
		if (ePos && getDistance(targetPosition, ePos) <= 1) {
			const defStats = getStats(enemy);
			const damage = calcDamage(atkStats.attack, defStats.defense);
			const result = applyDamage(
				currentTurn,
				attacker,
				enemy,
				damage,
				attackerPosition,
				board,
				stores
			);
			affected.push(result.piece);
			totalDamage += result.actualDamage;
			reflectedDamage += result.reflectedDamage;
			triggeredFrozenHeart = triggeredFrozenHeart || result.triggeredFrozenHeart;
		}
	});

	return { affected, totalDamage, reflectedDamage, triggeredFrozenHeart };
}

/** Sát thương bật nảy — Chain Lightning */
function doBounceDamage(
	currentTurn: number,
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string,
	stores: Stores
): {
	affected: PieceModel[];
	totalDamage: number;
	reflectedDamage: number;
	triggeredFrozenHeart: boolean;
} {
	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;
	let reflectedDamage = 0;
	let triggeredFrozenHeart = false;
	const hitIds = new Set<string>();

	let currentTargetId = targetId;
	for (let bounce = 0; bounce < BOUNCE_MAX_TARGETS; bounce++) {
		const target = BoardSelectors.getPiece(board, currentTargetId);
		const tPos = BoardSelectors.getPiecePosition(board, currentTargetId);
		if (!target || !tPos || target.currentHealth <= 0) break;

		const defStats = getStats(target);
		const damageDecay = 1 - bounce * 0.2; // 100% → 80% → 60%
		const damage = Math.ceil(calcDamage(atkStats.attack, defStats.defense) * damageDecay);
		const result = applyDamage(
			currentTurn,
			attacker,
			target,
			damage,
			attackerPosition,
			board,
			stores
		);
		affected.push(result.piece);
		totalDamage += result.actualDamage;
		reflectedDamage += result.reflectedDamage;
		triggeredFrozenHeart = triggeredFrozenHeart || result.triggeredFrozenHeart;
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

	return { affected, totalDamage, reflectedDamage, triggeredFrozenHeart };
}

/** Sát thương xuyên thẳng — Laser Beam */
function doLineDamage(
	currentTurn: number,
	board: BoardState<PieceModel>,
	attacker: PieceModel,
	attackerPosition: PiecePosition,
	targetId: string,
	stores: Stores
): {
	affected: PieceModel[];
	totalDamage: number;
	reflectedDamage: number;
	triggeredFrozenHeart: boolean;
} {
	const targetPosition = BoardSelectors.getPiecePosition(board, targetId);
	if (!targetPosition) {
		return {
			affected: [],
			totalDamage: 0,
			reflectedDamage: 0,
			triggeredFrozenHeart: false,
		};
	}

	// Tính hướng đi từ attacker → target
	const dx = targetPosition.x - attackerPosition.x;
	const dy = targetPosition.y - attackerPosition.y;
	const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
	const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

	const atkStats = getStats(attacker);
	const affected: PieceModel[] = [];
	let totalDamage = 0;
	let reflectedDamage = 0;
	let triggeredFrozenHeart = false;

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
				const result = applyDamage(
					currentTurn,
					attacker,
					enemy,
					damage,
					attackerPosition,
					board,
					stores
				);
				affected.push(result.piece);
				totalDamage += result.actualDamage;
				reflectedDamage += result.reflectedDamage;
				triggeredFrozenHeart = triggeredFrozenHeart || result.triggeredFrozenHeart;
			}
		});
	}

	return { affected, totalDamage, reflectedDamage, triggeredFrozenHeart };
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
	let totalReflectedDamage = 0;
	let attackerTriggeredFrozenHeart = false;

	// ========== DAMAGE skills ==========
	if (skillType === "damage") {
		switch (skillTarget) {
			case "single": {
				const result = doSingleDamage(
					currentTurn,
					board,
					attacker,
					attackerPosition,
					action.payload.targetId,
					{ combatStore }
				);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				totalReflectedDamage = result.reflectedDamage;
				attackerTriggeredFrozenHeart = result.triggeredFrozenHeart;
				break;
			}
			case "aoe": {
				const result = doAoeDamage(
					currentTurn,
					board,
					attacker,
					attackerPosition,
					action.payload.targetId,
					{ combatStore }
				);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				totalReflectedDamage = result.reflectedDamage;
				attackerTriggeredFrozenHeart = result.triggeredFrozenHeart;
				break;
			}
			case "bounce": {
				const result = doBounceDamage(
					currentTurn,
					board,
					attacker,
					attackerPosition,
					action.payload.targetId,
					{ combatStore }
				);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				totalReflectedDamage = result.reflectedDamage;
				attackerTriggeredFrozenHeart = result.triggeredFrozenHeart;
				break;
			}
			case "line": {
				const result = doLineDamage(
					currentTurn,
					board,
					attacker,
					attackerPosition,
					action.payload.targetId,
					{ combatStore }
				);
				affectedPieces = result.affected;
				totalDamage = result.totalDamage;
				totalReflectedDamage = result.reflectedDamage;
				attackerTriggeredFrozenHeart = result.triggeredFrozenHeart;
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
	affectedPieces = appendSkillVisualEffects(
		board,
		affectedPieces,
		attacker,
		skillName,
		skillType,
		skillTarget
	);

	const slowEffect = attackerTriggeredFrozenHeart
		? applyFrozenHeartSlow(attacker, currentTurn, { combatStore })
		: null;
	const canAttackAtTurn =
		currentTurn +
		SKILL_CAST_TURN_DURATION +
		getCooldownForSpeed(getEffectiveSpeed(attacker, currentTurn, { combatStore }));
	const canMoveAtTurn =
		currentTurn +
		SKILL_CAST_TURN_DURATION +
		getCooldownForSpeed(getEffectiveSpeed(attacker, currentTurn, { combatStore }));

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
	const affectedPieceIds = affectedPieces.map((piece) => piece.id);
	const actualPrimaryTargetId =
		skillType === "buff"
			? attacker.id
			: skillType === "support" && skillTarget !== "aoe"
				? affectedPieceIds[0] ?? attacker.id
				: skillType === "support"
					? attacker.id
					: action.payload.targetId;
	const skillTargetsCoords = affectedPieceIds.flatMap((pieceId) => {
		const position = BoardSelectors.getPiecePosition(board, pieceId);
		return position ? [position] : [];
	});
	const primaryTarget =
		actualPrimaryTargetId !== null
			? BoardSelectors.getPiecePosition(board, actualPrimaryTargetId)
			: null;

	// Cập nhật attacker: reset mana, đánh dấu skillCast cho UI
	const isAttackerInAffected = affectedPieces.some((p) => p.id === attacker.id);
	const attackerAfterSkill = isAttackerInAffected
		? affectedPieces.find((p) => p.id === attacker.id)!
		: attacker;
	const skillHealAmount =
		skillType === "damage" ? getLifestealHealAmount(attacker, totalDamage) : 0;
	const attackerResult = resolveRevive(
		currentTurn,
		attackerAfterSkill,
		Math.max(
			Math.min(
				attackerAfterSkill.currentHealth - totalReflectedDamage + skillHealAmount,
				attackerAfterSkill.maxHealth
			),
			0
		),
		{ combatStore }
	);
	const attackerVisualEffects = [...(attackerAfterSkill.visualEffects ?? [])];

	if (totalReflectedDamage > 0) {
		attackerVisualEffects.push(
			createSkillVisualEffect(`-${totalReflectedDamage}`, {
				variant: "damage",
				sourcePieceId: actualPrimaryTargetId ?? undefined,
				color: "#ff0000",
			})
		);
	}

	if (skillHealAmount > 0) {
		attackerVisualEffects.push(
			createSkillVisualEffect(`+${skillHealAmount}`, {
				variant: "heal",
				sourcePieceId: actualPrimaryTargetId ?? undefined,
			})
		);
	}

	if (slowEffect) {
		attackerVisualEffects.push(slowEffect);
	}
	const newAttacker: PieceModel = {
		...attackerAfterSkill,
		currentHealth: attackerResult.health,
		currentMana: attackerResult.health > 0 ? 0 : attackerResult.mana,
		skillCast: {
			skillName,
			skillType,
			skillTarget,
			targets: skillTargetsCoords,
			primaryTarget: primaryTarget ?? null,
			primaryTargetId: actualPrimaryTargetId ?? null,
			affectedPieceIds,
		},
		lastBattleStats: {
			...(attacker.lastBattleStats ?? { damageDealt: 0, damageTaken: 0, turnsSurvived: 0 }),
			damageDealt: (attacker.lastBattleStats?.damageDealt ?? 0) + totalDamage,
		},
		statusEffects: getPieceStatusEffects(attacker, currentTurn, {
			combatStore,
		}),
		visualEffects: attackerVisualEffects,
	};

	// Loại attacker khỏi affected để không duplicate
	const otherAffected = affectedPieces
		.filter((p) => p.id !== attacker.id)
		.map((piece) => ({
			...piece,
			statusEffects: getPieceStatusEffects(piece, currentTurn, {
				combatStore,
			}),
		}));

	return boardSlice.boardReducer(
		board,
		boardSlice.commands.updateBoardPiecesCommand([newAttacker, ...otherAffected])
	);
}
