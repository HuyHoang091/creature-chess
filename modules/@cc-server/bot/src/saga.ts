import delay from "delay";
import { all, call, takeLatest, put, select } from "typed-redux-saga";

import {
	PlayerEvents,
	GameEvents,
	PlayerState,
} from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";

import { BotPersonality } from "@cc-server/data";

import { preparingPhase } from "./preparingPhase";

// Import RL bot sagas (optional, will fallback if module not available)
let rlTrainingSaga: any = null;
let runRlPreparingPhase: any = null;

try {
	const rlModule = require("@creature-chess/rl-bot");
	rlTrainingSaga = rlModule.rlTrainingSaga;
	runRlPreparingPhase = rlModule.runRlPreparingPhase;
} catch (error) {
	console.warn("RL Bot module not available, using rule-based bot only");
}

const getRlTrainingConfig = () => {
	const saveInterval = Number(process.env.SAVE_INTERVAL);
	const batchSize = Number(process.env.RL_BATCH_SIZE || process.env.TRAINING_BATCH_SIZE);
	const temperature = Number(process.env.RL_TEMPERATURE);

	return {
		...(Number.isFinite(saveInterval) && saveInterval > 0 ? { saveInterval } : {}),
		...(Number.isFinite(batchSize) && batchSize > 0 ? { batchSize } : {}),
		...(Number.isFinite(temperature) && temperature > 0 ? { temperature } : {}),
	};
};

export const botLogicSaga = function* (personality: BotPersonality) {
	const botMode = process.env.BOT_MODE || 'rule_based';
	const rlConfig = getRlTrainingConfig();
	const useRl =
		(botMode === 'rl' || botMode === 'hybrid') &&
		rlTrainingSaga &&
		runRlPreparingPhase;

	const phaseSaga = function* () {
		yield takeLatest<GameEvents.GamePhaseStartedEvent>(
			GameEvents.gamePhaseStartedEvent,
			function* ({ payload: { phase } }) {
				const state: PlayerState = yield select();

				if (state.playerInfo.health <= 0) {
					return;
				}

				yield delay(1000);

				if (phase === GamePhase.PREPARING) {
					if (useRl) {
						yield call(preparingPhase, personality, true);
						yield call(runRlPreparingPhase, rlConfig);
					} else {
						if (botMode !== 'rule_based') {
							console.warn(`Bot mode '${botMode}' not available, falling back to rule-based`);
						}
						yield call(preparingPhase, personality);
					}
				} else if (phase === GamePhase.PLAYING) {
					yield put(PlayerEvents.clientFinishMatchEvent());
				}
			}
		);
	};

	yield all([
		call(phaseSaga),
		...(useRl ? [call(rlTrainingSaga, rlConfig)] : []),
	]);
};
