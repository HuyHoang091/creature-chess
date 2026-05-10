import { createAction } from "@reduxjs/toolkit";
import { takeEvery, select, put } from "redux-saga/effects";

import { findRecipe, getItemDefinition } from "@creature-chess/models";

import { playerInfoCommands } from "../entities/player/state/commands";

export type CraftItemInventoryPlayerAction = ReturnType<
	typeof craftItemInventoryPlayerAction
>;
export const craftItemInventoryPlayerAction = createAction<{
	fromIndex: number;
	toIndex: number;
}>("craftItemInventoryPlayerAction");

export const craftItemInventoryPlayerActionSaga = function* () {
	yield takeEvery<CraftItemInventoryPlayerAction>(
		craftItemInventoryPlayerAction.toString(),
		function* ({ payload: { fromIndex, toIndex } }) {
			if (fromIndex === toIndex) return; // Cannot craft with itself

			const inventory: string[] = yield select(
				(state) => state.playerInfo.inventory || []
			);

			if (
				fromIndex < 0 ||
				fromIndex >= inventory.length ||
				toIndex < 0 ||
				toIndex >= inventory.length
			) {
				return;
			}

			const itemA = inventory[fromIndex];
			const itemB = inventory[toIndex];

			const itemDefA = getItemDefinition(itemA);
			const itemDefB = getItemDefinition(itemB);

			if (!itemDefA || !itemDefB || itemDefA.tier !== 1 || itemDefB.tier !== 1) {
				return; // Only tier 1 items can be crafted
			}

			const recipeResult = findRecipe(itemA, itemB);

			if (recipeResult) {
				// We need to replace toIndex with recipeResult, and remove fromIndex
				// To do this, we can remove both and add the new one, or manipulate the array
				// If fromIndex > toIndex, removing toIndex first will shift fromIndex by 1.
				// For safety, let's just do an update inventory command or two splice commands.
				// Since we only have addItem and removeItem, we'll remove the larger index first to avoid shifting issues.
				
				const firstToRemove = Math.max(fromIndex, toIndex);
				const secondToRemove = Math.min(fromIndex, toIndex);

				yield put(playerInfoCommands.removeItemFromInventoryCommand(firstToRemove));
				yield put(playerInfoCommands.removeItemFromInventoryCommand(secondToRemove));
				
				yield put(playerInfoCommands.addItemToInventoryCommand(recipeResult));
			}
		}
	);
};
