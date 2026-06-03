import { PlayerStatus } from "@creature-chess/models/game/playerList";

import { BuildAutoPlayPreset } from "./policy";

export type LobbyTempo = "fast" | "slow" | "neutral";

export interface TempoSnapshot {
	round: number;
	totalLobbyHealth: number;
	aliveCount: number;
}

export interface LobbyPlayerSnapshot {
	health: number;
	status: PlayerStatus | string;
}

export const FAST_TEMPO_HP_LOSS_PER_PLAYER = 8;
export const SLOW_TEMPO_HP_LOSS_PER_PLAYER = 3;
export const MAX_TEMPO_HISTORY = 4;

export const isAliveLobbyPlayer = (player: LobbyPlayerSnapshot) =>
	player.status !== PlayerStatus.QUIT && player.health > 0;

export const createTempoSnapshot = (
	round: number,
	players: LobbyPlayerSnapshot[]
): TempoSnapshot => {
	const alivePlayers = players.filter(isAliveLobbyPlayer);
	return {
		round,
		totalLobbyHealth: alivePlayers.reduce(
			(total, player) => total + player.health,
			0
		),
		aliveCount: alivePlayers.length,
	};
};

export const detectLobbyTempo = (history: TempoSnapshot[]): LobbyTempo => {
	if (history.length < 2) {
		return "neutral";
	}

	const oldest = history[0];
	const newest = history[history.length - 1];
	const roundsElapsed = newest.round - oldest.round;
	if (roundsElapsed <= 0) {
		return "neutral";
	}

	const hpLoss = oldest.totalLobbyHealth - newest.totalLobbyHealth;
	const avgAlive =
		history.reduce((total, snapshot) => total + snapshot.aliveCount, 0) /
		history.length;
	const avgHpLossPerPlayerPerRound =
		hpLoss / roundsElapsed / Math.max(avgAlive, 1);

	if (avgHpLossPerPlayerPerRound > FAST_TEMPO_HP_LOSS_PER_PLAYER) {
		return "fast";
	}
	if (avgHpLossPerPlayerPerRound < SLOW_TEMPO_HP_LOSS_PER_PLAYER) {
		return "slow";
	}
	return "neutral";
};

export const resolveEffectivePreset = (
	userPreset: BuildAutoPlayPreset,
	tempo: LobbyTempo
): BuildAutoPlayPreset => {
	if (tempo === "fast") {
		return "stabilize";
	}
	if (tempo === "slow") {
		return "economy";
	}
	return userPreset;
};

export const appendTempoSnapshot = (
	history: TempoSnapshot[],
	snapshot: TempoSnapshot
) => {
	const next = [...history, snapshot];
	if (next.length <= MAX_TEMPO_HISTORY) {
		return next;
	}
	return next.slice(next.length - MAX_TEMPO_HISTORY);
};
