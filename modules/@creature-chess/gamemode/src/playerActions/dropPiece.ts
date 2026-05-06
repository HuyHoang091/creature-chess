import { createAction } from "@reduxjs/toolkit";
import { takeEvery, put } from "redux-saga/effects";
import { select, getContext } from "typed-redux-saga";

import { BoardSelectors } from "@shoki/board";

import { PlayerPieceLocation } from "@creature-chess/models";

import { PlayerState } from "../entities/player";
import { getBoardSlice, getBenchSlice } from "../entities/player/selectors";
import { getPlayerBelowPieceLimit } from "../entities/player/state/selectors";

export const findPiece = (
	state: PlayerState,
	location: PlayerPieceLocation
) => {
	if (location.type === "board") {
		const { x, y } = location.location;
		return BoardSelectors.getPieceForPosition(state.board, x, y);
	}

	if (location.type === "bench") {
		const { x } = location.location;
		return BoardSelectors.getPieceForPosition(state.bench, x, 0);
	}

	return null;
};

export const isLocationLocked = (
	state: PlayerState,
	location: PlayerPieceLocation
) => {
	if (location.type === "board") {
		return state.board.locked;
	}

	if (location.type === "bench") {
		return state.bench.locked;
	}

	return true;
};

export type DropPiecePlayerAction = ReturnType<typeof dropPiecePlayerAction>;
export const dropPiecePlayerAction = createAction<{
	pieceId: string;
	to: PlayerPieceLocation;
	from: PlayerPieceLocation;
}>("dropPiecePlayerAction");

// Helper: get the correct slice for a location type
const getSliceForLocation = (
	boardSlice: any,
	benchSlice: any,
	locationType: string
) => (locationType === "board" ? boardSlice : benchSlice);

// Helper: get coordinates for a location
const getCoords = (location: PlayerPieceLocation) => ({
	x: location.location.x,
	y: location.type === "board" ? location.location.y : 0,
});

export const dropPiecePlayerActionSaga = function* () {
	const boardSlice = yield* getBoardSlice();
	const benchSlice = yield* getBenchSlice();

	yield takeEvery<DropPiecePlayerAction>(
		dropPiecePlayerAction.toString(),
		function* ({ payload: { from, pieceId, to } }) {
			const playerId = yield* getContext<string>("id");
			const state = yield* select((s: PlayerState) => s);

			if (isLocationLocked(state, from) || isLocationLocked(state, to)) {
				return;
			}

			const fromPiece = findPiece(state, from);

			if (fromPiece === null || fromPiece.id !== pieceId) {
				return;
			}

			const toPiece = findPiece(state, to);

			// === SWAP: nếu ô đích đã có quân, đổi chỗ hai quân ===
			if (toPiece !== null) {
				const fromSlice = getSliceForLocation(boardSlice, benchSlice, from.type);
				const toSlice = getSliceForLocation(boardSlice, benchSlice, to.type);
				const fromCoords = getCoords(from);
				const toCoords = getCoords(to);

				// Remove cả hai
				yield put(fromSlice.commands.removeBoardPiecesCommand([fromPiece.id]));
				yield put(toSlice.commands.removeBoardPiecesCommand([toPiece.id]));

				// Add lại ở vị trí đảo
				yield put(
					toSlice.commands.addBoardPieceCommand({
						piece: {
							...fromPiece,
							facingAway: to.type === "board",
						},
						x: toCoords.x,
						y: toCoords.y,
					})
				);

				yield put(
					fromSlice.commands.addBoardPieceCommand({
						piece: {
							...toPiece,
							facingAway: from.type === "board",
						},
						x: fromCoords.x,
						y: fromCoords.y,
					})
				);

				return;
			}

			// === MOVE: ô đích trống (logic cũ) ===
			if (to.type === "board" && from.type !== "board") {
				const belowPieceLimit = getPlayerBelowPieceLimit(state, playerId);

				if (!belowPieceLimit) {
					return;
				}
			}

			if (from.type === "board" && to.type === "board") {
				yield put(
					boardSlice.commands.moveBoardPieceCommand({
						pieceId,
						from: from.location,
						to: to.location,
					})
				);
			} else if (from.type === "bench" && to.type === "bench") {
				const fromBench = { x: from.location.x, y: 0 };
				const toBench = { x: to.location.x, y: 0 };

				yield put(
					benchSlice.commands.moveBoardPieceCommand({
						pieceId,
						from: fromBench,
						to: toBench,
					})
				);
			} else if (from.type === "board" && to.type === "bench") {
				yield put(boardSlice.commands.removeBoardPiecesCommand([pieceId]));
				yield put(
					benchSlice.commands.addBoardPieceCommand({
						piece: {
							...fromPiece,
							facingAway: false,
						},
						x: to.location.x,
						y: 0,
					})
				);
			} else if (from.type === "bench" && to.type === "board") {
				yield put(benchSlice.commands.removeBoardPiecesCommand([pieceId]));
				const { x, y } = to.location;
				yield put(
					boardSlice.commands.addBoardPieceCommand({
						piece: {
							...fromPiece,
							facingAway: true,
						},
						x,
						y,
					})
				);
			}
		}
	);
};
