import {
  FormationCandidate,
  PositioningAdvice,
  SimulationConfig,
  DEFAULT_SIMULATION_CONFIG,
} from "./types";

const getConfidence = (
  winRate: number,
  variance: number
): "low" | "medium" | "high" => {
  if (variance > 0.1 || winRate < 0.45) return "low";
  if (variance > 0.05 || winRate < 0.55) return "medium";
  return "high";
};

const generateExplanation = (candidate: FormationCandidate): string => {
  const wrPercent = (candidate.avgWinRate * 100).toFixed(0);
  const margin = candidate.avgSurvivorMargin.toFixed(1);
  return `Formation "${candidate.formationName}" + "${candidate.adjustmentName}": tỷ lệ thắng ${wrPercent}%, trung bình sống sót hơn đối thủ ${margin} quân`;
};

export const pickBestStrategy = (
  candidates: FormationCandidate[],
  config: SimulationConfig = DEFAULT_SIMULATION_CONFIG
): PositioningAdvice | null => {
  if (candidates.length === 0) return null;

  const viable = candidates.filter(
    (c) => c.avgWinRate >= config.minWinRate && c.avgWinRate <= config.maxWinRate
  );

  if (viable.length === 0) {
    const sorted = [...candidates].sort(
      (a, b) => b.avgWinRate - a.avgWinRate
    );
    const best = sorted[0];

    return {
      formation: best.formationName,
      adjustment: best.adjustmentName,
      winRate: best.avgWinRate,
      avgSurvivorMargin: best.avgSurvivorMargin,
      confidence: getConfidence(best.avgWinRate, best.variance),
      moves: best.moves,
      explanation: generateExplanation(best),
      alternatives: sorted.slice(1, 4).map((c) => ({
        formation: c.formationName,
        winRate: c.avgWinRate,
      })),
      testedScenarios: best.scenarioResults.length,
    };
  }

  const balanced = viable.filter(
    (c) =>
      c.avgWinRate >= config.targetMinWinRate &&
      c.avgWinRate <= config.targetMaxWinRate
  );

  const pool = balanced.length > 0 ? balanced : viable;

  const sorted = [...pool].sort((a, b) => {
    if (Math.abs(a.variance - b.variance) > 0.01) {
      return a.variance - b.variance;
    }
    return b.avgWinRate - a.avgWinRate;
  });

  const best = sorted[0];
  const allSorted = [...candidates].sort(
    (a, b) => b.avgWinRate - a.avgWinRate
  );

  return {
    formation: best.formationName,
    adjustment: best.adjustmentName,
    winRate: best.avgWinRate,
    avgSurvivorMargin: best.avgSurvivorMargin,
    confidence: getConfidence(best.avgWinRate, best.variance),
    moves: best.moves,
    explanation: generateExplanation(best),
    alternatives: allSorted
      .filter((c) => c !== best)
      .slice(0, 3)
      .map((c) => ({
        formation: c.formationName,
        winRate: c.avgWinRate,
      })),
    testedScenarios: best.scenarioResults.length,
  };
};
