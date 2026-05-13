import { delay } from "redux-saga/effects";
import { all, takeLatest, put, select, call } from "typed-redux-saga";
import { getVariable } from "@shoki/engine";
import {
  PlayerActions,
  PlayerState,
  PlayerVariables,
  PlayerEvents,
  GameEvents,
} from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";
import { BoardSelectors } from "@shoki/board";

import { PPOAgent } from "../agent/ppoAgent";
import { StateEncoder } from "../environment/stateEncoder";
import { ActionDecoder } from "../environment/actionDecoder";
import { TrainingConfig, FormationAction, TacticalRLState } from "../types";

let sharedAgent: PPOAgent | null = null;
let sharedStateEncoder: StateEncoder | null = null;
let sharedActionDecoder: ActionDecoder | null = null;
let attemptedModelLoad = false;

type PendingExperience = {
  playerKey: string;
  state: TacticalRLState;
  action: FormationAction;
  logProb: number;
  round: number;
};

const pendingExperiences = new Map<string, PendingExperience>();

let totalExperiences = 0;
let totalReward = 0;

function getAgent(config?: Partial<TrainingConfig>): PPOAgent {
  if (!sharedAgent) {
    sharedAgent = new PPOAgent(config);
  }

  return sharedAgent;
}

function getStateEncoder(): StateEncoder {
  if (!sharedStateEncoder) {
    sharedStateEncoder = new StateEncoder();
  }

  return sharedStateEncoder;
}

function getActionDecoder(): ActionDecoder {
  if (!sharedActionDecoder) {
    sharedActionDecoder = new ActionDecoder();
  }

  return sharedActionDecoder;
}

function getModelPath() {
  return process.env.RL_MODEL_PATH || "./training/models/final";
}

function isTrainingEnabled(): boolean {
  return process.env.TRAINING_MODE !== "false";
}

function getCheckpointPath(totalExperiences: number) {
  const path = require("path");
  const modelPath = getModelPath();
  const normalizedModelPath = modelPath.endsWith(".json")
    ? modelPath
    : `${modelPath}.json`;
  const modelDir = path.dirname(normalizedModelPath);

  return path.join(modelDir, "data", `rl_bot_auto_${totalExperiences}`);
}

function* ensureModelLoaded(agent: PPOAgent) {
  if (attemptedModelLoad) {
    return;
  }

  attemptedModelLoad = true;

  const modelPath = getModelPath();
  try {
    yield call(() => agent.loadModel(modelPath));
    console.log(`RL Bot: Loaded model from ${modelPath}`);
  } catch (error) {
    console.warn("RL Bot: Failed to load model, using untrained agent");
  }
}

const getRewardFromMatchResult = ({
  homeScore,
  awayScore,
  isHomePlayer,
}: {
  homeScore: number;
  awayScore: number;
  isHomePlayer: boolean;
}) => {
  const win = isHomePlayer ? homeScore > awayScore : awayScore > homeScore;
  const mySurvivors = isHomePlayer ? homeScore : awayScore;
  const enemySurvivors = isHomePlayer ? awayScore : homeScore;
  const totalPieces = mySurvivors + enemySurvivors;
  const combatMargin = totalPieces > 0
    ? (mySurvivors - enemySurvivors) / totalPieces
    : 0;
  const reward = combatMargin * 2.0 + (win ? 1.0 : -1.0);

  return { win, mySurvivors, enemySurvivors, reward };
};

function* handleMatchReward(
  agent: PPOAgent,
  config: Partial<TrainingConfig> | undefined,
  playerKey: string,
  result: { homeScore: number; awayScore: number; isHomePlayer: boolean }
) {
  const pendingExperience = pendingExperiences.get(playerKey);
  if (!pendingExperience) {
    return;
  }

  const { win, mySurvivors, enemySurvivors, reward } = getRewardFromMatchResult(
    result
  );

  console.log(
    `RL Bot Round ${pendingExperience.round}: win=${win}, my=${mySurvivors}, enemy=${enemySurvivors}, reward=${reward.toFixed(3)}`
  );

  if (!isTrainingEnabled()) {
    console.log(`RL Bot: Training disabled (TRAINING_MODE=false). Skipping experience storage and model update.`);
    pendingExperiences.delete(playerKey);
    return;
  }

  agent.storeExperience(
    pendingExperience.state,
    pendingExperience.action,
    reward,
    pendingExperience.logProb
  );

  totalExperiences++;
  totalReward += reward;
  pendingExperiences.delete(playerKey);

  const effectiveBatchSize = config?.batchSize ?? 32;
  const effectiveSaveInterval = config?.saveInterval ?? 50;

  if (totalExperiences % effectiveBatchSize === 0) {
    console.log(
      `RL Bot: Updating agent after ${totalExperiences} experiences (avg reward: ${(totalReward / totalExperiences).toFixed(3)})`
    );
    agent.update();
  }

  if (totalExperiences % effectiveSaveInterval === 0) {
    // const savePath = getCheckpointPath(totalExperiences);
    // yield call(() => agent.saveModel(savePath));
    // console.log(`RL Bot: Auto-saved model to ${savePath}`);

    const latestModelPath = getModelPath();
    yield call(() => agent.saveModel(latestModelPath));
    console.log(`RL Bot: Updated latest model at ${latestModelPath}`);
  }
}

