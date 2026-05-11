import { PieceModel } from "@creature-chess/models";
import { BoardSelectors } from "@shoki/board";
import { FormationAction } from "../types";

/**
 * Decodes RL formation actions into actual game piece movements
 * Converts formation archetypes into specific piece placements
 */
export class ActionDecoder {
  private boardSize = 8;

  /**
   * Decode formation action into specific piece positions
   */
  decodeAction(action: FormationAction, myBoard: any): { pieceId: string; targetX: number; targetY: number }[] {
    const pieces = BoardSelectors.getAllPieces(myBoard);
    const pieceList = pieces.filter(p => p !== null) as PieceModel[];
    let moves: { pieceId: string; targetX: number; targetY: number }[];

    switch (action.payload.formation) {
      case 'tank_front':
        moves = this.applyTankFrontFormation(pieceList);
        break;
      case 'spread_backline':
        moves = this.applySpreadBacklineFormation(pieceList);
        break;
      case 'anti_jump':
        moves = this.applyAntiJumpFormation(pieceList);
        break;
      case 'focus_corner':
        moves = this.applyFocusCornerFormation(pieceList);
        break;
      case 'protect_left':
        moves = this.applyProtectLeftFormation(pieceList);
        break;
      case 'assassin_flank':
        moves = this.applyAssassinFlankFormation(pieceList);
        break;
      case 'standard':
      default:
        moves = this.applyStandardFormation(pieceList);
        break;
    }

    return this.clampMoves(moves, myBoard);
  }

  /**
   * Apply small tactical adjustments on top of formation
   */
  applyAdjustment(action: FormationAction, myBoard: any): { pieceId: string; targetX: number; targetY: number }[] {
    const pieces = BoardSelectors.getAllPieces(myBoard);
    const pieceList = pieces.filter(p => p !== null) as PieceModel[];
    let moves: { pieceId: string; targetX: number; targetY: number }[];

    switch (action.payload.adjustment) {
      case 'protect_carry':
        moves = this.adjustProtectCarry(pieceList, myBoard);
        break;
      case 'reposition_tank':
        moves = this.adjustRepositionTank(pieceList, myBoard);
        break;
      case 'flank_assassin':
        moves = this.adjustFlankAssassin(pieceList, myBoard);
        break;
      case 'consolidate_support':
        moves = this.adjustConsolidateSupport(pieceList, myBoard);
        break;
      case 'counter_assassin':
        moves = this.adjustCounterAssassin(pieceList, myBoard);
        break;
      default:
        moves = [];
        break;
    }

    return this.clampMoves(moves, myBoard);
  }

  private clampMoves(
    moves: { pieceId: string; targetX: number; targetY: number }[],
    board: any
  ): { pieceId: string; targetX: number; targetY: number }[] {
    const maxX = Math.max(0, (board?.size?.width ?? this.boardSize) - 1);
    const maxY = Math.max(0, (board?.size?.height ?? this.boardSize) - 1);

    return moves.map((move) => ({
      ...move,
      targetX: Math.max(0, Math.min(move.targetX, maxX)),
      targetY: Math.max(0, Math.min(move.targetY, maxY)),
    }));
  }

