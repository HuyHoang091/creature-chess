export { PositioningAdvisor } from "./positioning-advisor/advisor";
export { pickBestStrategy } from "./positioning-advisor/strategy-picker";
export { runBattle } from "./positioning-advisor/simulation/battle-runner";
export { generateEnemyScenarios } from "./positioning-advisor/simulation/scenario-generator";
export { testFormation } from "./positioning-advisor/simulation/win-rate-calculator";

export type {
  PositioningAdvice,
  PieceMove,
  BattleOutcome,
  ScenarioResult,
  FormationCandidate,
  SimulationConfig,
} from "./positioning-advisor/types";
export { DEFAULT_SIMULATION_CONFIG } from "./positioning-advisor/types";

export type { EnemyScenario } from "./positioning-advisor/simulation/scenario-generator";
export type { FormationTestResult } from "./positioning-advisor/simulation/win-rate-calculator";

// Post-Battle Analysis
export { analyzeBattle } from "./post-battle-analyzer/analyzer";
export { detectIssues } from "./post-battle-analyzer/issue-detector";
export type { BattleAnalysis, Issue, Recommendation, BattleReplayData } from "./post-battle-analyzer/types";

// Cache
export { getCache, hashKey } from "./cache/cache";
export type { CacheProvider } from "./cache/cache";

// Integration
export { registerTacticalAIEvents } from "./integration/game-server-plugin";
export type { TacticalAIPluginDeps, PositioningRequest, CoachRequest, CoachResponse } from "./integration/game-server-plugin";
export { getPositioningAdvisor } from "./integration/advisor-instance";
