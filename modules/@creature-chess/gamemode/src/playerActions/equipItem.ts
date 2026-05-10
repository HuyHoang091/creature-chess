import { take, put, select } from "@redux-saga/core/effects";
import { createAction } from "@reduxjs/toolkit";
import { getContext } from "typed-redux-saga";

import { BoardSelectors } from "@shoki/board";

import {
	findRecipe,
	getItemDefinition,
	MAX_ITEM_SLOTS,
} from "@creature-chess/models";
import { getStats } from "@creature-chess/battle";

import { getPlayerEntityDependencies } from "../entities/player/dependencies";
import { getBoardSlice, getBenchSlice } from "../entities/player/selectors";
import { playerInfoCommands } from "../entities/player/state/playerInfo/reducer";
import { PlayerState } from "../entities/player/state";

export type EquipItemPlayerAction = ReturnType<typeof equipItemPlayerAction>;

export const equipItemPlayerAction = createAction<
	{
		pieceId: string;
		inventoryIndex: number;
	},
	"equipItemPlayerAction"
>("equipItemPlayerAction");

export const equipItemPlayerActionSaga = function* () {
	while (true) {
		const playerId = yield* getContext<string>("id");
		const name = yield* getContext<string>("playerName");
		const { logger } = yield* getPlayerEntityDependencies();

		const boardSlice = yield* getBoardSlice();
		const benchSlice = yield* getBenchSlice();

		const action: EquipItemPlayerAction = yield take(
			equipItemPlayerAction.toString()
		);
		const { pieceId, inventoryIndex } = action.payload;

		const state: PlayerState = yield select();
		const inventory = state.playerInfo.inventory;

		if (inventoryIndex < 0 || inventoryIndex >= inventory.length) {
			logger.warn("Invalid inventory index", {
				actor: { playerId, name },
				inventoryIndex,
			});
			continue;
		}

		let boardState = state.board;
		let slice = boardSlice;
		let piece = BoardSelectors.getPiece(boardState, pieceId);

		if (!piece) {
			boardState = state.bench;
			slice = benchSlice;
			piece = BoardSelectors.getPiece(boardState, pieceId);
		}

		if (!piece) {
			logger.warn("Piece not found for equipping", {
				actor: { playerId, name },
				pieceId,
			});
			continue;
		}

		const itemId = inventory[inventoryIndex];
		const itemDef = getItemDefinition(itemId);

		if (!itemDef) {
			logger.warn("Invalid item definition", {
				actor: { playerId, name },
				itemId,
			});
			continue;
		}

		const currentItems = piece.items || [];
		let updatedItems = [...currentItems];
		let combined = false;

		// Try to craft with existing base items
		if (itemDef.tier === 1) {
			for (let i = 0; i < currentItems.length; i++) {
				const existingItemDef = getItemDefinition(currentItems[i].itemId);
				if (existingItemDef?.tier === 1) {
					const recipeResult = findRecipe(itemDef.id, existingItemDef.id);
					if (recipeResult) {
						// Craft successful! Replace existing item with the combined one
						updatedItems[i] = { itemId: recipeResult };
						combined = true;
						break;
					}
				}
			}
		}

		if (!combined) {
			if (currentItems.length >= MAX_ITEM_SLOTS) {
				logger.warn("Piece already has max items", {
					actor: { playerId, name },
					pieceId,
				});
				continue; // Cannot equip
			}
			updatedItems.push({ itemId });
		}

		// Update inventory (remove the consumed item)
		yield put(playerInfoCommands.removeItemFromInventoryCommand(inventoryIndex));

		// Recompute piece stats to reflect new items
		const pieceWithItems = { ...piece, items: updatedItems };
		const newStats = getStats(pieceWithItems);

		pieceWithItems.maxHealth = newStats.hp;
		pieceWithItems.currentHealth = newStats.hp;

		// Update piece with new items and stats
		const piecePosition = BoardSelectors.getPiecePosition(boardState, pieceId);
		if (piecePosition) {
			yield put(
				slice.commands.addBoardPieceCommand({
					x: piecePosition.x,
					y: piecePosition.y,
					piece: pieceWithItems,
				})
			);
		}
	}
};
