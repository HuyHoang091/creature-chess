import { BoardState, PiecePosition } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { Stores } from "../../types";
import { RevivingState, StateResult } from "./types";

export function doReviving(
	currentTurn: number,
	board: BoardState<PieceModel>,
	state: RevivingState,
	piece: PieceModel,
	piecePosition: PiecePosition,
	{ combatStore }: Stores
): StateResult {
	if (state.payload.reviveAtTurn <= currentTurn) {
		return [
			{ type: "wandering" },
			[
				{
					type: "revive",
					payload: {
						health: state.payload.health,
						mana: state.payload.mana,
					},
				},
			],
		];
	}

	return [state];
}
