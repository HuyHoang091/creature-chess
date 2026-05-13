import fs from "fs";
import path from "path";

import {
  BoardSelectors,
  BoardState,
  createBoardSlice,
  mergeBoards,
} from "@shoki/board";

import { getStats } from "@creature-chess/battle";
import { simulateTurn } from "@creature-chess/battle/src/simulator/turnSimulator";
import { PieceCombatState } from "@creature-chess/battle/src/state/state";
import { pieceInfoStore } from "@creature-chess/battle/src/state/store";
import { isATeamDefeated } from "@creature-chess/battle/src/utils/isATeamDefeated";
import { getDefinitionById } from "@creature-chess/gamemode";
import { Builders, PieceModel } from "@creature-chess/models";
import {
  GamemodeSettings,
  GamemodeSettingsPresets,
} from "@creature-chess/models/settings";

import { PPOAgent } from "./agent/ppoAgent";
import { ActionDecoder } from "./environment/actionDecoder";
import { StateEncoder } from "./environment/stateEncoder";

type PieceSeed = {
  id: string;
  definitionId: number;
  stage: number;
  x: number;
  y: number;
};

type BattleCase = {
  name: string;
  home: PieceSeed[];
  away: PieceSeed[];
};

type StrategyName = "rule_default" | "rl_model";

type SampleResult = {
  caseName: string;
  controlledSide: "home" | "away";
  strategy: StrategyName;
  winner: "controlled" | "opponent" | "draw";
  survivorMargin: number;
  hpMargin: number;
  survivorsControlled: number;
  survivorsOpponent: number;
};

type StrategySummary = {
  strategy: StrategyName;
  samples: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  drawRate: number;
  avgSurvivorMargin: number;
  avgHpMargin: number;
  stompRate: number;
  bestWinMargin: number | null;
  leastBadLossMargin: number | null;
  worstLossMargin: number | null;
};

const settings: GamemodeSettings = {
  ...GamemodeSettingsPresets.default,
  battleTurnCount: 180,
  battleTurnDuration: 1,
};

