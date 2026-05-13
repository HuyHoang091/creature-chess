import { detectIssues } from "../issue-detector";
import { BattleReplayData } from "../types";

const makePiece = (
  id: string,
  definitionId: number,
  items: any[] = [],
  stats?: any
): any => ({
  id,
  ownerId: "player1",
  definitionId,
  definition: { name: `Creature ${definitionId}` },
  traits: [],
  items,
  stage: 1,
  lastBattleStats: stats || null,
});

describe("Issue Detector", () => {
  test("detects carry died first", () => {
    const data: BattleReplayData = {
      myPieces: [
        makePiece("c1", 12, [], { damageDealt: 100, damageTaken: 500, turnsSurvived: 10 }),
        makePiece("t1", 2, [], { damageDealt: 50, damageTaken: 200, turnsSurvived: 80 }),
      ],
      enemyPieces: [],
      result: "loss",
      roundNumber: 3,
    };

    const issues = detectIssues(data);
    const issue = issues.find((i) => i.type === "carry_died_first");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("critical");
  });

  test("detects no frontline", () => {
    const data: BattleReplayData = {
      myPieces: [
        makePiece("c1", 12, [], { damageDealt: 200, damageTaken: 300, turnsSurvived: 20 }),
        makePiece("c2", 15, [], { damageDealt: 180, damageTaken: 250, turnsSurvived: 25 }),
      ],
      enemyPieces: [],
      result: "loss",
      roundNumber: 3,
    };

    const issues = detectIssues(data);
    const issue = issues.find((i) => i.type === "no_frontline");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("critical");
  });

  test("detects carry without items", () => {
    const data: BattleReplayData = {
      myPieces: [
        makePiece("c1", 12, [], { damageDealt: 150, damageTaken: 200, turnsSurvived: 30 }),
        makePiece("t1", 2, [], { damageDealt: 50, damageTaken: 150, turnsSurvived: 70 }),
      ],
      enemyPieces: [],
      result: "loss",
      roundNumber: 3,
    };

    const issues = detectIssues(data);
    const issue = issues.find((i) => i.type === "carry_ungeared");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("major");
  });

  test("detects low damage output", () => {
    const data: BattleReplayData = {
      myPieces: [
        makePiece("p1", 5, [], { damageDealt: 30, damageTaken: 100, turnsSurvived: 20 }),
        makePiece("p2", 8, [], { damageDealt: 40, damageTaken: 90, turnsSurvived: 22 }),
      ],
      enemyPieces: [],
      result: "loss",
      roundNumber: 3,
    };

    const issues = detectIssues(data);
    const issue = issues.find((i) => i.type === "low_damage_output");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("major");
  });

  test("detects enemy assassins", () => {
    const data: BattleReplayData = {
      myPieces: [
        makePiece("c1", 12, [], { damageDealt: 100, damageTaken: 300, turnsSurvived: 15 }),
      ],
      enemyPieces: [
        makePiece("a1", 26, [], null),
        makePiece("a2", 27, [], null),
        makePiece("a3", 28, [], null),
      ],
      result: "loss",
      roundNumber: 3,
    };

    const issues = detectIssues(data);
    const issue = issues.find((i) => i.type === "assassin_weakness");
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("major");
  });
});
