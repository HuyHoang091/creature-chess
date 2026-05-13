import { BoardSelectors, BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";
import { PPOAgent } from "@creature-chess/rl-bot/src/agent/ppoAgent";
import { StateEncoder } from "@creature-chess/rl-bot/src/environment/stateEncoder";
import { ActionDecoder } from "@creature-chess/rl-bot/src/environment/actionDecoder";

import {
  PositioningAdvice,
  FormationCandidate,
  PieceMove,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from "./types";
import { generateEnemyScenarios } from "./simulation/scenario-generator";
import { testFormation } from "./simulation/win-rate-calculator";
import { pickBestStrategy } from "./strategy-picker";

const applyBoardMove = (
  board: BoardState<PieceModel>,
  pieceId: string,
  targetX: number,
  targetY: number
): BoardState<PieceModel> => {
  const from = BoardSelectors.getPiecePosition(board, pieceId);
  if (!from) return board;

  const targetKey = `${targetX},${targetY}`;
  const fromKey = `${from.x},${from.y}`;
  const targetPieceId = board.piecePositions[targetKey];
  const piecePositions = { ...board.piecePositions };

  if (targetPieceId) {
    piecePositions[fromKey] = targetPieceId;
  } else {
    delete piecePositions[fromKey];
  }

  piecePositions[targetKey] = pieceId;

  return {
    ...board,
    piecePositions,
  };
};

const generateFormation = (
  board: BoardState<PieceModel>,
  agent: PPOAgent,
  encoder: StateEncoder,
  decoder: ActionDecoder
): { formationName: string; adjustmentName: string; moves: PieceMove[]; resultBoard: BoardState<PieceModel> } => {
  const rlState = encoder.encode(board);
  const { action } = agent.act(rlState);
  let nextBoard = board;
  const moves: PieceMove[] = [];

  for (const move of decoder.decodeAction(action, nextBoard)) {
    nextBoard = applyBoardMove(nextBoard, move.pieceId, move.targetX, move.targetY);
    moves.push({ pieceId: move.pieceId, targetX: move.targetX, targetY: move.targetY });
  }

  for (const move of decoder.applyAdjustment(action, nextBoard)) {
    nextBoard = applyBoardMove(nextBoard, move.pieceId, move.targetX, move.targetY);
    moves.push({ pieceId: move.pieceId, targetX: move.targetX, targetY: move.targetY });
  }

  return {
    formationName: action.payload.formation || "standard",
    adjustmentName: action.payload.adjustment || "none",
    moves,
    resultBoard: nextBoard,
  };
};

export class PositioningAdvisor {
  private agent: PPOAgent;
  private encoder: StateEncoder;
  private decoder: ActionDecoder;
  private config: SimulationConfig;
  private modelLoaded = false;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
    this.agent = new PPOAgent({ temperature: 0.8 });
    this.encoder = new StateEncoder();
    this.decoder = new ActionDecoder();
  }

  async loadModel(modelPath: string): Promise<void> {
    await this.agent.loadModel(modelPath);
    this.modelLoaded = true;
  }

  isReady(): boolean {
    return this.modelLoaded;
  }

  getAdvice(
    myBoard: BoardState<PieceModel>,
    enemyBoard: BoardState<PieceModel>
  ): PositioningAdvice | null {
    if (!this.modelLoaded) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    console.log(`[Advisor] getAdvice called — myBoard pieces=${Object.keys(myBoard.pieces).length}, enemyBoard pieces=${Object.keys(enemyBoard.pieces).length}`);

    const scenarios = generateEnemyScenarios(
      enemyBoard,
      this.config.numScenarios
    );

    console.log(`[Advisor] Generated ${scenarios.length} enemy scenarios`);

    const candidates: FormationCandidate[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < this.config.numFormations * 2 && candidates.length < this.config.numFormations; i++) {
      const formation = generateFormation(
        myBoard,
        this.agent,
        this.encoder,
        this.decoder
      );

      const key = `${formation.formationName}:${formation.adjustmentName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const testResult = testFormation(
        formation.resultBoard,
        scenarios,
        this.config.trialsPerScenario
      );

      console.log(`[Advisor] Formation ${key}: avgWinRate=${testResult.avgWinRate}, avgSurvivorMargin=${testResult.avgSurvivorMargin}, variance=${testResult.variance}`);

      candidates.push({
        formationName: formation.formationName,
        adjustmentName: formation.adjustmentName,
        moves: formation.moves,
        scenarioResults: testResult.scenarioResults,
        avgWinRate: testResult.avgWinRate,
        avgSurvivorMargin: testResult.avgSurvivorMargin,
        variance: testResult.variance,
      });
    }

    const advice = pickBestStrategy(candidates, this.config);
    console.log(`[Advisor] pickBestStrategy returned: ${advice ? `formation=${advice.formation}, winRate=${advice.winRate}, confidence=${advice.confidence}` : "null"}`);

    return advice;
  }
}
