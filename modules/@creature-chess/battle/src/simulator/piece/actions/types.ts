import { BoardSlice, BoardState, PiecePosition } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import { Stores } from "../../types";

export type MoveAction = { type: "move"; payload: { x: number; y: number } };
export type HitAction = { type: "hit"; payload: { targetId: string } };
export type DeleteAction = { type: "delete" };
export type SkillAction = { type: "skill"; payload: { targetId: string } };
export type ReviveAction = {
	type: "revive";
	payload: { health: number; mana: number };
};

export type PieceAction =
	| MoveAction
	| HitAction
	| DeleteAction
	| SkillAction
	| ReviveAction;

export type ActionHandler = (
	currentTurn: number,
	board: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	piece: PieceModel,
	piecePosition: PiecePosition,
	action: PieceAction,
	{ combatStore }: Stores
) => BoardState<PieceModel>;
