import * as React from "react";

import { useSelector, useDispatch } from "react-redux";
import { BalanceIcon } from "~/components/ui/icon/BalanceIcon";
import { AppState } from "~/store";

import { BoardSelectors } from "@shoki/board";

import { PlayerActions } from "@creature-chess/gamemode";
import { getPiecesForStage } from "@creature-chess/gamemode/src/game/evolution";
import { GamePhase, PieceModel } from "@creature-chess/models";
import { PIECES_TO_EVOLVE } from "@creature-chess/models/config";

import styles from "./Overlays.module.css";

export function SellPieceButton() {
	const dispatch = useDispatch();

	const selectedPiece = useSelector<AppState, PieceModel | null>((state) => {
		const inPreparingPhase = state.game.roundInfo.phase === GamePhase.PREPARING;
		const id = state.game.ui.selectedPieceId;

		if (!inPreparingPhase || !id) {
			return null;
		}

		return (
			BoardSelectors.getPiece(state.game.board, id) ||
			BoardSelectors.getPiece(state.game.bench, id) ||
			null
		);
	});

	const onSell = React.useCallback(() => {
		if (!selectedPiece) {
			return;
		}

		dispatch(
			PlayerActions.sellPiecePlayerAction({ pieceId: selectedPiece.id })
		);
	}, [dispatch, selectedPiece]);

	if (!selectedPiece) {
		return null;
	}

	const piecesUsed = getPiecesForStage(selectedPiece.stage, PIECES_TO_EVOLVE);
	const pieceCost = selectedPiece.definition.cost;

	return (
		<button className={styles.sellPieceButton} onClick={onSell}>
			Sell&nbsp;-&nbsp;
			<BalanceIcon
				amount={pieceCost * piecesUsed}
			/>
		</button>
	);
}
