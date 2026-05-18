import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";

import { BoardSelectors } from "@shoki/board";

import { getPlayerLevel } from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";

import { SelectedPieceInfo } from "../SelectedPieceInfo";
import { SellPieceButton } from "../board/overlays/SellPieceButton";
import styles from "./DesktopPrepOverlays.module.css";

export function DesktopPrepOverlays() {
	const playerId = useLocalPlayerId();

	const inPreparingPhase = useSelector<AppState, boolean>(
		(state) => state.game.roundInfo.phase === GamePhase.PREPARING
	);

	const pieceCount = useSelector<AppState, number>(
		(state) =>
			BoardSelectors.getAllPieces(state.game.board).filter(
				(piece) => piece.ownerId === playerId
			).length
	);

	const level = useSelector<AppState, number>((state) =>
		getPlayerLevel(state.game)
	);

	const hasSelectedPiece = useSelector<AppState, boolean>((state) => {
		const id = state.game.ui.selectedPieceId;
		if (!inPreparingPhase || !id) {
			return false;
		}

		return !!(
			BoardSelectors.getPiece(state.game.board, id) ||
			BoardSelectors.getPiece(state.game.bench, id)
		);
	});

	if (!inPreparingPhase) {
		return null;
	}

	const isWarning = pieceCount < level;

	return (
		<div className={styles.overlayRoot}>
			<div className={styles.topCenter}>
				<div
					className={`${styles.pieceCountBadge} ${
						isWarning ? styles.pieceCountWarning : ""
					}`}
				>
					{pieceCount} / {level}
				</div>
			</div>

			<div className={styles.bottomLeft}>
				{hasSelectedPiece ? (
					<>
						<div className={styles.infoCard}>
							<SelectedPieceInfo />
						</div>
						<div className={styles.actionCard}>
							<SellPieceButton />
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}
