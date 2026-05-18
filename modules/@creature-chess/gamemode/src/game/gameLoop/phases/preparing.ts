import { select, race, put, delay, getContext } from "@redux-saga/core/effects";

import { GamePhase, RoundType, getRoundType } from "@creature-chess/models";
import { GAME_PHASE_LENGTHS } from "@creature-chess/models/config";

import { playerRunPreparingPhaseEvent } from "../../events";
import { readyNotifier } from "../../readyNotifier";
import { RoundInfoCommands } from "../../roundInfo";
import { GameSagaContextPlayers, GetMatchupsFn, GetPotentialOpponentFn } from "../../sagas";
import { playerInfoCommands } from "../../../entities/player/state/commands";

export const runPreparingPhase = function* () {
	const players: GameSagaContextPlayers = yield getContext("players");
	const peekMatchups: GetMatchupsFn = yield getContext("peekMatchups");
	const getPotentialOpponent: GetPotentialOpponentFn = yield getContext("getPotentialOpponent");

	const round: number = yield select((state) => state.roundInfo.round);

	const phase = GamePhase.PREPARING;
	const startedAt = Date.now() / 1000;
	const nextRound = round + 1;
	const roundType = getRoundType(nextRound);

	// todo put gamePhaseStartedEvent here?
	yield put(
		RoundInfoCommands.setRoundInfoCommand({
			phase,
			startedAt,
			round: nextRound,
			roundType,
		})
	);

	// Reveal real opponent + potential opponent for each player
	if (roundType === RoundType.PVE_CREEP || roundType === RoundType.PVE_BOSS) {
		players.getLiving().forEach((p) => {
			p.put(
				playerInfoCommands.updateOpponentCommand({
					id: "creep",
					isClone: false,
				})
			);
			p.put(
				playerInfoCommands.updatePotentialOpponentCommand({
					id: null,
					isClone: false,
				})
			);
		});
	} else {
		const matchups = peekMatchups();
		players.getLiving().forEach((p) => {
			const matchup = matchups.find(
				(m) => m.homeId === p.id || m.awayId === p.id
			);
			if (matchup) {
				const realOpponentId = matchup.homeId === p.id ? matchup.awayId : matchup.homeId;
				p.put(
					playerInfoCommands.updateOpponentCommand({
						id: realOpponentId,
						isClone: matchup.awayIsClone,
					})
				);
				const potential = getPotentialOpponent(p.id);
				if (potential) {
					p.put(
						playerInfoCommands.updatePotentialOpponentCommand({
							id: potential.opponentId,
							isClone: potential.isClone,
						})
					);
				}
			}
		});
	}

	players.getLiving().forEach((p) => p.put(playerRunPreparingPhaseEvent()));

	const notifier = readyNotifier(players.getLiving());

	yield race([
		notifier.promise,
		delay(GAME_PHASE_LENGTHS[GamePhase.PREPARING] * 1000),
	]);

	notifier.dispose();
};
