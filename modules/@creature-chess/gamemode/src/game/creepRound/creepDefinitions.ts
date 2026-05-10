/**
 * Creep wave definitions for PvE rounds.
 * Creeps are intentionally MUCH weaker than normal pieces (statMultiplier 0.25-0.5).
 */
import { v4 as uuid } from "uuid";

import { PieceModel, RoundType } from "@creature-chess/models";
import { attackTypes } from "@creature-chess/models";

export const CREEP_OWNER_ID = "__CREEP__";

export interface CreepWave {
	name: string;
	count: number;
	/** Multiplier for creep stats relative to a cost-1 creature. Keep LOW (0.25-0.5). */
	statMultiplier: number;
	/** Chance (0-1) each killed creep drops an item. */
	dropChance: number;
	isBoss?: boolean;
}

/**
 * Creep wave configs indexed by round number.
 * Stats are purposely very weak so players can win easily.
 */
export const CREEP_WAVES: Record<number, CreepWave> = {
	// Early PvE rounds — very easy
	1: { name: "Slimes", count: 2, statMultiplier: 0.25, dropChance: 1.0 },
	2: { name: "Goblins", count: 3, statMultiplier: 0.3, dropChance: 1.0 },
	3: { name: "Wolves", count: 3, statMultiplier: 0.35, dropChance: 1.0 },

	// Boss rounds — 1 boss, moderate stats, guaranteed drop
	5: { name: "Drake", count: 1, statMultiplier: 0.5, dropChance: 1.0, isBoss: true },
	10: { name: "Elder Dragon", count: 1, statMultiplier: 0.5, dropChance: 1.0, isBoss: true },
	15: { name: "Rift Herald", count: 2, statMultiplier: 0.45, dropChance: 1.0, isBoss: true },
	20: { name: "Baron Nashor", count: 1, statMultiplier: 0.5, dropChance: 1.0, isBoss: true },
	25: { name: "Ancient Golem", count: 2, statMultiplier: 0.45, dropChance: 1.0, isBoss: true },
	30: { name: "World Boss", count: 1, statMultiplier: 0.5, dropChance: 1.0, isBoss: true },
};

/**
 * Get the creep wave for a given round. Returns null if not a PvE round.
 */
export const getCreepWave = (round: number): CreepWave | null => {
	return CREEP_WAVES[round] ?? null;
};

/**
 * Generate creep PieceModel[] for a given round.
 * Stats are intentionally very weak (multiplied by statMultiplier).
 */
export function generateCreepPieces(round: number): PieceModel[] {
	const wave = getCreepWave(round);
	if (!wave) {
		return [];
	}

	const pieces: PieceModel[] = [];

	// Base stats for creeps — these are already low
	const baseHp = wave.isBoss ? 120 : 50;
	const baseAttack = wave.isBoss ? 15 : 8;
	const baseDefense = wave.isBoss ? 12 : 6;
	const baseSpeed = 8;

	for (let i = 0; i < wave.count; i++) {
		const hp = Math.ceil(baseHp * wave.statMultiplier);
		const attack = Math.ceil(baseAttack * wave.statMultiplier);
		const defense = Math.ceil(baseDefense * wave.statMultiplier);
		const speed = Math.ceil(baseSpeed * wave.statMultiplier);

		const piece: PieceModel = {
			id: uuid(),
			ownerId: CREEP_OWNER_ID,
			definitionId: -1, // Special ID for creeps
			definition: {
				id: -1,
				name: wave.name,
				cost: 0,
				traits: [],
				stages: [
					{
						hp: hp * 5,
						attack,
						defense,
						speed,
						attackType: attackTypes.basic,
					},
				],
			},
			traits: [],
			items: [],
			stage: 0,
			facingAway: false,
			maxHealth: hp * 5,
			currentHealth: hp * 5,
			maxMana: 999, // Creeps don't use skills
			currentMana: 0,
			lastBattleStats: null,
		};

		pieces.push(piece);
	}

	return pieces;
}
