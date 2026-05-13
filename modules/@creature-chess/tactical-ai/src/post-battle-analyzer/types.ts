import { PieceModel } from "@creature-chess/models";

export type IssueSeverity = "critical" | "major" | "minor";

export interface Issue {
  type: string;
  severity: IssueSeverity;
  description: string;
  relatedPieceIds: string[];
  suggestion: string;
}

export interface Recommendation {
  category: "positioning" | "items" | "synergy" | "economy";
  priority: number;
  description: string;
  guideReference?: string;
}

export interface BattleAnalysis {
  winner: "win" | "loss" | "draw";
  summary: string;
  issues: Issue[];
  recommendations: Recommendation[];
  stats: {
    totalDamageDealt: number;
    totalDamageTaken: number;
    avgTurnsSurvived: number;
    carryDamageShare: number;
    tankSurvivalRate: number;
  };
}

export interface BattleReplayData {
  myPieces: PieceModel[];
  enemyPieces: PieceModel[];
  result: "win" | "loss" | "draw";
  roundNumber: number;
}