const battleCases: BattleCase[] = [
  {
    name: "carry_exposed_frontline",
    home: [
      { id: "h1", definitionId: 42, stage: 1, x: 0, y: 0 },
      { id: "h2", definitionId: 47, stage: 1, x: 1, y: 0 },
      { id: "h3", definitionId: 40, stage: 1, x: 2, y: 2 },
      { id: "h4", definitionId: 29, stage: 1, x: 3, y: 2 },
      { id: "h5", definitionId: 13, stage: 1, x: 4, y: 1 },
      { id: "h6", definitionId: 46, stage: 1, x: 5, y: 1 },
    ],
    away: [
      { id: "a1", definitionId: 39, stage: 1, x: 1, y: 0 },
      { id: "a2", definitionId: 20, stage: 1, x: 2, y: 0 },
      { id: "a3", definitionId: 41, stage: 1, x: 2, y: 2 },
      { id: "a4", definitionId: 43, stage: 1, x: 3, y: 2 },
      { id: "a5", definitionId: 25, stage: 1, x: 5, y: 1 },
      { id: "a6", definitionId: 27, stage: 1, x: 4, y: 2 },
    ],
  },
  {
    name: "clumped_left_side",
    home: [
      { id: "h1", definitionId: 31, stage: 1, x: 0, y: 2 },
      { id: "h2", definitionId: 41, stage: 1, x: 1, y: 2 },
      { id: "h3", definitionId: 30, stage: 1, x: 0, y: 1 },
      { id: "h4", definitionId: 39, stage: 1, x: 1, y: 1 },
      { id: "h5", definitionId: 44, stage: 1, x: 0, y: 0 },
      { id: "h6", definitionId: 27, stage: 1, x: 1, y: 0 },
    ],
    away: [
      { id: "a1", definitionId: 20, stage: 1, x: 2, y: 0 },
      { id: "a2", definitionId: 29, stage: 1, x: 4, y: 0 },
      { id: "a3", definitionId: 42, stage: 1, x: 2, y: 2 },
      { id: "a4", definitionId: 47, stage: 1, x: 4, y: 2 },
      { id: "a5", definitionId: 13, stage: 1, x: 5, y: 1 },
      { id: "a6", definitionId: 46, stage: 1, x: 1, y: 1 },
    ],
  },
  {
    name: "anti_assassin_backline",
    home: [
      { id: "h1", definitionId: 42, stage: 1, x: 2, y: 0 },
      { id: "h2", definitionId: 47, stage: 1, x: 4, y: 0 },
      { id: "h3", definitionId: 20, stage: 1, x: 1, y: 2 },
      { id: "h4", definitionId: 39, stage: 1, x: 5, y: 2 },
      { id: "h5", definitionId: 27, stage: 1, x: 3, y: 1 },
      { id: "h6", definitionId: 31, stage: 1, x: 6, y: 1 },
    ],
    away: [
      { id: "a1", definitionId: 13, stage: 1, x: 1, y: 1 },
      { id: "a2", definitionId: 25, stage: 1, x: 3, y: 1 },
      { id: "a3", definitionId: 34, stage: 1, x: 5, y: 1 },
      { id: "a4", definitionId: 46, stage: 1, x: 2, y: 2 },
      { id: "a5", definitionId: 29, stage: 1, x: 2, y: 0 },
      { id: "a6", definitionId: 41, stage: 1, x: 4, y: 0 },
    ],
  },
  {
    name: "carry_exposed_frontline",
    home: [
      { id: "h1", definitionId: 42, stage: 1, x: 0, y: 0 },
      { id: "h2", definitionId: 47, stage: 1, x: 1, y: 0 },
      { id: "h3", definitionId: 40, stage: 1, x: 2, y: 2 },
      { id: "h4", definitionId: 29, stage: 1, x: 3, y: 2 },
      { id: "h5", definitionId: 13, stage: 1, x: 4, y: 1 },
      { id: "h6", definitionId: 46, stage: 1, x: 5, y: 1 },
    ],
    away: [
      { id: "a1", definitionId: 39, stage: 1, x: 1, y: 0 },
      { id: "a2", definitionId: 20, stage: 1, x: 2, y: 0 },
      { id: "a3", definitionId: 41, stage: 1, x: 2, y: 2 },
      { id: "a4", definitionId: 43, stage: 1, x: 3, y: 2 },
      { id: "a5", definitionId: 25, stage: 1, x: 5, y: 1 },
      { id: "a6", definitionId: 27, stage: 1, x: 4, y: 2 },
    ],
  },
  {
    name: "clumped_left_side",
    home: [
      { id: "h1", definitionId: 31, stage: 1, x: 0, y: 2 },
      { id: "h2", definitionId: 41, stage: 1, x: 1, y: 2 },
      { id: "h3", definitionId: 30, stage: 1, x: 0, y: 1 },
      { id: "h4", definitionId: 39, stage: 1, x: 1, y: 1 },
      { id: "h5", definitionId: 44, stage: 1, x: 0, y: 0 },
      { id: "h6", definitionId: 27, stage: 1, x: 1, y: 0 },
    ],
    away: [
      { id: "a1", definitionId: 20, stage: 1, x: 2, y: 0 },
      { id: "a2", definitionId: 29, stage: 1, x: 4, y: 0 },
      { id: "a3", definitionId: 42, stage: 1, x: 2, y: 2 },
      { id: "a4", definitionId: 47, stage: 1, x: 4, y: 2 },
      { id: "a5", definitionId: 13, stage: 1, x: 5, y: 1 },
      { id: "a6", definitionId: 46, stage: 1, x: 1, y: 1 },
    ],
  },
  {
    name: "anti_assassin_backline",
    home: [
      { id: "h1", definitionId: 42, stage: 1, x: 2, y: 0 },
      { id: "h2", definitionId: 47, stage: 1, x: 4, y: 0 },
      { id: "h3", definitionId: 20, stage: 1, x: 1, y: 2 },
      { id: "h4", definitionId: 39, stage: 1, x: 5, y: 2 },
      { id: "h5", definitionId: 27, stage: 1, x: 3, y: 1 },
      { id: "h6", definitionId: 31, stage: 1, x: 6, y: 1 },
    ],
    away: [
      { id: "a1", definitionId: 13, stage: 1, x: 1, y: 1 },
      { id: "a2", definitionId: 25, stage: 1, x: 3, y: 1 },
      { id: "a3", definitionId: 34, stage: 1, x: 5, y: 1 },
      { id: "a4", definitionId: 46, stage: 1, x: 2, y: 2 },
      { id: "a5", definitionId: 29, stage: 1, x: 2, y: 0 },
      { id: "a6", definitionId: 41, stage: 1, x: 4, y: 0 },
    ],
  },

  // === CÁC TEST CASE MỚI (ĐÃ SỬA STAGE) ===

//   // 1. Đội hình đối xứng hoàn hảo
//   {
//     name: "symmetric_formation",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 0, y: 0 },
//       { id: "h2", definitionId: 47, stage: 0, x: 1, y: 0 },
//       { id: "h3", definitionId: 40, stage: 0, x: 2, y: 0 },
//       { id: "h4", definitionId: 29, stage: 0, x: 0, y: 2 },
//       { id: "h5", definitionId: 13, stage: 0, x: 1, y: 2 },
//       { id: "h6", definitionId: 46, stage: 0, x: 2, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 42, stage: 0, x: 0, y: 0 },
//       { id: "a2", definitionId: 47, stage: 0, x: 1, y: 0 },
//       { id: "a3", definitionId: 40, stage: 0, x: 2, y: 0 },
//       { id: "a4", definitionId: 29, stage: 0, x: 0, y: 2 },
//       { id: "a5", definitionId: 13, stage: 0, x: 1, y: 2 },
//       { id: "a6", definitionId: 46, stage: 0, x: 2, y: 2 },
//     ],
//   },

//   // 2. Chênh lệch số lượng quân (đã sửa stage 1 -> 0)
//   {
//     name: "outnumbered",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 2, y: 1 },
//       { id: "h2", definitionId: 47, stage: 0, x: 3, y: 1 },
//       { id: "h3", definitionId: 40, stage: 0, x: 2, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 39, stage: 0, x: 0, y: 0 },
//       { id: "a2", definitionId: 20, stage: 0, x: 1, y: 0 },
//       { id: "a3", definitionId: 41, stage: 0, x: 2, y: 0 },
//       { id: "a4", definitionId: 43, stage: 0, x: 3, y: 0 },
//       { id: "a5", definitionId: 25, stage: 0, x: 4, y: 0 },
//       { id: "a6", definitionId: 27, stage: 0, x: 5, y: 0 },
//       { id: "a7", definitionId: 13, stage: 0, x: 0, y: 2 },
//       { id: "a8", definitionId: 46, stage: 0, x: 5, y: 2 },
//     ],
//   },

//   // 3. Tất cả quân đứng 1 hàng
//   {
//     name: "single_row_battle",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 0, y: 1 },
//       { id: "h2", definitionId: 47, stage: 0, x: 1, y: 1 },
//       { id: "h3", definitionId: 40, stage: 0, x: 2, y: 1 },
//       { id: "h4", definitionId: 29, stage: 0, x: 3, y: 1 },
//       { id: "h5", definitionId: 13, stage: 0, x: 4, y: 1 },
//     ],
//     away: [
//       { id: "a1", definitionId: 39, stage: 0, x: 0, y: 1 },
//       { id: "a2", definitionId: 20, stage: 0, x: 1, y: 1 },
//       { id: "a3", definitionId: 41, stage: 0, x: 2, y: 1 },
//       { id: "a4", definitionId: 43, stage: 0, x: 3, y: 1 },
//       { id: "a5", definitionId: 25, stage: 0, x: 4, y: 1 },
//     ],
//   },

//   // 4. Tập trung 1 góc (corner clump)
//   {
//     name: "corner_clump_top_left",
//     home: [
//       { id: "h1", definitionId: 31, stage: 0, x: 0, y: 0 },
//       { id: "h2", definitionId: 41, stage: 0, x: 0, y: 1 },
//       { id: "h3", definitionId: 30, stage: 0, x: 0, y: 2 },
//       { id: "h4", definitionId: 39, stage: 0, x: 1, y: 0 },
//       { id: "h5", definitionId: 44, stage: 0, x: 1, y: 1 },
//       { id: "h6", definitionId: 27, stage: 0, x: 1, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 20, stage: 0, x: 4, y: 0 },
//       { id: "a2", definitionId: 29, stage: 0, x: 5, y: 1 },
//       { id: "a3", definitionId: 42, stage: 0, x: 3, y: 2 },
//       { id: "a4", definitionId: 47, stage: 0, x: 4, y: 2 },
//       { id: "a5", definitionId: 13, stage: 0, x: 5, y: 2 },
//     ],
//   },

//   // 5. Tất cả cùng stage (đã sửa tất cả về stage 0)
//   {
//     name: "mixed_stages",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 1, y: 0 },
//       { id: "h2", definitionId: 47, stage: 0, x: 3, y: 0 },
//       { id: "h3", definitionId: 40, stage: 0, x: 2, y: 2 },
//       { id: "h4", definitionId: 29, stage: 0, x: 4, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 39, stage: 0, x: 1, y: 1 },
//       { id: "a2", definitionId: 20, stage: 0, x: 2, y: 1 },
//       { id: "a3", definitionId: 41, stage: 0, x: 3, y: 1 },
//       { id: "a4", definitionId: 43, stage: 0, x: 4, y: 1 },
//     ],
//   },

//   // 6. Tất cả quân đứng lẻ tẻ (sparse formation)
//   {
//     name: "sparse_formation",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 0, y: 0 },
//       { id: "h2", definitionId: 47, stage: 0, x: 5, y: 0 },
//       { id: "h3", definitionId: 40, stage: 0, x: 0, y: 2 },
//       { id: "h4", definitionId: 29, stage: 0, x: 5, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 39, stage: 0, x: 2, y: 1 },
//       { id: "a2", definitionId: 20, stage: 0, x: 3, y: 1 },
//     ],
//   },

//   // 7. Đội hình phòng thủ dạng lưới
//   {
//     name: "grid_defense",
//     home: [
//       { id: "h1", definitionId: 31, stage: 0, x: 0, y: 0 },
//       { id: "h2", definitionId: 41, stage: 0, x: 2, y: 0 },
//       { id: "h3", definitionId: 30, stage: 0, x: 4, y: 0 },
//       { id: "h4", definitionId: 39, stage: 0, x: 1, y: 1 },
//       { id: "h5", definitionId: 44, stage: 0, x: 3, y: 1 },
//       { id: "h6", definitionId: 27, stage: 0, x: 0, y: 2 },
//       { id: "h7", definitionId: 13, stage: 0, x: 2, y: 2 },
//       { id: "h8", definitionId: 46, stage: 0, x: 4, y: 2 },
//     ],
//     away: [
//       { id: "a1", definitionId: 42, stage: 0, x: 1, y: 0 },
//       { id: "a2", definitionId: 47, stage: 0, x: 3, y: 0 },
//       { id: "a3", definitionId: 20, stage: 0, x: 1, y: 2 },
//       { id: "a4", definitionId: 29, stage: 0, x: 3, y: 2 },
//       { id: "a5", definitionId: 25, stage: 0, x: 2, y: 1 },
//     ],
//   },

//   // 8. Boss fight (đã sửa stage 3 -> 0)
//   {
//     name: "boss_fight",
//     home: [
//       { id: "h1", definitionId: 42, stage: 0, x: 2, y: 1 },
//     ],
//     away: [
//       { id: "a1", definitionId: 39, stage: 0, x: 0, y: 0 },
//       { id: "a2", definitionId: 20, stage: 0, x: 1, y: 0 },
//       { id: "a3", definitionId: 41, stage: 0, x: 3, y: 0 },
//       { id: "a4", definitionId: 43, stage: 0, x: 4, y: 0 },
//       { id: "a5", definitionId: 25, stage: 0, x: 1, y: 2 },
//       { id: "a6", definitionId: 27, stage: 0, x: 3, y: 2 },
//     ],
//   },

//   // 9. All ranged vs all melee
//   {
//     name: "ranged_vs_melee",
//     home: [
//       { id: "h1", definitionId: 13, stage: 0, x: 0, y: 1 },
//       { id: "h2", definitionId: 13, stage: 0, x: 1, y: 1 },
//       { id: "h3", definitionId: 13, stage: 0, x: 2, y: 1 },
//       { id: "h4", definitionId: 13, stage: 0, x: 3, y: 1 },
//     ],
//     away: [
//       { id: "a1", definitionId: 42, stage: 0, x: 2, y: 0 },
//       { id: "a2", definitionId: 47, stage: 0, x: 1, y: 2 },
//       { id: "a3", definitionId: 40, stage: 0, x: 2, y: 2 },
//       { id: "a4", definitionId: 29, stage: 0, x: 3, y: 2 },
//     ],
//   },

//   // 10. Empty board edge case
//   {
//     name: "empty_board_vs_full",
//     home: [],
//     away: [
//       { id: "a1", definitionId: 42, stage: 0, x: 2, y: 1 },
//       { id: "a2", definitionId: 47, stage: 0, x: 3, y: 1 },
//     ],
//   },
];

