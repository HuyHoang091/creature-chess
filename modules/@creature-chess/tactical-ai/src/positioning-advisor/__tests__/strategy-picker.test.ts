import { FormationCandidate } from "../types";
import { pickBestStrategy } from "../strategy-picker";

describe("Strategy Picker", () => {
  const makeCandidate = (
    formationName: string,
    avgWinRate: number,
    variance: number
  ): FormationCandidate => ({
    formationName,
    adjustmentName: "none",
    moves: [],
    scenarioResults: [],
    avgWinRate,
    avgSurvivorMargin: avgWinRate * 2,
    variance,
  });

  test("picks balanced formation in target range", () => {
    const candidates = [
      makeCandidate("strong", 0.9, 0.02),
      makeCandidate("balanced", 0.62, 0.03),
      makeCandidate("weak", 0.3, 0.01),
    ];

    const advice = pickBestStrategy(candidates);

    expect(advice).not.toBeNull();
    expect(advice!.formation).toBe("balanced");
    expect(advice!.winRate).toBe(0.62);
    expect(advice!.confidence).toBe("high");
  });

  test("filters out overpowered formations", () => {
    const candidates = [
      makeCandidate("op", 0.95, 0.01),
      makeCandidate("good", 0.65, 0.04),
    ];

    const advice = pickBestStrategy(candidates);

    expect(advice).not.toBeNull();
    expect(advice!.formation).toBe("good");
  });

  test("filters out weak formations", () => {
    const candidates = [
      makeCandidate("bad", 0.2, 0.01),
      makeCandidate("ok", 0.5, 0.05),
    ];

    const advice = pickBestStrategy(candidates);

    expect(advice).not.toBeNull();
    expect(advice!.formation).toBe("ok");
  });

  test("prefers lower variance when win rates are similar", () => {
    const candidates = [
      makeCandidate("stable", 0.6, 0.02),
      makeCandidate("volatile", 0.61, 0.1),
    ];

    const advice = pickBestStrategy(candidates);

    expect(advice).not.toBeNull();
    expect(advice!.formation).toBe("stable");
  });

  test("returns null for empty candidates", () => {
    const advice = pickBestStrategy([]);
    expect(advice).toBeNull();
  });

  test("returns alternatives", () => {
    const candidates = [
      makeCandidate("a", 0.6, 0.03),
      makeCandidate("b", 0.55, 0.04),
      makeCandidate("c", 0.5, 0.05),
    ];

    const advice = pickBestStrategy(candidates);

    expect(advice).not.toBeNull();
    expect(advice!.alternatives.length).toBeGreaterThan(0);
  });
});
