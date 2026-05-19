import { BoardState, PiecePosition } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { Stores } from "../../types";
import { PieceAction } from "../actions";

export type AttackState = { type: "attacking"; payload: { targetId: string } };
export type WanderState = { type: "wandering" };
export type DyingState = {
	type: "dying";
	payload: {
		dieAtTurn: number;
		reviveAtTurn?: number;
		reviveHealth?: number;
		reviveMana?: number;
	};
};
export type RevivingState = {
	type: "reviving";
	payload: {
		reviveAtTurn: number;
		health: number;
		mana: number;
	};
};

export type PieceState = WanderState | DyingState | RevivingState | AttackState;

export type StateResult = [PieceState] | [PieceState, PieceAction[]];

export type StateHandler = (
	currentTurn: number,
	board: BoardState<PieceModel>,
	state: PieceState,
	piece: PieceModel,
	piecePosition: PiecePosition,
	{ combatStore }: Stores
) => StateResult;
