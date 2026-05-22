import { PieceModel } from "@creature-chess/models";

export interface PieceMove {
	pieceId: string;
	targetX: number;
	targetY: number;
}

export interface BattleOutcome {
	winner: "home" | "away" | "draw";
	survivorMargin: number;
	hpMargin: number;
	homeSurvivors: number;
	awaySurvivors: number;
}

export interface ScenarioResult {
	scenarioName: string;
	wins: number;
	losses: number;
	draws: number;
	avgSurvivorMargin: number;
	avgHpMargin: number;
	avgHomeSurvivalRate: number;
	avgEnemyEliminationRate: number;
}

export interface FormationCandidate {
	formationName: string;
	adjustmentName: string;
	moves: PieceMove[];
	scenarioResults: ScenarioResult[];
	avgWinRate: number;
	avgSurvivorMargin: number;
	avgHomeSurvivalRate: number;
	avgEnemyEliminationRate: number;
	preservationScore: number;
	variance: number;
}

export interface PositioningAdvice {
	formation: string;
	adjustment: string;
	winRate: number;
	avgSurvivorMargin: number;
	confidence: "low" | "medium" | "high";
	moves: PieceMove[];
	explanation: string;
	alternatives: Array<{ formation: string; winRate: number }>;
	testedScenarios: number;
	opponentBreakdown?: Array<{
		label: string;
		winRate: number;
		avgSurvivorMargin: number;
		testedScenarios: number;
	}>;
}

export interface SimulationConfig {
	numFormations: number;
	numScenarios: number;
	trialsPerScenario: number;
	minWinRate: number;
	maxWinRate: number;
	targetMinWinRate: number;
	targetMaxWinRate: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
	numFormations: 5,
	numScenarios: 4,
	trialsPerScenario: 10,
	minWinRate: 0.4,
	maxWinRate: 0.85,
	targetMinWinRate: 0.55,
	targetMaxWinRate: 0.7,
};
