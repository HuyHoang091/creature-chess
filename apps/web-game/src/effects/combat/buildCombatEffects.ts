import { BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import {
	CombatEffect,
	CombatFloatingTextEffect,
	FloatingTone,
} from "./CombatEffectsOverlay";

type VisualEffect = NonNullable<PieceModel["visualEffects"]>[number];

type BuildContext = {
	board: BoardState<PieceModel>;
	prevBoard: BoardState<PieceModel>;
	token: string;
	counter: number;
};

const createContext = (
	board: BoardState<PieceModel>,
	prevBoard: BoardState<PieceModel>
): BuildContext => ({
	board,
	prevBoard,
	token: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
	counter: 0,
});

const nextId = (context: BuildContext, label: string) =>
	`${context.token}-${label}-${context.counter++}`;

const getNewVisualEffects = (previous: PieceModel | undefined, current: PieceModel) => {
	const previousIds = new Set((previous?.visualEffects ?? []).map((effect) => effect.id));
	return (current.visualEffects ?? []).filter((effect) => !previousIds.has(effect.id));
};

const skillCastSignature = (piece: PieceModel) => {
	const skillCast = piece.skillCast;
	if (!skillCast) {
		return null;
	}

	return JSON.stringify({
		name: skillCast.skillName,
		type: skillCast.skillType,
		target: skillCast.skillTarget,
		primaryTargetId: skillCast.primaryTargetId ?? null,
		affectedPieceIds: skillCast.affectedPieceIds ?? [],
		targets: skillCast.targets,
	});
};

const getNewSkillCasters = (
	prevBoard: BoardState<PieceModel>,
	board: BoardState<PieceModel>
) =>
	Object.values(board.pieces).filter((piece) => {
		if (!piece.skillCast) {
			return false;
		}

		const previousPiece = prevBoard.pieces[piece.id];
		return skillCastSignature(previousPiece) !== skillCastSignature(piece);
	});

const getHealthGain = (
	prevBoard: BoardState<PieceModel>,
	board: BoardState<PieceModel>,
	pieceId: string
) => {
	const previous = prevBoard.pieces[pieceId];
	const current = board.pieces[pieceId];
	if (!previous || !current) {
		return 0;
	}

	return Math.max(current.currentHealth - previous.currentHealth, 0);
};

const resolveAffectedIds = (piece: PieceModel, board: BoardState<PieceModel>) => {
	const fromSkill = piece.skillCast?.affectedPieceIds?.filter((pieceId) => !!board.pieces[pieceId]);
	if (fromSkill && fromSkill.length > 0) {
		return fromSkill;
	}

	return (piece.skillCast?.targets ?? [])
		.map((target) => board.piecePositions[`${target.x},${target.y}`])
		.filter((pieceId): pieceId is string => !!pieceId);
};

const orderWithPrimaryFirst = (pieceIds: string[], primaryTargetId?: string | null) => {
	if (!primaryTargetId || !pieceIds.includes(primaryTargetId)) {
		return pieceIds;
	}

	return [primaryTargetId, ...pieceIds.filter((pieceId) => pieceId !== primaryTargetId)];
};

const addFloatingText = (
	context: BuildContext,
	effects: CombatEffect[],
	pieceId: string,
	text: string,
	options: Omit<CombatFloatingTextEffect, "id" | "kind" | "pieceId" | "text">
) => {
	effects.push({
		id: nextId(context, "text"),
		kind: "floatingText",
		pieceId,
		text,
		...options,
	});
};

const addHealBurst = (
	context: BuildContext,
	effects: CombatEffect[],
	pieceId: string,
	delayMs: number,
	amountText: string
) => {
	effects.push({
		id: nextId(context, "plus"),
		kind: "plusBurst",
		pieceId,
		delayMs,
		durationMs: 780,
	});
	addFloatingText(context, effects, pieceId, amountText, {
		variant: "heal",
		delayMs: delayMs + 40,
		driftX: 8,
	});
};

const labelToneFromEffect = (effect: VisualEffect): FloatingTone => {
	if (effect.tone) {
		return effect.tone;
	}

	if (effect.text === "Slow") {
		return "ice";
	}
	if (effect.text === "Revive!") {
		return "gold";
	}
	if (effect.text === "Thorns" || effect.text === "Burn") {
		return "warning";
	}
	return "neutral";
};

const parseSignedAmount = (value: string) => {
	const match = /^([+-])(\d+)$/.exec(value.trim());
	if (!match) {
		return null;
	}

	return {
		sign: match[1],
		amount: parseInt(match[2], 10),
	};
};

const addSkillImpactEffects = (
	context: BuildContext,
	effects: CombatEffect[],
	pieceIds: string[],
	variant: "fire" | "quake" | "lightning" | "slash" | "laser" | "skillHit",
	baseDelayMs: number,
	stepMs: number
) => {
	pieceIds.forEach((pieceId, index) => {
		effects.push({
			id: nextId(context, `${variant}-impact`),
			kind: "impact",
			variant,
			pieceId,
			delayMs: baseDelayMs + index * stepMs,
			durationMs: 620,
			scale: index === 0 ? 1.18 : 1.08,
		});
	});
};

const buildSkillShapeEffects = (
	context: BuildContext,
	effects: CombatEffect[],
	caster: PieceModel
) => {
	const skill = caster.skillCast;
	if (!skill) {
		return;
	}

	const affectedIds = resolveAffectedIds(caster, context.board);
	const orderedIds = orderWithPrimaryFirst(affectedIds, skill.primaryTargetId);
	const primaryTargetId = skill.primaryTargetId ?? orderedIds[0] ?? null;

	switch (skill.skillName) {
		case "Flame Burst": {
			effects.push({
				id: nextId(context, "flame-charge"),
				kind: "aura",
				variant: "charge",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 420,
				scale: 1.14,
			});
			if (primaryTargetId && primaryTargetId !== caster.id) {
				effects.push({
					id: nextId(context, "flame-link"),
					kind: "link",
					variant: "ember",
					fromId: caster.id,
					toId: primaryTargetId,
					delayMs: 70,
					durationMs: 330,
				});
			}
			addSkillImpactEffects(context, effects, orderedIds, "fire", 280, 70);
			orderedIds.forEach((pieceId, index) => {
				effects.push({
					id: nextId(context, "flame-burn"),
					kind: "aura",
					variant: "burn",
					pieceId,
					delayMs: 340 + index * 70,
					durationMs: 860,
					scale: index === 0 ? 1.18 : 1.06,
				});
			});
			break;
		}
		case "Earthquake": {
			effects.push({
				id: nextId(context, "quake-charge"),
				kind: "aura",
				variant: "charge",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 440,
				scale: 1.12,
			});
			if (primaryTargetId) {
				effects.push({
					id: nextId(context, "quake-field"),
					kind: "aura",
					variant: "quakeField",
					pieceId: primaryTargetId,
					delayMs: 140,
					durationMs: 940,
					scale: 1.52,
				});
			}
			addSkillImpactEffects(context, effects, orderedIds, "quake", 220, 80);
			break;
		}
		case "Chain Lightning": {
			effects.push({
				id: nextId(context, "lightning-charge"),
				kind: "aura",
				variant: "charge",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 520,
				scale: 1.18,
			});
			if (orderedIds.length > 0) {
				effects.push({
					id: nextId(context, "lightning-link"),
					kind: "link",
					variant: "lightning",
					fromId: caster.id,
					toId: orderedIds[0],
					delayMs: 120,
					durationMs: 240,
				});
			}
			orderedIds.forEach((pieceId, index) => {
				if (index > 0) {
					effects.push({
						id: nextId(context, "lightning-hop"),
						kind: "link",
						variant: "lightning",
						fromId: orderedIds[index - 1],
						toId: pieceId,
						delayMs: 340 + (index - 1) * 220,
						durationMs: 220,
					});
				}
				effects.push({
					id: nextId(context, "lightning-impact"),
					kind: "impact",
					variant: "lightning",
					pieceId,
					delayMs: 280 + index * 220,
					durationMs: 520,
					scale: 1.12,
				});
			});
			break;
		}
		case "Mend": {
			const targetId = orderedIds[0] ?? caster.id;
			effects.push({
				id: nextId(context, "mend-caster"),
				kind: "aura",
				variant: "healCaster",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 820,
				scale: 1.16,
			});
			if (targetId !== caster.id) {
				effects.push({
					id: nextId(context, "mend-link"),
					kind: "link",
					variant: "healStream",
					fromId: caster.id,
					toId: targetId,
					delayMs: 140,
					durationMs: 320,
				});
			}
			effects.push({
				id: nextId(context, "mend-target"),
				kind: "aura",
				variant: "healTarget",
				pieceId: targetId,
				delayMs: 260,
				durationMs: 760,
				scale: 1.12,
			});
			break;
		}
		case "Nature Blessing": {
			effects.push({
				id: nextId(context, "nature-caster"),
				kind: "aura",
				variant: "healCaster",
				pieceId: caster.id,
				delayMs: 60,
				durationMs: 1100,
				scale: 1.34,
			});
			orderedIds.forEach((pieceId, index) => {
				effects.push({
					id: nextId(context, "nature-target"),
					kind: "aura",
					variant: pieceId === caster.id ? "healCaster" : "healTarget",
					pieceId,
					delayMs: 180 + index * 80,
					durationMs: 760,
					scale: pieceId === caster.id ? 1.18 : 1.12,
				});
			});
			break;
		}
		case "Fatal Thrust": {
			effects.push({
				id: nextId(context, "thrust-charge"),
				kind: "aura",
				variant: "charge",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 360,
				scale: 1.08,
			});
			if (primaryTargetId) {
				effects.push({
					id: nextId(context, "thrust-link"),
					kind: "link",
					variant: "slash",
					fromId: caster.id,
					toId: primaryTargetId,
					delayMs: 120,
					durationMs: 220,
				});
				effects.push({
					id: nextId(context, "thrust-impact"),
					kind: "impact",
					variant: "slash",
					pieceId: primaryTargetId,
					delayMs: 250,
					durationMs: 560,
					scale: 1.12,
				});
			}
			break;
		}
		case "Laser Beam": {
			effects.push({
				id: nextId(context, "laser-charge"),
				kind: "aura",
				variant: "laserCharge",
				pieceId: caster.id,
				delayMs: 0,
				durationMs: 520,
				scale: 1.18,
			});
			const lastTargetId = orderedIds[orderedIds.length - 1];
			if (lastTargetId) {
				effects.push({
					id: nextId(context, "laser-link"),
					kind: "link",
					variant: "beam",
					fromId: caster.id,
					toId: lastTargetId,
					delayMs: 110,
					durationMs: 480,
				});
			}
			addSkillImpactEffects(context, effects, orderedIds, "laser", 230, 60);
			break;
		}
		case "Rage Mode": {
			effects.push({
				id: nextId(context, "rage-buff"),
				kind: "aura",
				variant: "buffSelf",
				pieceId: caster.id,
				delayMs: 90,
				durationMs: 980,
				scale: 1.22,
			});
			break;
		}
		default: {
			if (skill.skillType === "damage") {
				addSkillImpactEffects(context, effects, orderedIds, "skillHit", 220, 70);
			}
		}
	}
};

const buildVisualEffects = (
	context: BuildContext,
	effects: CombatEffect[],
	piece: PieceModel,
	newEffects: VisualEffect[]
) => {
	newEffects.forEach((effect, index) => {
		const delayMs = 100 + index * 70;
		const amount = parseSignedAmount(effect.text);

		if (effect.variant === "heal" && amount?.sign === "+") {
			if (effect.sourcePieceId && effect.sourcePieceId !== piece.id) {
				effects.push({
					id: nextId(context, "lifesteal-link"),
					kind: "link",
					variant: "lifesteal",
					fromId: effect.sourcePieceId,
					toId: piece.id,
					delayMs: Math.max(delayMs - 120, 0),
					durationMs: 360,
				});
			}
			addHealBurst(context, effects, piece.id, delayMs, effect.text);
			return;
		}

		if (effect.variant === "skillDamage" && amount?.sign === "-") {
			addFloatingText(context, effects, piece.id, effect.text, {
				variant: "skillDamage",
				delayMs,
				driftX: index % 2 === 0 ? -8 : 10,
			});
			return;
		}

		if (effect.variant === "damage" && amount?.sign === "-") {
			addFloatingText(context, effects, piece.id, effect.text, {
				variant: "damage",
				delayMs,
				driftX: index % 2 === 0 ? -8 : 8,
			});
			return;
		}

		if (effect.text === "Dodge!") {
			effects.push({
				id: nextId(context, "dodge-impact"),
				kind: "impact",
				variant: "dodge",
				pieceId: piece.id,
				delayMs,
				durationMs: 620,
				scale: 1.12,
			});
			effects.push({
				id: nextId(context, "dodge-aura"),
				kind: "aura",
				variant: "dodge",
				pieceId: piece.id,
				delayMs: Math.max(delayMs - 20, 0),
				durationMs: 720,
				scale: 1.1,
			});
		}

		if (effect.text === "Slow") {
			effects.push({
				id: nextId(context, "slow-aura"),
				kind: "aura",
				variant: "slow",
				pieceId: piece.id,
				delayMs: Math.max(delayMs - 40, 0),
				durationMs: 960,
				scale: 1.16,
			});
		}

		if (effect.text === "Revive!") {
			effects.push({
				id: nextId(context, "revive-impact"),
				kind: "impact",
				variant: "revive",
				pieceId: piece.id,
				delayMs: Math.max(delayMs - 140, 0),
				durationMs: 980,
				scale: 1.16,
			});
			effects.push({
				id: nextId(context, "revive-aura"),
				kind: "aura",
				variant: "revive",
				pieceId: piece.id,
				delayMs: Math.max(delayMs - 70, 0),
				durationMs: 1200,
				scale: 1.28,
			});
			const healAmount = getHealthGain(context.prevBoard, context.board, piece.id);
			if (healAmount > 0) {
				addHealBurst(
					context,
					effects,
					piece.id,
					delayMs + 120,
					`+${healAmount}`
				);
			}
		}

		if (effect.text === "Thorns" && effect.sourcePieceId) {
			effects.push({
				id: nextId(context, "thorns-link"),
				kind: "link",
				variant: "thorns",
				fromId: piece.id,
				toId: effect.sourcePieceId,
				delayMs: Math.max(delayMs - 60, 0),
				durationMs: 260,
			});
			effects.push({
				id: nextId(context, "thorns-impact"),
				kind: "impact",
				variant: "thorns",
				pieceId: effect.sourcePieceId,
				delayMs,
				durationMs: 520,
				scale: 1.08,
			});
		}

		if (effect.variant === "label" || !amount) {
			addFloatingText(context, effects, piece.id, effect.text, {
				variant: "label",
				delayMs,
				tone: labelToneFromEffect(effect),
			});
		}
	});
};

export const buildCombatEffects = (
	prevBoard: BoardState<PieceModel> | null,
	board: BoardState<PieceModel>
): CombatEffect[] => {
	if (!prevBoard) {
		return [];
	}

	const context = createContext(board, prevBoard);
	const effects: CombatEffect[] = [];
	const newSkillCasters = getNewSkillCasters(prevBoard, board);

	newSkillCasters.forEach((piece) => {
		buildSkillShapeEffects(context, effects, piece);
	});

	Object.values(board.pieces).forEach((piece) => {
		buildVisualEffects(
			context,
			effects,
			piece,
			getNewVisualEffects(prevBoard.pieces[piece.id], piece)
		);
	});

	return effects;
};