  // Formation implementations
  private applyTankFrontFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];
    let tankCount = 0;

    for (const piece of pieces) {
      const role = this.getPieceRole(piece);
      if (role === 'tank') {
        // Place tanks in front row (y = 0, 1)
        const targetX = Math.min(tankCount, 7);
        const targetY = tankCount < 4 ? 0 : 1;
        moves.push({ pieceId: piece.id, targetX, targetY });
        tankCount++;
      }
    }

    // Place carries behind tanks
    let carryCount = 0;
    for (const piece of pieces) {
      const role = this.getPieceRole(piece);
      if (role === 'carry') {
        const targetX = Math.min(carryCount, 7);
        const targetY = 2 + Math.floor(carryCount / 8);
        moves.push({ pieceId: piece.id, targetX, targetY });
        carryCount++;
      }
    }

    return moves;
  }

  private applySpreadBacklineFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];
    let carryCount = 0;

    for (const piece of pieces) {
      const role = this.getPieceRole(piece);
      if (role === 'carry' || role === 'support') {
        // Spread carries and supports across backline
        const targetX = carryCount * 2; // Spread out
        const targetY = 7; // Back row
        moves.push({ pieceId: piece.id, targetX: Math.min(targetX, 7), targetY });
        carryCount++;
      }
    }

    return moves;
  }

  private applyAntiJumpFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Place units in corners and edges to prevent assassin jumps
    const cornerPositions = [
      { x: 0, y: 0 }, { x: 7, y: 0 },
      { x: 0, y: 7 }, { x: 7, y: 7 }
    ];

    let posIndex = 0;
    for (const piece of pieces) {
      if (posIndex < cornerPositions.length) {
        moves.push({
          pieceId: piece.id,
          targetX: cornerPositions[posIndex].x,
          targetY: cornerPositions[posIndex].y
        });
        posIndex++;
      }
    }

    return moves;
  }

  private applyFocusCornerFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Focus all units in one corner for concentrated damage
    let count = 0;
    for (const piece of pieces) {
      const targetX = count % 4;
      const targetY = Math.floor(count / 4);
      moves.push({ pieceId: piece.id, targetX, targetY });
      count++;
    }

    return moves;
  }

  private applyProtectLeftFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Identify carry and place it on left side with protection
    const carry = pieces.find(p => this.getPieceRole(p) === 'carry');
    if (carry) {
      moves.push({ pieceId: carry.id, targetX: 0, targetY: 3 });
    }

    // Place tanks to the right of carry
    let tankCount = 0;
    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'tank' && piece.id !== carry?.id) {
        moves.push({ pieceId: piece.id, targetX: 1 + tankCount, targetY: 3 });
        tankCount++;
      }
    }

    return moves;
  }

  private applyAssassinFlankFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Place assassins on the edges to flank enemy
    let assassinCount = 0;
    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'assassin') {
        const targetX = assassinCount % 2 === 0 ? 0 : 7; // Left or right edge
        const targetY = Math.floor(assassinCount / 2);
        moves.push({ pieceId: piece.id, targetX, targetY });
        assassinCount++;
      }
    }

    return moves;
  }

  private applyStandardFormation(pieces: PieceModel[]): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Simple balanced formation
    let count = 0;
    for (const piece of pieces) {
      const targetX = count % 8;
      const targetY = Math.floor(count / 8);
      moves.push({ pieceId: piece.id, targetX, targetY });
      count++;
    }

    return moves;
  }

  // Adjustment implementations
  private adjustProtectCarry(pieces: PieceModel[], board: any): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Find carry and place support/tank adjacent
    const carry = pieces.find(p => this.getPieceRole(p) === 'carry');
    if (!carry) return moves;

    const carryPos = BoardSelectors.getPiecePosition(board, carry.id);
    if (!carryPos) return moves;

    // Move support next to carry
    const support = pieces.find(p => this.getPieceRole(p) === 'support');
    if (support) {
      moves.push({
        pieceId: support.id,
        targetX: carryPos.x + 1,
        targetY: carryPos.y
      });
    }

    return moves;
  }

  private adjustRepositionTank(pieces: PieceModel[], board: any): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Move tanks to front if they're not there
    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'tank') {
        const pos = BoardSelectors.getPiecePosition(board, piece.id);
        if (pos && pos.y > 1) {
          moves.push({ pieceId: piece.id, targetX: pos.x, targetY: 0 });
        }
      }
    }

    return moves;
  }

  private adjustFlankAssassin(pieces: PieceModel[], board: any): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Move assassins to edges for flanking
    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'assassin') {
        const pos = BoardSelectors.getPiecePosition(board, piece.id);
        if (pos && pos.x > 1 && pos.x < 6) {
          const targetX = pos.x < 4 ? 0 : 7;
          moves.push({ pieceId: piece.id, targetX, targetY: pos.y });
        }
      }
    }

    return moves;
  }

  private adjustConsolidateSupport(pieces: PieceModel[], board: any): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Move supports near carries for buffs
    const carry = pieces.find(p => this.getPieceRole(p) === 'carry');
    if (!carry) return moves;

    const carryPos = BoardSelectors.getPiecePosition(board, carry.id);
    if (!carryPos) return moves;

    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'support') {
        moves.push({
          pieceId: piece.id,
          targetX: carryPos.x + 1,
          targetY: carryPos.y
        });
      }
    }

    return moves;
  }

  private adjustCounterAssassin(pieces: PieceModel[], board: any): { pieceId: string; targetX: number; targetY: number }[] {
    const moves: { pieceId: string; targetX: number; targetY: number }[] = [];

    // Place units to protect against enemy assassins
    // (Simplified: place tanks on edges)
    for (const piece of pieces) {
      if (this.getPieceRole(piece) === 'tank') {
        const pos = BoardSelectors.getPiecePosition(board, piece.id);
        if (pos && pos.x > 2 && pos.x < 5) {
          moves.push({ pieceId: piece.id, targetX: 0, targetY: pos.y });
        }
      }
    }

    return moves;
  }

  // Helper method to determine piece role
  private getPieceRole(piece: PieceModel): string {
    // This would ideally use the same logic as the state encoder
    // For now, simplified based on definition ID ranges
    const id = piece.definitionId;

    // Simplified role classification based on creature IDs
    // This is a heuristic and should be improved with actual stats
    if ([3, 4, 9, 10, 19, 20, 29, 30, 39, 40].includes(id)) return 'tank';
    if ([5, 6, 11, 12, 21, 22, 31, 32, 41, 42, 47].includes(id)) return 'carry';
    if ([2, 4, 10, 13, 17, 19, 21, 25, 29, 34, 40, 44, 46].includes(id)) return 'assassin';
    return 'support';
  }
}