const makePiece = (ownerId: string, seed: PieceSeed): PieceModel => {
  const definition = getDefinitionById(seed.definitionId);

  if (!definition) {
    throw new Error(`Definition ${seed.definitionId} not found`);
  }

  return Builders.buildPieceModel({
    id: seed.id,
    ownerId,
    definitionId: definition.id,
    definition,
    traits: definition.traits,
    items: [],
    stage: seed.stage,
    facingAway: false,
    maxHealth: definition.stages[seed.stage].hp,
    currentHealth: definition.stages[seed.stage].hp,
    maxMana: definition.stages[seed.stage].maxMana || 100,
    currentMana: 0,
    lastBattleStats: null,
  });
};

const buildPlayerBoard = (
  boardId: string,
  ownerId: string,
  seeds: PieceSeed[]
): BoardState<PieceModel> => ({
  id: boardId,
  pieces: Object.fromEntries(seeds.map((seed) => [seed.id, makePiece(ownerId, seed)])),
  piecePositions: Object.fromEntries(seeds.map((seed) => [`${seed.x},${seed.y}`, seed.id])),
  locked: false,
  pieceLimit: null,
  size: {
    width: settings.boardWidth,
    height: settings.boardHalfHeight,
  },
});

const applyBoardMove = (
  board: BoardState<PieceModel>,
  pieceId: string,
  targetX: number,
  targetY: number
): BoardState<PieceModel> => {
  const from = BoardSelectors.getPiecePosition(board, pieceId);
  if (!from) {
    return board;
  }

  const targetKey = `${targetX},${targetY}`;
  const fromKey = `${from.x},${from.y}`;
  const targetPieceId = board.piecePositions[targetKey];
  const piecePositions = { ...board.piecePositions };

  if (targetPieceId) {
    piecePositions[fromKey] = targetPieceId;
  } else {
    delete piecePositions[fromKey];
  }

  piecePositions[targetKey] = pieceId;

  return {
    ...board,
    piecePositions,
  };
};

