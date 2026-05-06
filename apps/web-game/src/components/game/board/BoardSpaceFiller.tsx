import React from "react";

import classNames from "classnames";


import { BoardState } from "@shoki/board";

import { SelectedPieceInfo } from "../SelectedPieceInfo";
import { useSelectedPiece } from "../hooks/useSelectedPiece";
import { useGameBoard } from "./GameBoardContext";
import { PieceCount } from "./overlays/PieceCount";
import { ReadyUpButton } from "./overlays/ReadyUpButton";
import { SellPieceButton } from "./overlays/SellPieceButton";

import styles from "./GameBoard.module.css";

export function BoardSpaceFiller() {
	const { board } = useGameBoard();
	const selectedPiece = useSelectedPiece();

	const fillerStyle = { aspectRatio: `${board.size.width} / ${board.size.height}` };

	return (
		<div className={styles.filler} style={fillerStyle}>
			<div className={classNames(styles.row, styles.grow)}>
				<div className={classNames(styles.half, styles.selectedPiece)}>
					{selectedPiece && <SelectedPieceInfo />}
					{selectedPiece && <SellPieceButton />}
				</div>
				<div className={styles.half}></div>
			</div>
			<div className={styles.row}>
				<div className={styles.half}>
					<PieceCount />
				</div>
				<div className={styles.half}>
					<ReadyUpButton />
				</div>
			</div>
		</div>
	);
}
