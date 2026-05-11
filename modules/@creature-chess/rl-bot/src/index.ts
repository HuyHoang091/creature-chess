/**
 * RL Bot Module for Creature Chess
 * Provides PPO-based positioning optimization for game bots
 */

// Core types
export type {
  TacticalRLState,
  FormationAction,
  CombatState,
  Trajectory,
  TrainingConfig,
  ModelVersion,
  TrainingMetrics,
  OpponentType,
  OpponentConfig,
  AugmentedGameState
} from "./types";

// Agent
export { PPOAgent } from "./agent/ppoAgent";

// Environment
export { StateEncoder } from "./environment/stateEncoder";
export { ActionDecoder } from "./environment/actionDecoder";

// Training
export { RewardCalculator } from "./training/rewardCalculator";

// Integration
export {
  rlBotSaga,
  hybridBotSaga,
  rlTrainingSaga,
  runRlPreparingPhase,
} from "./integration/rlBotSaga";

// Monitoring (placeholder for now)
export class TrainingMonitor {
  logEpisode(episode: number, metrics: any): void {
    console.log(`Episode ${episode}:`, metrics);
  }

  logValidation(episode: number, metrics: any): void {
    console.log(`Validation at episode ${episode}:`, metrics);
  }

  saveTrainingHistory(episode: number, version: string): void {
    console.log(`Saved model version ${version} at episode ${episode}`);
  }
}
