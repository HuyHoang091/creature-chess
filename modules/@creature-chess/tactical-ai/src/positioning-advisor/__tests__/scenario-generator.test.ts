import { BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";
import { generateEnemyScenarios } from "../simulation/scenario-generator";

const createTestBoard = (): BoardState<PieceModel> => ({
  id: "test",
  pieces: {
    p1: {
      id: "p1", ownerId: "AWAY", definitionId: 1, definition: {} as any,
      traits: ["fire"], items: [], stage: 0, facingAway: false,
      maxHealth: 100, currentHealth: 100, maxMana: 100, currentMana: 0,
      lastBattleStats: null,
    } as PieceModel,
    p2: {
      id: "p2", ownerId: "AWAY", definitionId: 2, definition: {} as any,
      traits: ["water"], items: [], stage: 0, facingAway: false,
      maxHealth: 100, currentHealth: 100, maxMana: 100, currentMana: 0,
      lastBattleStats: null,
    } as PieceModel,
    p3: {
      id: "p3", ownerId: "AWAY", definitionId: 3, definition: {} as any,
      traits: ["earth"], items: [], stage: 0, facingAway: false,
      maxHealth: 100, currentHealth: 100, maxMana: 100, currentMana: 0,
      lastBattleStats: null,
    } as PieceModel,
  },
  piecePositions: {
    "0,0": "p1",
    "1,0": "p2",
    "2,0": "p3",
  },
  locked: false,
  pieceLimit: null,
  size: { width: 7, height: 3 },
});

describe("Scenario Generator", () => {
  test("generates requested number of scenarios", () => {
    const board = createTestBoard();
    const scenarios = generateEnemyScenarios(board, 4);

    expect(scenarios.length).toBe(4);
    expect(scenarios[0].name).toBe("baseline");
  });

  test("baseline scenario preserves original board", () => {
    const board = createTestBoard();
    const scenarios = generateEnemyScenarios(board, 4);

    const baseline = scenarios.find((s) => s.name === "baseline");
    expect(baseline).toBeDefined();
    expect(baseline!.board.piecePositions).toEqual(board.piecePositions);
  });

  test("swap_positions scenario changes positions", () => {
    const board = createTestBoard();
    const scenarios = generateEnemyScenarios(board, 4);

    const swapped = scenarios.find((s) => s.name.startsWith("swap_positions"));
    if (swapped) {
      expect(swapped.board.piecePositions).not.toEqual(board.piecePositions);
    }
  });

  test("generated boards preserve piece count", () => {
    const board = createTestBoard();
    const scenarios = generateEnemyScenarios(board, 4);

    for (const scenario of scenarios) {
      const pieceCount = Object.keys(scenario.board.pieces).length;
      expect(pieceCount).toBe(Object.keys(board.pieces).length);
    }
  });
});
