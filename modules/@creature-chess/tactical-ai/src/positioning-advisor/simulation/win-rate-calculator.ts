import { BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";

import { BattleOutcome, ScenarioResult } from "../types";
import { runBattle } from "./battle-runner";
import { EnemyScenario } from "./scenario-generator";

export interface FormationTestResult {
  scenarioResults: ScenarioResult[];
  avgWinRate: number;
  avgSurvivorMargin: number;
  variance: number;
}

export const testFormation = (
  myBoard: BoardState<PieceModel>,
  scenarios: EnemyScenario[],
  trialsPerScenario: number
): FormationTestResult => {
  const scenarioResults: ScenarioResult[] = [];
  const allWinRates: number[] = [];

  for (const scenario of scenarios) {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalSurvivorMargin = 0;
    let totalHpMargin = 0;

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
    variance,
  };
};
