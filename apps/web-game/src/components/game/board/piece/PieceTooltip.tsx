import * as React from "react";

import type { PieceModel } from "@creature-chess/models";

import { TraitIcon } from "../../../ui/TraitIcon";
import { usePreviewPiece } from "../../hooks/usePreviewPiece";
import styles from "./PieceTooltip.module.css";

type Props = {
	piece: PieceModel;
};

export function PieceTooltip({ piece }: Props) {
	const def = piece.definition;
	const preview = usePreviewPiece(piece);
	const previewPiece = preview?.piece ?? piece;
	const stats = def ? preview?.stats : undefined;

	return (
		<div className={styles.tooltip}>
			<div className={styles.name}>
				{def?.name || `Piece #${piece.definitionId}`}
			</div>

			<div className={styles.row}>
				<span className={styles.label}>Stage</span>
				<span className={`${styles.value} ${styles.stageStars}`}>
					{"\u2605".repeat(piece.stage)}
				</span>
			</div>

			<div className={styles.row}>
				<span className={styles.label}>HP</span>
				<span className={`${styles.value} ${styles.hpGreen}`}>
					{previewPiece.currentHealth} / {stats?.hp || piece.maxHealth}
				</span>
			</div>

			{def && (
				<>
					<div className={styles.row}>
						<span className={styles.label}>ATK</span>
						<span className={`${styles.value} ${styles.atkRed}`}>
							{stats?.attack}
						</span>
					</div>
					<div className={styles.row}>
						<span className={styles.label}>DEF</span>
						<span className={`${styles.value} ${styles.defBlue}`}>
							{stats?.defense}
						</span>
					</div>
					<div className={styles.row}>
						<span className={styles.label}>SPD</span>
						<span className={styles.value}>{stats?.speed}</span>
					</div>
					<div className={styles.row}>
						<span className={styles.label}>Range</span>
						<span className={styles.value}>{stats?.attackType.range}</span>
					</div>
				</>
			)}

			{previewPiece.traits.length > 0 && (
				<div className={styles.traitsRow}>
					{previewPiece.traits.map((trait) => (
						<TraitIcon
							key={trait}
							trait={trait}
							className={styles.traitIcon}
						/>
					))}
				</div>
			)}
		</div>
	);
}
