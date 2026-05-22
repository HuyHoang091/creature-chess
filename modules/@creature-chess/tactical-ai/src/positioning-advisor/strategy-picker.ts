import {
	FormationCandidate,
	PositioningAdvice,
	SimulationConfig,
	DEFAULT_SIMULATION_CONFIG,
} from "./types";

const getConfidence = (
	candidate: FormationCandidate,
	candidates: FormationCandidate[]
): "low" | "medium" | "high" => {
	const runnerUp = [...candidates]
		.filter((item) => item !== candidate)
		.sort(compareByPreservation)[0];
	const preservationLead = runnerUp
		? candidate.preservationScore - runnerUp.preservationScore
		: candidate.preservationScore;

	if (candidate.variance > 0.08) return "low";
	if (
		candidate.variance <= 0.04 &&
		(candidate.preservationScore >= 0.58 ||
			(candidate.preservationScore >= 0.35 && preservationLead >= 0.08))
	) {
		return "high";
	}
	if (
		candidate.variance <= 0.08 &&
		(candidate.preservationScore >= 0.45 || preservationLead >= 0.04)
	) {
		return "medium";
	}
	if (candidate.avgWinRate >= 0.55 && candidate.variance <= 0.04)
		return "medium";
	return "low";
};

const compareByPreservation = (
	a: FormationCandidate,
	b: FormationCandidate
): number => {
	if (Math.abs(a.preservationScore - b.preservationScore) > 0.02) {
		return b.preservationScore - a.preservationScore;
	}
	if (Math.abs(a.avgSurvivorMargin - b.avgSurvivorMargin) > 0.05) {
		return b.avgSurvivorMargin - a.avgSurvivorMargin;
	}
	if (Math.abs(a.variance - b.variance) > 0.01) {
		return a.variance - b.variance;
	}
	return b.avgWinRate - a.avgWinRate;
};

const compareBalancedCandidates = (
	a: FormationCandidate,
	b: FormationCandidate
): number => {
	if (Math.abs(a.variance - b.variance) > 0.01) {
		return a.variance - b.variance;
	}
	return compareByPreservation(a, b);
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
		(c) =>
			c.avgWinRate >= config.minWinRate && c.avgWinRate <= config.maxWinRate
	);

	if (viable.length === 0) {
		const sorted = [...candidates].sort(compareByPreservation);
		const best = sorted[0];

		return {
			formation: best.formationName,
			adjustment: best.adjustmentName,
			winRate: best.avgWinRate,
			avgSurvivorMargin: best.avgSurvivorMargin,
			confidence: getConfidence(best, candidates),
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

	const sorted = [...pool].sort(compareBalancedCandidates);

	const best = sorted[0];
	const allSorted = [...candidates].sort(compareByPreservation);

	return {
		formation: best.formationName,
		adjustment: best.adjustmentName,
		winRate: best.avgWinRate,
		avgSurvivorMargin: best.avgSurvivorMargin,
		confidence: getConfidence(best, candidates),
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
