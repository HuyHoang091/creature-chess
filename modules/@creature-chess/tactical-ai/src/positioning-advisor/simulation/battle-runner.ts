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
import { PieceModel } from "@creature-chess/models";
import {
  GamemodeSettings,
  GamemodeSettingsPresets,
} from "@creature-chess/models/settings";

import { BattleOutcome } from "../types";

const BATTLE_SETTINGS: GamemodeSettings = {
  ...GamemodeSettingsPresets.default,
  battleTurnCount: 180,
  battleTurnDuration: 1,
};

const getFirstOwnerId = (board: BoardState<PieceModel>): string | null => {
  const pieces = Object.values(board.pieces);
  return pieces.length > 0 ? pieces[0].ownerId : null;
};

const deepClonePiece = (piece: PieceModel): PieceModel =>
  JSON.parse(JSON.stringify(piece));

const prepareBattleBoard = (
  homeBoard: BoardState<PieceModel>,
  awayBoard: BoardState<PieceModel>
): BoardState<PieceModel> => {
  const mergedBoard = mergeBoards("advisor-battle", homeBoard, awayBoard);
  const homePlayerId = getFirstOwnerId(homeBoard);
  const awayPlayerId = getFirstOwnerId(awayBoard);

  return {
    ...mergedBoard,
    piecePositions: { ...mergedBoard.piecePositions },
    pieces: Object.fromEntries(
      Object.entries(mergedBoard.pieces).map(([pieceId, piece]) => {
        const cloned = deepClonePiece(piece);
        const stats = getStats(cloned);
        const isHome = homePlayerId !== null && cloned.ownerId === homePlayerId;
        return [
          pieceId,
          {
            ...cloned,
            ownerId: isHome ? "HOME" : "AWAY",
            facingAway: !isHome,
            maxHealth: stats.hp,
            currentHealth: stats.hp,
            currentMana:
              "startingMana" in stats ? (stats as any).startingMana : 0,
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

export const runBattle = (
  homeBoard: BoardState<PieceModel>,
  awayBoard: BoardState<PieceModel>
): BattleOutcome => {
  const boardSlice = createBoardSlice<PieceModel>("advisor-battle-slice", {
    width: BATTLE_SETTINGS.boardWidth,
    height: BATTLE_SETTINGS.boardHalfHeight * 2,
  });

  const combatStore = pieceInfoStore<PieceCombatState>({
    state: { type: "wandering" },
    canMoveAtTurn: 15,
    canBeAttackedAtTurn: 0,
    canAttackAtTurn: 15,
  });

  let board = prepareBattleBoard(homeBoard, awayBoard);
  let turn = 0;

  while (
    turn < BATTLE_SETTINGS.battleTurnCount &&
    !isATeamDefeated(board)
  ) {
    turn += 1;
    board = simulateTurn(turn, board, boardSlice, { combatStore });
  }

  const livingPieces = BoardSelectors.getAllPieces(board).filter(
    (piece) => piece.currentHealth > 0
  );
  const homeLiving = livingPieces.filter((p) => p.ownerId === "HOME");
  const awayLiving = livingPieces.filter((p) => p.ownerId === "AWAY");
  const homeHp = homeLiving.reduce((sum, p) => sum + p.currentHealth, 0);
  const awayHp = awayLiving.reduce((sum, p) => sum + p.currentHealth, 0);

  const survivorMargin = homeLiving.length - awayLiving.length;
  const hpMargin = homeHp - awayHp;

  let winner: "home" | "away" | "draw";
  if (survivorMargin > 0) {
    winner = "home";
  } else if (survivorMargin < 0) {
    winner = "away";
  } else if (hpMargin > 0) {
    winner = "home";
  } else if (hpMargin < 0) {
    winner = "away";
  } else {
    winner = "draw";
  }

  return {
    winner,
    survivorMargin,
    hpMargin,
    homeSurvivors: homeLiving.length,
    awaySurvivors: awayLiving.length,
  };
};
