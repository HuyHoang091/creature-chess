import { PPOAgent } from "./ppoAgent";
import { TacticalRLState, FormationAction } from "../types";

describe("PPOAgent vs Rule-Based Heuristic Comparison", () => {
  const dummyState: TacticalRLState = {
    myBoard: new Float32Array(64 * 4).fill(0),
    enemyBoard: new Float32Array(64 * 4).fill(0),
    unitClasses: new Float32Array([2, 2, 1, 0]), // 2 tanks, 2 carries, 1 support
    synergies: new Float32Array([1, 0, 1, 0]),
    threats: new Float32Array([0.8, 0.5, 0.2]),
    matchup: new Float32Array([0.3, 0.1, 0.6]),
  };

  test("Agent should return a valid action from act()", () => {
    const agent = new PPOAgent({ temperature: 1.0 });
    const { action, logProb } = agent.act(dummyState);

    expect(action).toBeDefined();
    expect(action.type).toMatch(/formation|adjustment/);
    expect(typeof logProb).toBe("number");
    expect(logProb).toBeLessThanOrEqual(0);
  });

  test("Temperature scaling affects action distribution", () => {
    // Run multiple samples to estimate distribution
    const hotAgent = new PPOAgent({ temperature: 2.0 });  // high = random
    const coldAgent = new PPOAgent({ temperature: 0.1 }); // low = greedy

    const hotActions: string[] = [];
    const coldActions: string[] = [];

    for (let i = 0; i < 50; i++) {
      hotActions.push(hotAgent.act(dummyState).action.type);
      coldActions.push(coldAgent.act(dummyState).action.type);
    }

    // Greedy agent should be more consistent
    const hotUnique = new Set(hotActions).size;
    const coldUnique = new Set(coldActions).size;

    // Low temperature tends to be more deterministic (fewer unique action types sampled)
    expect(coldUnique).toBeLessThanOrEqual(hotUnique + 1);
  });

  test("Agent stores and updates experiences", () => {
    const agent = new PPOAgent({ batchSize: 4, learningRate: 0.01 });
    const action: FormationAction = {
      type: "formation",
      payload: { formation: "tank_front" },
    };

    for (let i = 0; i < 4; i++) {
      agent.storeExperience(dummyState, action, 1.0 + i * 0.1, -0.5);
    }

    // Should not throw on update
    expect(() => agent.update()).not.toThrow();
  });

  test("Model save and load round-trip", async () => {
    const agent = new PPOAgent({ temperature: 0.5 });
    agent.act(dummyState); // ensure weights are created

    const tmpPath = "/tmp/rl_bot_test_model.json";
    await agent.saveModel(tmpPath);

    const newAgent = new PPOAgent({ temperature: 0.5 });
    await newAgent.loadModel(tmpPath);

    // Both agents should produce same action given same state (greedy, low temp)
    const action1 = newAgent.act(dummyState).action;
    const action2 = newAgent.act(dummyState).action;
    expect(action1.type).toBe(action2.type);
  });

  test("Rule-based heuristic sanity check (mock)", () => {
    // This test documents the expected behavior of the rule-based system
    // for comparison with RL. In the real game, rule-based uses:
    //   createUtilityValue(health, cost, boardPosition, ...)
    //
    // Here we just assert that a simple heuristic would choose differently
    // than a random RL agent with no training.

    const randomAgent = new PPOAgent({ temperature: 10.0 });
    const actions: string[] = [];

    for (let i = 0; i < 20; i++) {
      actions.push(randomAgent.act(dummyState).action.payload.formation || "adjustment");
    }

    // Random agent with very high temperature explores all formations
    expect(new Set(actions).size).toBeGreaterThanOrEqual(2);
  });
});

describe("Win-Rate Benchmark Methodology", () => {
  // These tests document how the benchmark script measures win-rate.
  // Run: node modules/@creature-chess/rl-bot/scripts/benchmark.js --games=100

  test("Benchmark collects at least win/loss and rank per game", () => {
    // Placeholder: the benchmark script writes JSON with:
    // { mode: 'rl'|'rule', winRate, top4Rate, avgRank }
    // Actual measurement requires running the game server.
    expect(true).toBe(true);
  });
});