const applyRlStrategy = (
  board: BoardState<PieceModel>,
  agent: PPOAgent,
  encoder: StateEncoder,
  decoder: ActionDecoder
): BoardState<PieceModel> => {
  const rlState = encoder.encode(board);
  const { action } = agent.act(rlState);
  let nextBoard = board;

  for (const move of decoder.decodeAction(action, nextBoard)) {
    nextBoard = applyBoardMove(nextBoard, move.pieceId, move.targetX, move.targetY);
  }

  for (const move of decoder.applyAdjustment(action, nextBoard)) {
    nextBoard = applyBoardMove(nextBoard, move.pieceId, move.targetX, move.targetY);
  }

  return nextBoard;
};

const prepareBattleBoard = (
  homeBoard: BoardState<PieceModel>,
  awayBoard: BoardState<PieceModel>
): BoardState<PieceModel> => {
  const mergedBoard = mergeBoards("fixed-benchmark", homeBoard, awayBoard);

  return {
    ...mergedBoard,
    pieces: Object.fromEntries(
      Object.entries(mergedBoard.pieces).map(([pieceId, piece]) => {
        const stats = getStats(piece);
        return [
          pieceId,
          {
            ...piece,
            facingAway: piece.ownerId === "HOME",
            maxHealth: stats.hp,
            currentHealth: stats.hp,
            currentMana: "startingMana" in stats ? (stats as any).startingMana : 0,
            lastBattleStats: {
              damageDealt: 0,
              damageTaken: 0,
              turnsSurvived: 0,
            },
          },
        ];
      })
    ),
  };
};

