import {
	detectLobbyTempo,
	resolveEffectivePreset,
} from "../tempo-heuristic";

describe("tempo heuristic", () => {
	test("detects a fast lobby bleed rate", () => {
		expect(
			detectLobbyTempo([
				{ round: 5, totalLobbyHealth: 400, aliveCount: 8 },
				{ round: 7, totalLobbyHealth: 260, aliveCount: 8 },
			])
		).toBe("fast");
	});

	test("detects a slow lobby bleed rate", () => {
		expect(
			detectLobbyTempo([
				{ round: 5, totalLobbyHealth: 400, aliveCount: 8 },
				{ round: 7, totalLobbyHealth: 380, aliveCount: 8 },
			])
		).toBe("slow");
	});

	test("maps fast tempo to stabilize and slow tempo to economy", () => {
		expect(resolveEffectivePreset("balanced", "fast")).toBe("stabilize");
		expect(resolveEffectivePreset("balanced", "slow")).toBe("economy");
		expect(resolveEffectivePreset("economy", "neutral")).toBe("economy");
	});
});
