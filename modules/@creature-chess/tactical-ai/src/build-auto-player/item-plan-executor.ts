import { BoardSelectors } from "@shoki/board";

import { PlayerActions, PlayerState } from "@creature-chess/gamemode";
import { PieceModel, findRecipe, getItemDefinition } from "@creature-chess/models";
import { MAX_ITEM_SLOTS } from "@creature-chess/models";

import type { BuildAutoPlayAction, NormalizedBuildPlan, PlannedItemAction } from "./policy";

const getAllPieces = (state: PlayerState) => [
	...BoardSelectors.getAllPieces(state.board),
	...BoardSelectors.getAllPieces(state.bench),
];

const getHolderFallbackScore = (piece: PieceModel, plan: NormalizedBuildPlan) => {
	const name = piece.definition.name;
	if (plan.coreUnitNames.has(name)) {
		return 300;
	}
	if (plan.transitionUnitNames.has(name)) {
		return 180;
	}
	if (plan.avoidUnitNames.has(name)) {
		return -200;
	}
	return 0;
};

export const findTargetPiece = (state: PlayerState, targetName: string) =>
	getAllPieces(state)
		.filter((piece) => piece.definition.name === targetName)
		.sort(
			(a, b) =>
				b.stage - a.stage ||
				b.definition.cost - a.definition.cost ||
				((b.items || []).length - (a.items || []).length)
		)[0] || null;

const findInventoryIndex = (
	inventory: string[],
	itemId: string,
	usedIndices: Set<number> = new Set()
) => {
	for (let index = 0; index < inventory.length; index++) {
		if (!usedIndices.has(index) && inventory[index] === itemId) {
			return index;
		}
	}

	return -1;
};

const pieceHasItem = (piece: PieceModel, itemId: string) =>
	(piece.items || []).some((item) => item.itemId === itemId);

const pieceHoldsPlanItems = (piece: PieceModel, itemAction: PlannedItemAction) =>
	(piece.items || []).some(
		(item) =>
			item.itemId === itemAction.itemId ||
			itemAction.from.includes(item.itemId)
	);

export const isDesignatedHolderPiece = (
	piece: PieceModel,
	plan: NormalizedBuildPlan
) =>
	plan.itemPlan.some(
		(itemAction) =>
			itemAction.holderPiece === piece.definition.name ||
			(itemAction.action === "temporary_holder" &&
				itemAction.holderPiece === piece.definition.name)
	);

export const isRecoverableHolder = (
	state: PlayerState,
	piece: PieceModel,
	plan: NormalizedBuildPlan
) => {
	for (const itemAction of plan.itemPlan) {
		const carry = findTargetPiece(state, itemAction.targetPiece);
		if (!carry || carry.id === piece.id) {
			continue;
		}

		const isHolder =
			itemAction.holderPiece === piece.definition.name ||
			pieceHoldsPlanItems(piece, itemAction);
		if (!isHolder) {
			continue;
		}

		const inventory = state.playerInfo.inventory || [];
		const hasReadyItem = inventory.includes(itemAction.itemId);
		const firstIndex =
			itemAction.from.length >= 1
				? findInventoryIndex(inventory, itemAction.from[0])
				: -1;
		const secondIndex =
			itemAction.from.length >= 2 && firstIndex >= 0
				? findInventoryIndex(inventory, itemAction.from[1], new Set([firstIndex]))
				: -1;
		const hasRecipeInInventory = firstIndex >= 0 && secondIndex >= 0;

		if (!hasReadyItem && !hasRecipeInInventory) {
			return true;
		}
	}

	return false;
};

const findDesignatedHolder = (
	state: PlayerState,
	plan: NormalizedBuildPlan,
	itemAction: PlannedItemAction
) => {
	if (itemAction.holderPiece) {
		return findTargetPiece(state, itemAction.holderPiece);
	}

	return BoardSelectors.getAllPieces(state.bench)
		.concat(BoardSelectors.getAllPieces(state.board))
		.filter((piece) => getHolderFallbackScore(piece, plan) <= 0)
		.find((piece) => {
			const items = piece.items || [];
			if (items.length >= MAX_ITEM_SLOTS) {
				return false;
			}

			const hasBaseItem = items.some((item) => {
				const itemDefinition = getItemDefinition(item.itemId);
				return itemDefinition?.tier === 1;
			});

			return !hasBaseItem;
		});
};

const createRecoverItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BuildAutoPlayAction | null => {
	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (!targetPiece) {
			continue;
		}

		const inventory = state.playerInfo.inventory || [];
		const firstIndex =
			itemAction.from.length >= 1
				? findInventoryIndex(inventory, itemAction.from[0])
				: -1;
		const secondIndex =
			itemAction.from.length >= 2 && firstIndex >= 0
				? findInventoryIndex(inventory, itemAction.from[1], new Set([firstIndex]))
				: -1;

		const hasReadyItem = inventory.includes(itemAction.itemId);
		const hasRecipeInInventory = firstIndex >= 0 && secondIndex >= 0;

		if (hasReadyItem || hasRecipeInInventory) {
			continue;
		}

		const holder = getAllPieces(state)
			.filter((piece) => piece.id !== targetPiece.id)
			.find(
				(piece) =>
					itemAction.holderPiece === piece.definition.name ||
					(!itemAction.holderPiece &&
						getHolderFallbackScore(piece, plan) <= 0 &&
						pieceHoldsPlanItems(piece, itemAction))
			);

		if (holder) {
			return {
				name: `recover-item:${holder.definition.name}`,
				message: `Đang bán ${holder.definition.name} để thu hồi đồ cho ${itemAction.targetPiece}...`,
				action: PlayerActions.sellPiecePlayerAction({ pieceId: holder.id }),
			};
		}
	}

	return null;
};

const createCraftItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BuildAutoPlayAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (!targetPiece) {
			continue;
		}

		if (itemAction.from.length < 2) {
			continue;
		}

		const firstIndex = findInventoryIndex(inventory, itemAction.from[0]);
		if (firstIndex < 0) {
			continue;
		}

		const secondIndex = findInventoryIndex(
			inventory,
			itemAction.from[1],
			new Set([firstIndex])
		);
		if (secondIndex < 0) {
			continue;
		}

		const result = findRecipe(itemAction.from[0], itemAction.from[1]);
		if (result !== itemAction.itemId) {
			continue;
		}

		return {
			name: `craft:${itemAction.itemId}`,
			message: `Đang ghép ${itemAction.itemId} cho ${itemAction.targetPiece}...`,
			action: PlayerActions.craftItemInventoryPlayerAction({
				fromIndex: firstIndex,
				toIndex: secondIndex,
			}),
		};
	}

	return null;
};

const createEquipPlannedItemAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BuildAutoPlayAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (!targetPiece) {
			continue;
		}

		if (pieceHasItem(targetPiece, itemAction.itemId)) {
			continue;
		}

		if ((targetPiece.items || []).length >= MAX_ITEM_SLOTS) {
			continue;
		}

		const inventoryIndex = findInventoryIndex(inventory, itemAction.itemId);
		if (inventoryIndex < 0) {
			continue;
		}

		return {
			name: `equip:${itemAction.itemId}->${targetPiece.definition.name}`,
			message: `Đang gắn ${itemAction.itemId} cho ${targetPiece.definition.name}...`,
			action: PlayerActions.equipItemPlayerAction({
				pieceId: targetPiece.id,
				inventoryIndex,
			}),
		};
	}

	return null;
};

const createHoldComponentAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BuildAutoPlayAction | null => {
	const inventory = state.playerInfo.inventory || [];

	for (const itemAction of plan.itemPlan) {
		if (
			itemAction.action !== "hold" &&
			itemAction.action !== "temporary_holder"
		) {
			continue;
		}

		const targetPiece = findTargetPiece(state, itemAction.targetPiece);
		if (targetPiece) {
			continue;
		}

		for (const componentId of itemAction.from) {
			const inventoryIndex = findInventoryIndex(inventory, componentId);
			if (inventoryIndex < 0) {
				continue;
			}

			const temporaryHolder = findDesignatedHolder(state, plan, itemAction);
			if (!temporaryHolder) {
				continue;
			}

			if ((temporaryHolder.items || []).length >= MAX_ITEM_SLOTS) {
				continue;
			}

			return {
				name: `hold:${componentId}->${temporaryHolder.definition.name}`,
				message: `Đang giữ ${componentId} trên ${temporaryHolder.definition.name} chờ ${itemAction.targetPiece}...`,
				action: PlayerActions.equipItemPlayerAction({
					pieceId: temporaryHolder.id,
					inventoryIndex,
				}),
			};
		}
	}

	return null;
};

export const chooseItemPlanAction = (
	state: PlayerState,
	plan: NormalizedBuildPlan
): BuildAutoPlayAction | null =>
	createRecoverItemAction(state, plan) ||
	createCraftItemAction(state, plan) ||
	createEquipPlannedItemAction(state, plan) ||
	createHoldComponentAction(state, plan);