const runBattle = (
  homeBoard: BoardState<PieceModel>,
  awayBoard: BoardState<PieceModel>
) => {
  const boardSlice = createBoardSlice<PieceModel>("fixed-benchmark-slice", {
    width: settings.boardWidth,
    height: settings.boardHalfHeight * 2,
  });

  const combatStore = pieceInfoStore<PieceCombatState>({
    state: { type: "wandering" },
    canMoveAtTurn: 15,
    canBeAttackedAtTurn: 0,
    canAttackAtTurn: 15,
  });

  let board = prepareBattleBoard(homeBoard, awayBoard);
  let turn = 0;

  while (turn < settings.battleTurnCount && !isATeamDefeated(board)) {
    turn += 1;
    board = simulateTurn(turn, board, boardSlice, { combatStore });
  }

  const livingPieces = BoardSelectors.getAllPieces(board).filter((piece) => piece.currentHealth > 0);
  const homeLiving = livingPieces.filter((piece) => piece.ownerId === "HOME");
  const awayLiving = livingPieces.filter((piece) => piece.ownerId === "AWAY");
  const homeHp = homeLiving.reduce((sum, piece) => sum + piece.currentHealth, 0);
  const awayHp = awayLiving.reduce((sum, piece) => sum + piece.currentHealth, 0);

  return {
    board,
    survivors: {
      HOME: homeLiving.length,
      AWAY: awayLiving.length,
    },
    hp: {
      HOME: homeHp,
      AWAY: awayHp,
    },
  };
};

