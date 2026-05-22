import { BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { BattleOutcome, ScenarioResult } from "../types";
import { runBattle } from "./battle-runner";
import { EnemyScenario } from "./scenario-generator";

export interface FormationTestResult {
	scenarioResults: ScenarioResult[];
	avgWinRate: number;
	avgSurvivorMargin: number;
	avgHomeSurvivalRate: number;
	avgEnemyEliminationRate: number;
	preservationScore: number;
	variance: number;
}

const getPreservationScore = (
	homeSurvivalRate: number,
	enemyEliminationRate: number
): number => homeSurvivalRate * 0.4 + enemyEliminationRate * 0.6;

export const testFormation = (
	myBoard: BoardState<PieceModel>,
	scenarios: EnemyScenario[],
	trialsPerScenario: number
): FormationTestResult => {
	const scenarioResults: ScenarioResult[] = [];
	const allWinRates: number[] = [];
	const homePieceCount = Math.max(Object.keys(myBoard.pieces).length, 1);

	for (const scenario of scenarios) {
		let wins = 0;
		let losses = 0;
		let draws = 0;
		let totalSurvivorMargin = 0;
		let totalHpMargin = 0;
		let totalHomeSurvivalRate = 0;
		let totalEnemyEliminationRate = 0;
		const awayPieceCount = Math.max(
			Object.keys(scenario.board.pieces).length,
			1
		);

		for (let t = 0; t < trialsPerScenario; t++) {
			const outcome: BattleOutcome = runBattle(myBoard, scenario.board);

			if (outcome.winner === "home") {
				wins++;
			} else if (outcome.winner === "away") {
				losses++;
			} else {
				draws++;
			}

			totalSurvivorMargin += outcome.survivorMargin;
			totalHpMargin += outcome.hpMargin;
			totalHomeSurvivalRate += outcome.homeSurvivors / homePieceCount;
			totalEnemyEliminationRate += 1 - outcome.awaySurvivors / awayPieceCount;
		}

		const winRate = wins / trialsPerScenario;
		allWinRates.push(winRate);

		scenarioResults.push({
			scenarioName: scenario.name,
			wins,
			losses,
			draws,
			avgSurvivorMargin: totalSurvivorMargin / trialsPerScenario,
			avgHpMargin: totalHpMargin / trialsPerScenario,
			avgHomeSurvivalRate: totalHomeSurvivalRate / trialsPerScenario,
			avgEnemyEliminationRate: totalEnemyEliminationRate / trialsPerScenario,
		});
	}

	const avgWinRate =
		allWinRates.length > 0
			? allWinRates.reduce((a, b) => a + b, 0) / allWinRates.length
			: 0;

	const avgSurvivorMargin =
		scenarioResults.length > 0
			? scenarioResults.reduce((sum, r) => sum + r.avgSurvivorMargin, 0) /
				scenarioResults.length
			: 0;
	const avgHomeSurvivalRate =
		scenarioResults.length > 0
			? scenarioResults.reduce((sum, r) => sum + r.avgHomeSurvivalRate, 0) /
				scenarioResults.length
			: 0;
	const avgEnemyEliminationRate =
		scenarioResults.length > 0
			? scenarioResults.reduce((sum, r) => sum + r.avgEnemyEliminationRate, 0) /
				scenarioResults.length
			: 0;

	const mean = avgWinRate;
	const variance =
		allWinRates.length > 1
			? allWinRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
				(allWinRates.length - 1)
			: 0;

	return {
		scenarioResults,
		avgWinRate,
		avgSurvivorMargin,
		avgHomeSurvivalRate,
		avgEnemyEliminationRate,
		preservationScore: getPreservationScore(
			avgHomeSurvivalRate,
			avgEnemyEliminationRate
		),
		variance,
	};
};
