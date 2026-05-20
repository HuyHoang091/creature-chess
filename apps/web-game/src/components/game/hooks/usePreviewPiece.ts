import * as React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { buildBattleModifiersForBoard, getStats } from "@creature-chess/battle";
import { PieceModel } from "@creature-chess/models";

export function usePreviewPiece(piece: PieceModel | null) {
	const board = useSelector((state: AppState) => state.game.board);

	return React.useMemo(() => {
		if (!piece) {
			return null;
		}

		const battleModifiers = buildBattleModifiersForBoard(board).get(piece.id);
		const pieceWithModifiers = battleModifiers
			? { ...piece, battleModifiers }
			: piece;
		const stats = getStats(pieceWithModifiers);
		const healthRatio =
			piece.maxHealth > 0 ? piece.currentHealth / piece.maxHealth : 0;
		const previewCurrentHealth =
			piece.currentHealth <= 0
				? 0
				: Math.min(stats.hp, Math.max(1, Math.ceil(stats.hp * healthRatio)));
		const previewPiece = {
			...pieceWithModifiers,
			maxHealth: stats.hp,
			currentHealth: previewCurrentHealth,
		};

		return {
			piece: previewPiece,
			stats,
		};
	}, [board, piece]);
}