const summarize = (strategy: StrategyName, samples: SampleResult[]): StrategySummary => {
  const wins = samples.filter((sample) => sample.winner === "controlled").length;
  const losses = samples.filter((sample) => sample.winner === "opponent").length;
  const draws = samples.filter((sample) => sample.winner === "draw").length;
  const winMargins = samples.filter((sample) => sample.survivorMargin > 0).map((sample) => sample.survivorMargin);
  const lossMargins = samples.filter((sample) => sample.survivorMargin < 0).map((sample) => sample.survivorMargin);

  return {
    strategy,
    samples: samples.length,
    wins,
    losses,
    draws,
    winRate: samples.length > 0 ? wins / samples.length : 0,
    drawRate: samples.length > 0 ? draws / samples.length : 0,
    avgSurvivorMargin:
      samples.length > 0
        ? samples.reduce((sum, sample) => sum + sample.survivorMargin, 0) / samples.length
        : 0,
    avgHpMargin:
      samples.length > 0
        ? samples.reduce((sum, sample) => sum + sample.hpMargin, 0) / samples.length
        : 0,
    stompRate:
      samples.length > 0
        ? samples.filter((sample) => sample.survivorMargin >= 3).length / samples.length
        : 0,
    bestWinMargin: winMargins.length > 0 ? Math.max(...winMargins) : null,
    leastBadLossMargin: lossMargins.length > 0 ? Math.max(...lossMargins) : null,
    worstLossMargin: lossMargins.length > 0 ? Math.min(...lossMargins) : null,
  };
};

const formatSummary = (summary: StrategySummary) => ({
  strategy: summary.strategy,
  samples: summary.samples,
  winRate: `${(summary.winRate * 100).toFixed(1)}%`,
  drawRate: `${(summary.drawRate * 100).toFixed(1)}%`,
  avgSurvivorMargin: summary.avgSurvivorMargin.toFixed(2),
  avgHpMargin: summary.avgHpMargin.toFixed(2),
  stompRate: `${(summary.stompRate * 100).toFixed(1)}%`,
  bestWinMargin: summary.bestWinMargin ?? "-",
  leastBadLossMargin: summary.leastBadLossMargin ?? "-",
  worstLossMargin: summary.worstLossMargin ?? "-",
});

