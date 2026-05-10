import { put, delay, getContext, select } from "redux-saga/effects";
import { Logger } from "winston";

import { GamePhase, RoundType, getRoundType } from "@creature-chess/models";
import { GAME_PHASE_LENGTHS } from "@creature-chess/models/config";
import { GamemodeSettings } from "@creature-chess/models/settings";

import {
	playerBeforeReadyPhaseEvent,
	playerRunReadyPhaseEvent,
} from "../../events";
import { Match } from "../../match";
import { CreepMatch, getCreepWave } from "../../creepRound";
import { RoundInfoCommands } from "../../roundInfo";
import { GameSagaContextPlayers, GetMatchupsFn } from "../../sagas";

type Callbacks = {
	onTurnComplete?: (timeMs: number) => void;
};

export const runReadyPhase = function* (callbacks: Callbacks = {}) {
	const players: GameSagaContextPlayers = yield getContext("players");
	const getMatchups: GetMatchupsFn = yield getContext("getMatchups");
	const logger: Logger = yield getContext("logger");
	const settings: GamemodeSettings = yield getContext("settings");

	// todo turn this into a `call` so it waits for all players

	players.getAll().forEach((p) => p.put(playerBeforeReadyPhaseEvent()));

	yield delay(500);

	const round: number = yield select((state: any) => state.roundInfo.round);
	const roundType = getRoundType(round);

	if (roundType === RoundType.PVE_CREEP || roundType === RoundType.PVE_BOSS) {
		const creepWave = getCreepWave(round);
		if (!creepWave) {
			logger.error("No creep wave found for PvE round", { round });
			return;
		}

		players.getLiving().forEach((homePlayer) => {
			const match = new CreepMatch(
				homePlayer,
				round,
				creepWave,
				logger,
				settings,
				callbacks.onTurnComplete
			);
			homePlayer.put(playerRunReadyPhaseEvent({ match }));
		});
	} else {
		const matchups = getMatchups();

		matchups.forEach(({ homeId, awayId, awayIsClone }) => {
			const homePlayer = players.getById(homeId);
			const awayPlayer = players.getById(awayId);

			// todo add logging here
			if (!homePlayer || !awayPlayer) {
				return;
			}

			const match = new Match(
				homePlayer,
				awayPlayer,
				awayIsClone,
				logger,
				settings,
				callbacks.onTurnComplete
			);

			homePlayer.put(playerRunReadyPhaseEvent({ match }));

			if (!awayIsClone) {
				awayPlayer.put(playerRunReadyPhaseEvent({ match }));
			}
		});
	}

	const phase = GamePhase.READY;
	const startedAt = Date.now() / 1000;
	yield put(RoundInfoCommands.setRoundInfoCommand({ phase, startedAt }));

	yield delay(GAME_PHASE_LENGTHS[GamePhase.READY] * 1000);
};
