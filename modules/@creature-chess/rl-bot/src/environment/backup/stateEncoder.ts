// import { PieceModel } from "@creature-chess/models";
// import { getDefinitionById } from "@creature-chess/gamemode";
// import { BoardSelectors } from "@shoki/board";
// import { TacticalRLState } from "../types";

// /**
//  * Converts game state to RL state representation
//  * Focuses on tactical positioning data only (no economy info)
//  */
// export class StateEncoder {
//   private boardSize = 8;
//   private channels = 4; // creatureId, level, range, role

//   encode(myBoard: any, enemyBoard?: any): TacticalRLState {
//     return {
//       myBoard: this.encodeBoard(myBoard),
//       enemyBoard: this.encodeBoard(enemyBoard),
//       unitClasses: this.encodeUnitClasses(myBoard),
//       synergies: this.encodeSynergies(myBoard),
//       threats: this.encodeThreats(myBoard, enemyBoard),
//       matchup: this.encodeMatchup(myBoard, enemyBoard)
//     };
//   }

//   private encodeBoard(board?: any): Float32Array {
//     if (!board) return new Float32Array(this.boardSize * this.boardSize * this.channels);

//     const boardArray = new Float32Array(this.boardSize * this.boardSize * this.channels);
//     const pieces = BoardSelectors.getAllPieces(board);

//     for (const piece of pieces) {
//       if (!piece) continue;

//       const typedPiece = piece as PieceModel;
//       const position = BoardSelectors.getPiecePosition(board, typedPiece.id);
//       if (!position) continue;

//       const { x, y } = position;
//       if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) continue;

//       const index = (y * this.boardSize + x) * this.channels;
//       const definition = getDefinitionById((piece as PieceModel).definitionId);

//       if (definition) {
//         const stageIndex = Math.min((piece as PieceModel).stage - 1, definition.stages.length - 1);
//         const stageStats = definition.stages[stageIndex];

//         // Encode piece data
//         boardArray[index] = (piece as PieceModel).definitionId / 100; // Normalize creature ID
//         boardArray[index + 1] = (piece as PieceModel).stage / 3; // Normalize level (max 3)
//         boardArray[index + 2] = (stageStats?.attackType?.range || 1) / 3; // Normalize range
//         boardArray[index + 3] = this.encodeRole(stageStats); // Role encoding
//       }
//     }

//     return boardArray;
//   }

//   private encodeRole(stats: any): number {
//     // Simple role classification based on stats
//     const hp = stats?.hp || 100;
//     const attack = stats?.attack || 10;
//     const defense = stats?.defense || 10;

//     if (hp > 500 && defense > 20) return 0.0; // tank
//     if (attack > 30) return 0.3; // carry
//     if (hp < 200 && attack > 25) return 0.6; // assassin
//     return 0.9; // support
//   }

//   private encodeUnitClasses(board: any): Float32Array {
//     const classes = new Float32Array(4); // tank, carry, assassin, support

//     const pieces = BoardSelectors.getAllPieces(board);
//     for (const piece of pieces) {
//       if (!piece) continue;

//       const definition = getDefinitionById((piece as PieceModel).definitionId);
//       if (!definition) continue;

//       const stageIndex = Math.min((piece as PieceModel).stage - 1, definition.stages.length - 1);
//       const stageStats = definition.stages[stageIndex];

//       const role = this.getRole(stageStats);
//       if (role >= 0 && role < 4) {
//         classes[role] += 1;
//       }
//     }

//     // Normalize
//     const total = classes.reduce((a, b) => a + b, 0);
//     if (total > 0) {
//       for (let i = 0; i < classes.length; i++) {
//         classes[i] /= total;
//       }
//     }

//     return classes;
//   }

//   private getRole(stats: any): number {
//     const hp = stats?.hp || 100;
//     const attack = stats?.attack || 10;
//     const defense = stats?.defense || 10;

//     if (hp > 500 && defense > 20) return 0; // tank
//     if (attack > 30) return 1; // carry
//     if (hp < 200 && attack > 25) return 2; // assassin
//     return 3; // support
//   }

//   private encodeSynergies(board: any): Float32Array {
//     const synergies = new Float32Array(4); // fire, water, earth, air

//     const pieces = BoardSelectors.getAllPieces(board);
//     for (const piece of pieces) {
//       if (!piece) continue;

//       const definition = getDefinitionById((piece as PieceModel).definitionId);
//       if (!definition?.traits) continue;

//       for (const trait of definition.traits) {
//         const traitStr = String(trait);
//         if (traitStr.includes('fire')) synergies[0] += 1;
//         else if (traitStr.includes('water')) synergies[1] += 1;
//         else if (traitStr.includes('earth') || traitStr.includes('wood')) synergies[2] += 1;
//         else if (traitStr.includes('metal') || traitStr.includes('air')) synergies[3] += 1;
//       }
//     }

//     // Normalize
//     const total = synergies.reduce((a, b) => a + b, 0);
//     if (total > 0) {
//       for (let i = 0; i < synergies.length; i++) {
//         synergies[i] /= total;
//       }
//     }

//     return synergies;
//   }

//   private encodeThreats(myBoard: any, enemyBoard?: any): Float32Array {
//     const threats = new Float32Array(3); // Top 3 threats