export function* rlTrainingSaga(config?: Partial<TrainingConfig>) {
  const agent = getAgent(config);
  const playerKey = yield* getVariable<PlayerVariables, string>((v) => v.name);

  yield call(ensureModelLoaded, agent);

  yield takeLatest(
    PlayerEvents.playerFinishMatchEvent,
    function* ({ payload }: { payload: { homeScore: number; awayScore: number; isHomePlayer: boolean } }) {
      yield call(handleMatchReward, agent, config, playerKey, payload);
    }
  );
}

export function* runRlPreparingPhase(config?: Partial<TrainingConfig>) {
  const agent = getAgent(config);
  const stateEncoder = getStateEncoder();
  const actionDecoder = getActionDecoder();
  const name = yield* getVariable<PlayerVariables, string>((v) => v.name);

  yield delay(500);

  const state: PlayerState = yield select();
  const round = state.playerInfo.health > 0
    ? Math.floor(100 - state.playerInfo.health) + 1
    : 1;
  const rlState = stateEncoder.encode(state.board, undefined);
  const { action, logProb } = agent.act(rlState);

  console.log(
    `- ${name} RL Bot [Round ${round}]: formation=${action.payload.formation}, adjustment=${action.payload.adjustment}`
  );

  if (isTrainingEnabled()) {
    pendingExperiences.set(name, {
      playerKey: name,
      state: rlState,
      action,
      logProb,
      round,
    });
  }

  const moves = actionDecoder.decodeAction(action, state.board);
  for (const move of moves) {
    const piece = BoardSelectors.getPiece(state.board, move.pieceId);
    if (!piece) {
      continue;
    }

    const currentPos = BoardSelectors.getPiecePosition(state.board, move.pieceId);
    if (!currentPos) {
      continue;
    }

    yield put(
      PlayerActions.dropPiecePlayerAction({
        pieceId: move.pieceId,
        from: { type: "board", location: currentPos },
        to: { type: "board", location: { x: move.targetX, y: move.targetY } },
      })
    );

    yield delay(100);
  }

  if (action.payload.adjustment) {
    const adjustments = actionDecoder.applyAdjustment(action, state.board);
    for (const adjustment of adjustments) {
      const currentPos = BoardSelectors.getPiecePosition(
        state.board,
        adjustment.pieceId
      );
      if (!currentPos) {
        continue;
      }

      yield put(
        PlayerActions.dropPiecePlayerAction({
          pieceId: adjustment.pieceId,
          from: { type: "board", location: currentPos },
          to: {
            type: "board",
            location: { x: adjustment.targetX, y: adjustment.targetY },
          },
        })
      );

      yield delay(100);
    }
  }

  yield put(PlayerActions.readyUpPlayerAction());
}

export function* rlBotSaga(config?: Partial<TrainingConfig>) {
  yield all([
    call(rlTrainingSaga, config),
    takeLatest(
      GameEvents.gamePhaseStartedEvent,
      function* ({ payload: { phase } }: { payload: { phase: GamePhase } }) {
        const state: PlayerState = yield select();
        if (state.playerInfo.health <= 0) {
          return;
        }

        if (phase === GamePhase.PREPARING) {
          yield call(runRlPreparingPhase, config);
        } else if (phase === GamePhase.PLAYING) {
          yield put(PlayerEvents.clientFinishMatchEvent());
        }
      }
    ),
  ]);
}

export function* hybridBotSaga(config?: Partial<TrainingConfig>) {
  yield call(rlTrainingSaga, config);
}
