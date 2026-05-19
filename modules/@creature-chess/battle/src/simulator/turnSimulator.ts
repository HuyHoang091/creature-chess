import { BoardSelectors, BoardSlice, BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { PieceCombatState, PieceInfoStore } from "../state";
import {
	getEffectiveSpeed,
	syncPieceStatusEffects,
} from "../utils/itemPassives";
import { simulatePiece } from "./piece/simulate";

type Stores = { combatStore: PieceInfoStore<PieceCombatState> };

export const simulateTurn = (
	currentTurn: number,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	stores: Stores
) => {
	board = syncPieceStatusEffects(board, currentTurn, stores);

	const pieceEntries = Object.entries(board.pieces).map(
		([pieceId, piece]) =>
			[
				pieceId,
				{
					...piece,
					lastBattleStats: {
						...piece.lastBattleStats!,
						turnsSurvived: piece.lastBattleStats!.turnsSurvived + 1,
					},
				},
			] as [string, PieceModel]
	);

	pieceEntries.sort(([, aPiece], [, bPiece]) => {
		return (
			getEffectiveSpeed(bPiece, currentTurn, stores) -
			getEffectiveSpeed(aPiece, currentTurn, stores)
		);
	});

	return pieceEntries.reduce(
		(b, [pieceId]) =>
			takePieceTurn(currentTurn, pieceId, b, boardSlice, stores),
		board
	);
};

const takePieceTurn = (
	currentTurn: number,
	pieceId: string,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	{ combatStore }: Stores
): BoardState<PieceModel> => {
	const piece = BoardSelectors.getPiece(board, pieceId);

	if (!piece) {
		return board;
	}

	const attacker: PieceModel = {
		...piece,
		attacking: null,
		hit: null,
		skillCast: null,
	};

	const attackerPosition = BoardSelectors.getPiecePosition(board, pieceId);

	if (!attackerPosition) {
		return board;
	}

	return simulatePiece(
		currentTurn,
		board,
		boardSlice,
		attacker,
		attackerPosition,
		{ combatStore }
	);
};