//     if (!enemyBoard) return threats;

//     // Calculate threat scores for enemy pieces
//     const threatScores: { id: string; score: number }[] = [];

//     const pieces = BoardSelectors.getAllPieces(enemyBoard);
//     for (const piece of pieces) {
//       if (!piece) continue;

//       const definition = getDefinitionById((piece as PieceModel).definitionId);
//       if (!definition) continue;

//       const stageIndex = Math.min((piece as PieceModel).stage - 1, definition.stages.length - 1);
//       const stageStats = definition.stages[stageIndex];

//       const attack = stageStats?.attack || 0;
//       const level = (piece as PieceModel).stage;
//       const range = stageStats?.attackType?.range || 1;

//       const threatScore = attack * level * range;
//       threatScores.push({ id: (piece as PieceModel).id, score: threatScore });
//     }

//     // Sort by threat score and get top 3
//     threatScores.sort((a, b) => b.score - a.score);

//     for (let i = 0; i < Math.min(3, threatScores.length); i++) {
//       threats[i] = threatScores[i].score / 1000; // Normalize
//     }

//     return threats;
//   }

//   private encodeMatchup(myBoard: any, enemyBoard?: any): Float32Array {
//     const matchup = new Float32Array(3); // advantage, disadvantage, neutral

//     if (!enemyBoard) {
//       matchup[2] = 1.0; // neutral
//       return matchup;
//     }

//     const myStrength = this.calculateBoardStrength(myBoard);
//     const enemyStrength = this.calculateBoardStrength(enemyBoard);

//     const ratio = myStrength / (enemyStrength + 1);

//     if (ratio > 1.2) {
//       matchup[0] = Math.min(ratio - 1.2, 1.0); // advantage
//     } else if (ratio < 0.8) {
//       matchup[1] = Math.min(0.8 - ratio, 1.0); // disadvantage
//     } else {
//       matchup[2] = 1.0; // neutral
//     }

//     return matchup;
//   }

//   private calculateBoardStrength(board: any): number {
//     let strength = 0;

//     const pieces = BoardSelectors.getAllPieces(board);
//     for (const piece of pieces) {
//       if (!piece) continue;

//       const definition = getDefinitionById((piece as PieceModel).definitionId);
//       if (!definition) continue;

//       const stageIndex = Math.min((piece as PieceModel).stage - 1, definition.stages.length - 1);
//       const stageStats = definition.stages[stageIndex];

//       const hp = stageStats?.hp || 100;
//       const attack = stageStats?.attack || 10;
//       const level = (piece as PieceModel).stage;

//       strength += hp * attack * level;
//     }

//     return strength;
//   }

//   // Symmetry augmentations
//   static flipHorizontal(state: TacticalRLState): TacticalRLState {
//     return {
//       ...state,
//       myBoard: StateEncoder.flipBoardHorizontal(state.myBoard),
//       enemyBoard: StateEncoder.flipBoardHorizontal(state.enemyBoard)
//     };
//   }

//   static flipVertical(state: TacticalRLState): TacticalRLState {
//     return {
//       ...state,
//       myBoard: StateEncoder.flipBoardVertical(state.myBoard),
//       enemyBoard: StateEncoder.flipBoardVertical(state.enemyBoard)
//     };
//   }

//   static rotate180(state: TacticalRLState): TacticalRLState {
//     return {
//       ...state,
//       myBoard: StateEncoder.rotateBoard180(state.myBoard),
//       enemyBoard: StateEncoder.rotateBoard180(state.enemyBoard)
//     };
//   }

//   private static flipBoardHorizontal(board: Float32Array): Float32Array {
//     const size = 8;
//     const channels = 4;
//     const flipped = new Float32Array(board.length);

//     for (let y = 0; y < size; y++) {
//       for (let x = 0; x < size; x++) {
//         const srcIndex = (y * size + x) * channels;
//         const dstIndex = (y * size + (size - 1 - x)) * channels;

//         for (let c = 0; c < channels; c++) {
//           flipped[dstIndex + c] = board[srcIndex + c];
//         }
//       }
//     }

//     return flipped;
//   }

//   private static flipBoardVertical(board: Float32Array): Float32Array {
//     const size = 8;
//     const channels = 4;
//     const flipped = new Float32Array(board.length);

//     for (let y = 0; y < size; y++) {
//       for (let x = 0; x < size; x++) {
//         const srcIndex = (y * size + x) * channels;
//         const dstIndex = ((size - 1 - y) * size + x) * channels;

//         for (let c = 0; c < channels; c++) {
//           flipped[dstIndex + c] = board[srcIndex + c];
//         }
//       }
//     }

//     return flipped;
//   }

//   private static rotateBoard180(board: Float32Array): Float32Array {
//     const size = 8;
//     const channels = 4;
//     const rotated = new Float32Array(board.length);

//     for (let y = 0; y < size; y++) {
//       for (let x = 0; x < size; x++) {
//         const srcIndex = (y * size + x) * channels;
//         const dstIndex = ((size - 1 - y) * size + (size - 1 - x)) * channels;

//         for (let c = 0; c < channels; c++) {
//           rotated[dstIndex + c] = board[srcIndex + c];
//         }
//       }
//     }

//     return rotated;
//   }
// }
