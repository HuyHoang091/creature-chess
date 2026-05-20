import { BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";
import {
	type ElementTraitId,
	type PieceBattleModifierSet,
	combineBattleModifiers,
	countUniqueElementTraits,
	getElementSynergyTier,
	isElementTrait,
} from "@creature-chess/models/gamemode/elementSynergyBalance";

const getOwnerElementCounts = (
	board: BoardState<PieceModel>
): Map<string, Map<ElementTraitId, number>> => {
	const piecesByOwner = new Map<string, PieceModel[]>();

	for (const piece of Object.values(board.pieces)) {
		const ownerPieces = piecesByOwner.get(piece.ownerId);

		if (ownerPieces) {
			ownerPieces.push(piece);
		} else {
			piecesByOwner.set(piece.ownerId, [piece]);
		}
	}

	const countsByOwner = new Map<string, Map<ElementTraitId, number>>();

	for (const [ownerId, pieces] of piecesByOwner.entries()) {
		countsByOwner.set(ownerId, countUniqueElementTraits(pieces));
	}

	return countsByOwner;
};

export const buildBattleModifiersForBoard = (
	board: BoardState<PieceModel>
): Map<string, PieceBattleModifierSet> => {
	const countsByOwner = getOwnerElementCounts(board);
	const activeBonusesByOwner = new Map<
		string,
		Map<ElementTraitId, PieceBattleModifierSet>
	>();

	for (const [ownerId, counts] of countsByOwner.entries()) {
		const ownerBonuses = new Map<ElementTraitId, PieceBattleModifierSet>();

		for (const [traitId, count] of counts.entries()) {
			const tier = getElementSynergyTier(traitId, count);

			if (tier) {
				ownerBonuses.set(traitId, tier);
			}
		}

		activeBonusesByOwner.set(ownerId, ownerBonuses);
	}

	const modifiersByPiece = new Map<string, PieceBattleModifierSet>();

	for (const piece of Object.values(board.pieces)) {
		const ownerBonuses = activeBonusesByOwner.get(piece.ownerId);

		if (!ownerBonuses) {
			continue;
		}

		const combinedModifiers = combineBattleModifiers(
			piece.traits.map((traitId) =>
				isElementTrait(traitId) ? ownerBonuses.get(traitId) : undefined
			)
		);

		if (combinedModifiers) {
			modifiersByPiece.set(piece.id, combinedModifiers);
		}
	}

	return modifiersByPiece;
};