const resolveModelPath = () => {
  const packageRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(packageRoot, "..", "..", "..");
  const configuredPath = process.env.RL_MODEL_PATH || "training/models/final";

  const candidates = path.isAbsolute(configuredPath)
    ? [configuredPath]
    : [
        path.resolve(packageRoot, configuredPath),
        path.resolve(repoRoot, configuredPath),
        path.resolve(process.cwd(), configuredPath),
        path.resolve(packageRoot, "training/models/final"),
        path.resolve(repoRoot, "modules/@creature-chess/rl-bot/training/models/final"),
      ];

  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) || fs.existsSync(`${candidate}.json`)
  );

  return resolved || candidates[0];
};

describe("Fixed battle benchmark", () => {
  jest.setTimeout(120000);

  test("compares RL positioning against default rule layout on preset armies", async () => {
    const modelPath = resolveModelPath();

    const agent = new PPOAgent({ temperature: Number(process.env.RL_TEMPERATURE || 0.3) });
    await agent.loadModel(modelPath);

    const encoder = new StateEncoder();
    const decoder = new ActionDecoder();
    const rlSamples: SampleResult[] = [];
    const ruleSamples: SampleResult[] = [];
    const trialsPerCase = Number(process.env.FIXED_BATTLE_TRIALS || 30);

    for (const battleCase of battleCases) {
      for (const controlledSide of ["home", "away"] as const) {
        for (let trial = 0; trial < trialsPerCase; trial++) {
          const baseHome = buildPlayerBoard(`${battleCase.name}-home`, "HOME", battleCase.home);
          const baseAway = buildPlayerBoard(`${battleCase.name}-away`, "AWAY", battleCase.away);

          const ruleHome = baseHome;
          const ruleAway = baseAway;
          const rlHome = controlledSide === "home"
            ? applyRlStrategy(baseHome, agent, encoder, decoder)
            : baseHome;
          const rlAway = controlledSide === "away"
            ? applyRlStrategy(baseAway, agent, encoder, decoder)
            : baseAway;

          const ruleResult = runBattle(ruleHome, ruleAway);
          const rlResult = runBattle(rlHome, rlAway);

          const toSample = (
            strategy: StrategyName,
            result: ReturnType<typeof runBattle>
          ): SampleResult => {
            const controlledOwner = controlledSide === "home" ? "HOME" : "AWAY";
            const opponentOwner = controlledOwner === "HOME" ? "AWAY" : "HOME";
            const survivorMargin = result.survivors[controlledOwner] - result.survivors[opponentOwner];
            const hpMargin = result.hp[controlledOwner] - result.hp[opponentOwner];
            const winner = survivorMargin > 0
              ? "controlled"
              : survivorMargin < 0
                ? "opponent"
                : hpMargin > 0
                  ? "controlled"
                  : hpMargin < 0
                    ? "opponent"
                    : "draw";

            return {
              caseName: battleCase.name,
              controlledSide,
              strategy,
              winner,
              survivorMargin,
              hpMargin,
              survivorsControlled: result.survivors[controlledOwner],
              survivorsOpponent: result.survivors[opponentOwner],
            };
          };

          ruleSamples.push(toSample("rule_default", ruleResult));
          rlSamples.push(toSample("rl_model", rlResult));
        }
      }
    }

    const ruleSummary = summarize("rule_default", ruleSamples);
    const rlSummary = summarize("rl_model", rlSamples);

    console.table([formatSummary(ruleSummary), formatSummary(rlSummary)]);

    expect(ruleSummary.samples).toBeGreaterThan(0);
    expect(rlSummary.samples).toBe(ruleSummary.samples);
    expect(rlSummary.bestWinMargin === null || rlSummary.bestWinMargin >= 0).toBe(true);
    expect(ruleSummary.worstLossMargin === null || ruleSummary.worstLossMargin < 0).toBe(true);
  });
});
