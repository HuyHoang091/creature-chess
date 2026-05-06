import pDefer from "p-defer";
import { call, take, put, getContext, fork, delay, cancel } from "typed-redux-saga";

import { GamePhase } from "@creature-chess/models";
import { GAME_PHASE_LENGTHS } from "@creature-chess/models/config";

import {
	PlayerFinishMatchEvent,
	playerFinishMatchEvent,
} from "../../../entities/player/events";
import { getMatches } from "../../../features/match/selectors";
import { Match } from "../../match";
import { RoundInfoCommands } from "../../roundInfo";
import { GameSagaContextPlayers } from "../../sagas";

const waitForFinishMatchSaga = function* () {
	yield* take<PlayerFinishMatchEvent>(playerFinishMatchEvent.toString());
};

type Callbacks = {
	onMatchStart?: () => void;
	onMatchEnd?: () => void;
};

export const runPlayingPhase = function* (callbacks: Callbacks = {}) {
	const players = yield* getContext<GameSagaContextPlayers>("players");

	const battleTimeoutDeferred = pDefer<void>();

	const phase = GamePhase.PLAYING;
	const startedAt = Date.now() / 1000;

	yield put(RoundInfoCommands.setRoundInfoCommand({ phase, startedAt }));

	const livingPlayers = players.getLiving();

	const matches = yield* call(getMatches, livingPlayers);

	const uniqueMatches = [
		...new Set(matches.filter((match): match is Match => match !== null)),
	];
	const finishMatchTasks = livingPlayers.map((p) =>
		p.runSaga(waitForFinishMatchSaga)
	);

	const OVERTIME_DURATION = 10; // 10s sudden death
	const standardDuration = GAME_PHASE_LENGTHS[GamePhase.PLAYING] - OVERTIME_DURATION;

	// Tạo saga con để đếm ngược Overtime mà không chặn tiến trình chính
	const overtimeTask = yield* fork(function* () {
		yield* delay(standardDuration * 1000);
		
		// 1. Kích hoạt x3 speed cho logic của các trận đấu trên server
		uniqueMatches.forEach((m) => m.triggerOvertime());
		
		// 2. Broadcast trạng thái isOvertime tới tất cả Client để hiện UI Sudden Death
		yield* put(RoundInfoCommands.setRoundInfoCommand({ 
			phase, 
			startedAt, 
			isOvertime: true 
		}));
		
		yield* delay(OVERTIME_DURATION * 1000);
		battleTimeoutDeferred.resolve();
	});

	uniqueMatches.forEach((m) => {
		if (callbacks.onMatchStart) {
			callbacks.onMatchStart();
		}

		m.fight(battleTimeoutDeferred.promise).then(() => {
			if (callbacks.onMatchEnd) {
				callbacks.onMatchEnd();
			}
		});
	});

	yield Promise.all(finishMatchTasks.map((t) => t.toPromise()));
	yield* cancel(overtimeTask);

	// some battles go right up to the end, so it's nice to have a delay
	// rather than jumping straight into the next phase
	yield delay(5000);
};
