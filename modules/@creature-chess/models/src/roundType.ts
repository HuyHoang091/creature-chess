/**
 * Round type definitions for PvP vs PvE rounds.
 */

export enum RoundType {
	PVP = "PvP",
	PVE_CREEP = "PvE_Creep",
	PVE_BOSS = "PvE_Boss",
}

/**
 * Determine the round type based on the round number.
 * - Rounds 1-3: PvE Creep
 * - Every 5th round (5, 10, 15, 20...): PvE Boss
 * - All other rounds: PvP
 */
export const getRoundType = (round: number): RoundType => {
	if (round <= 3) {
		return RoundType.PVE_CREEP;
	}
	if (round % 5 === 0) {
		return RoundType.PVE_BOSS;
	}
	return RoundType.PVP;
};

/**
 * Check if a round is a PvE round (creep or boss).
 */
export const isPveRound = (round: number): boolean => {
	const type = getRoundType(round);
	return type === RoundType.PVE_CREEP || type === RoundType.PVE_BOSS;
};
