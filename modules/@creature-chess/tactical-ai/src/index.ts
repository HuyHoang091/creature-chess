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
	StrategySelectionMode,
} from "./positioning-advisor/types";
export { DEFAULT_SIMULATION_CONFIG } from "./positioning-advisor/types";

export type { EnemyScenario } from "./positioning-advisor/simulation/scenario-generator";
export type { FormationTestResult } from "./positioning-advisor/simulation/win-rate-calculator";

// Post-Battle Analysis
export { analyzeBattle } from "./post-battle-analyzer/analyzer";
export { detectIssues } from "./post-battle-analyzer/issue-detector";
export type {
	BattleAnalysis,
	Issue,
	Recommendation,
	BattleReplayData,
} from "./post-battle-analyzer/types";

// Cache
export { getCache, hashKey } from "./cache/cache";
export type { CacheProvider } from "./cache/cache";

// Build Advisor
export { createBuildAdviceContext } from "./build-advisor/context";
export type {
	BuildAdviceContext,
	BuildAdvicePlan,
} from "./build-advisor/types";

// Build Auto Player
export { BuildAutoPlayerController } from "./build-auto-player/controller";
export type {
	BuildAutoPlayActivity,
	BuildAutoPlayStatus,
} from "./build-auto-player/controller";
export {
	chooseBuildAutoPlayAction,
	getBuildAutoPlayPresetSettings,
	normalizeBuildAutoPlayPlan,
	normalizeBuildAutoPlayPreset,
} from "./build-auto-player/policy";
export type {
	BuildAutoPlayLevel,
	BuildAutoPlayPreset,
	BuildAutoPlayPresetSettings,
	NormalizedBuildPlan,
} from "./build-auto-player/policy";

// Integration
export { registerTacticalAIEvents } from "./integration/game-server-plugin";
export type {
	TacticalAIPluginDeps,
	PositioningRequest,
	CoachRequest,
	CoachResponse,
} from "./integration/game-server-plugin";
export { getPositioningAdvisor } from "./integration/advisor-instance";
