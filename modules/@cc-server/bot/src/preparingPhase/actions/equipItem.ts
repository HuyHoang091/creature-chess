import { createUtilityValue, ScoringDirection } from "@shoki/engine";

import {
	PlayerState,
	PlayerActions,
	getAllPieces,
} from "@creature-chess/gamemode";
import {
	getItemDefinition,
	MAX_ITEM_SLOTS,
	ItemStats,
} from "@creature-chess/models";
import { PieceModel } from "@creature-chess/models";
import { GamemodeSettings } from "@creature-chess/models/settings";

import { BotPersonality } from "@cc-server/data";

import { BrainAction } from "../../brain";
import { BrainActionValue } from "../../brain/action";

const getPieceRole = (piece: PieceModel): "tank" | "carry" | "support" | "unknown" => {
	const stage = piece.definition.stages[piece.stage];
	if (!stage) return "unknown";

	// Heuristic: compare base stats to classify role
	const hpWeight = stage.hp / 500; // normalize ~500 hp max
	const atkWeight = stage.attack / 100; // normalize ~100 atk max
	const defWeight = (stage.defense || 0) / 50;
	const manaWeight = (stage.maxMana || piece.maxMana || 0) / 100;

	if (hpWeight + defWeight > atkWeight + manaWeight) {
		return "tank";
	}
	if (manaWeight > atkWeight && manaWeight > hpWeight) {
		return "support";
	}
	if (atkWeight + (stage.speed || 0) / 50 > hpWeight) {
		return "carry";
	}
	return "unknown";
};

const getItemValueForRole = (
	itemStats: Partial<ItemStats>,
	role: "tank" | "carry" | "support" | "unknown"
): number => {
	const stats = {
		attack: itemStats.attack || 0,
		hp: itemStats.hp || 0,
		defense: itemStats.defense || 0,
		speed: itemStats.speed || 0,
		mana: itemStats.mana || 0,
	};

	switch (role) {
		case "tank":
			return stats.hp * 2 + stats.defense * 2 + stats.attack * 0.2 + stats.mana * 0.1;
		case "carry":
			return stats.attack * 2 + stats.speed * 1.5 + stats.hp * 0.3 + stats.defense * 0.2;
		case "support":
			return stats.mana * 2 + stats.speed * 1 + stats.attack * 0.5 + stats.defense * 0.5;
		default:
			return stats.attack + stats.hp + stats.defense + stats.speed + stats.mana;
	}
};

const isOnBoard = (state: PlayerState, pieceId: string): boolean => {
	const boardPieces = state.board ? Object.values(state.board.pieces || {}) : [];
	return boardPieces.some((p) => p.id === pieceId);
};

export const createEquipItemAction = (
	state: PlayerState,
	personality: BotPersonality,
	settings: GamemodeSettings
): BrainAction | null => {
	const inventory = state.playerInfo?.inventory || [];
	if (inventory.length === 0) {
		return null;
	}

	const allPieces = getAllPieces(state);
	let bestAction: BrainAction | null = null;
	let bestValue = Number.NEGATIVE_INFINITY;

	for (let invIndex = 0; invIndex < inventory.length; invIndex++) {
		const itemId = inventory[invIndex];
		const itemDef = getItemDefinition(itemId);
		if (!itemDef) continue;

		for (const piece of allPieces) {
			const currentItems = piece.items || [];
			if (currentItems.length >= MAX_ITEM_SLOTS) {
				continue;
			}

			const role = getPieceRole(piece);
			const rawFit = getItemValueForRole(itemDef.stats, role);

			// Normalize to 0-200 range for utility scoring
			const fitScore = Math.min(rawFit / 5, 200);

			const onBoard = isOnBoard(state, piece.id);
			const health = state.playerInfo?.health || 100;

			const value = createUtilityValue([
				{
					value: fitScore,
					range: [0, 200],
					direction: ScoringDirection.High,
					weighting: {
						value: personality.composure,
						direction: ScoringDirection.High,
					},
				},
				{
					value: onBoard ? 200 : 0,
					range: [0, 200],
					direction: ScoringDirection.High,
				},
				{
					value: health,
					range: [1, 100],
					direction: ScoringDirection.Low,
					weighting: {
						value: personality.composure,
						direction: ScoringDirection.Low,
					},
				},
			]);

			if (value > bestValue) {
				bestValue = value;
				bestAction = {
					name: `equip ${itemDef.name} on ${piece.definition.name}`,
					action: () =>
						PlayerActions.equipItemPlayerAction({
							pieceId: piece.id,
							inventoryIndex: invIndex,
						}),
					value,
				};
			}
		}
	}

	return bestAction;
};
