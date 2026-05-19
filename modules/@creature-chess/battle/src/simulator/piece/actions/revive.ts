import { BoardSlice, BoardState, PiecePosition } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { getPieceStatusEffects } from "../../../utils/itemPassives";
import { Stores } from "../../types";
import { ReviveAction } from "./types";

function createReviveEffect() {
	return {
		id: Math.random().toString(36).slice(2),
		text: "Revive!",
		color: "#ffd48d",
	};
}

export function doRevive(
	currentTurn: number,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	piece: PieceModel,
	piecePosition: PiecePosition,
	action: ReviveAction,
	{ combatStore }: Stores
): BoardState<PieceModel> {
	const revivedPiece: PieceModel = {
		...piece,
		currentHealth: action.payload.health,
		currentMana: action.payload.mana,
		attacking: null,
		hit: null,
		skillCast: null,
		statusEffects: getPieceStatusEffects(piece, currentTurn, { combatStore }),
		visualEffects: [createReviveEffect()],
	};

	combatStore.updatePiecePartial(piece.id, {
		canMoveAtTurn: currentTurn + 1,
		canAttackAtTurn: currentTurn + 1,
		canBeAttackedAtTurn: currentTurn + 1,
	});

	return boardSlice.boardReducer(
		board,
		boardSlice.commands.updateBoardPiecesCommand([revivedPiece])
	);
}
