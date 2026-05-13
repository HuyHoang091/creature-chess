import { PlayerState, PlayerActions } from "@creature-chess/gamemode";
import { findRecipe, getItemDefinition } from "@creature-chess/models";
import { GamemodeSettings } from "@creature-chess/models/settings";

import { BotPersonality } from "@cc-server/data";

import { BrainAction } from "../../brain";
import { BrainActionValue } from "../../brain/action";

export const createCraftItemAction = (
	state: PlayerState,
	personality: BotPersonality,
	settings: GamemodeSettings
): BrainAction | null => {
	const inventory = state.playerInfo?.inventory || [];
	if (inventory.length < 2) {
		return null;
	}

	// Find first pair of base items that can be combined
	for (let i = 0; i < inventory.length; i++) {
		const itemDefA = getItemDefinition(inventory[i]);
		if (!itemDefA || itemDefA.tier !== 1) continue;

		for (let j = i + 1; j < inventory.length; j++) {
			const itemDefB = getItemDefinition(inventory[j]);
			if (!itemDefB || itemDefB.tier !== 1) continue;

			const recipeResult = findRecipe(inventory[i], inventory[j]);
			if (recipeResult) {
				const resultDef = getItemDefinition(recipeResult);
				return {
					name: `craft ${resultDef?.name || recipeResult} from ${itemDefA.name} + ${itemDefB.name}`,
					action: () =>
						PlayerActions.craftItemInventoryPlayerAction({
							fromIndex: i,
							toIndex: j,
						}),
					value: BrainActionValue.VERY_HIGH_VALUE,
				};
			}
		}
	}

	return null;
};
