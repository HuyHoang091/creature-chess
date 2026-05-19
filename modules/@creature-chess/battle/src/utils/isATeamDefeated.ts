import { BoardSelectors, BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { PieceCombatState, PieceInfoStore } from "../state";
import { hasPendingRevive } from "./itemPassives";

type Stores = {
	combatStore: PieceInfoStore<PieceCombatState>;
};

export const isATeamDefeated = (
	board: BoardState<PieceModel>,
	stores: Stores
) => {
	const pieceOwnerIds = BoardSelectors.getAllPieces(board)
		.filter((p) => p.currentHealth > 0 || hasPendingRevive(p, stores))
		.map((p) => p.ownerId);

	// if there are only pieces belonging to 1 or 0 players, then we have a winner
	return new Set(pieceOwnerIds).size <= 1;
};
