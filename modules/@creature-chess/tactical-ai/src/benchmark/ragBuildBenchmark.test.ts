`
$env:RUN_RAG_BUILD_BENCHMARK = "1"
$env:RAG_BUILD_BENCHMARK_GAMES = "2"
$env:RAG_BUILD_BENCHMARK_OUTPUT = "rag-build-benchmark-smoke.json"

yarn jest --config modules/@creature-chess/tactical-ai/jest.config.js modules/@creature-chess/tactical-ai/src/benchmark/ragBuildBenchmark.test.ts --runInBand
`

import { runRagBuildBenchmark } from "./runRagBuildBenchmark";

const shouldRunBenchmark = process.env.RUN_RAG_BUILD_BENCHMARK === "1";
const benchmarkTest = shouldRunBenchmark ? test : test.skip;

describe("RAG build benchmark", () => {
	jest.setTimeout(1000 * 60 * 60 * 6);

	benchmarkTest("runs the isolated 100-game benchmark harness", async () => {
		const summary = await runRagBuildBenchmark();

		expect(summary.completedGames).toBeGreaterThan(0);
		expect(summary.averageRank).toBeGreaterThan(0);
	});

});
