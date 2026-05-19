import { BoardState, PiecePosition } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { Stores } from "../../types";
import { DyingState, StateResult } from "./types";

export function doDying(
	currentTurn: number,
	board: BoardState<PieceModel>,
	state: DyingState,
	piece: PieceModel,
	piecePosition: PiecePosition,
	{ combatStore }: Stores
): StateResult {
	if (state.payload.dieAtTurn <= currentTurn) {
		if (
			state.payload.reviveAtTurn !== undefined &&
			state.payload.reviveHealth !== undefined &&
			state.payload.reviveMana !== undefined
		) {
			return [
				{
					type: "reviving",
					payload: {
						reviveAtTurn: state.payload.reviveAtTurn,
						health: state.payload.reviveHealth,
						mana: state.payload.reviveMana,
					},
				},
			];
		}

		return [state, [{ type: "delete" }]];
	}

	return [state];
}
