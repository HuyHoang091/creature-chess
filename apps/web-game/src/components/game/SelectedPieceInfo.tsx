import React from "react";

import { getDefinitionById } from "@creature-chess/gamemode";

import { TraitIcon } from "../ui/TraitIcon";
import { BalanceIcon } from "../ui/icon/BalanceIcon";
import { usePreviewPiece } from "./hooks/usePreviewPiece";
import { useSelectedPiece } from "./hooks/useSelectedPiece";

import styles from "./SelectedPieceInfo.module.css";

export function SelectedPieceInfo() {
	const selectedPiece = useSelectedPiece();
	const previewPiece = usePreviewPiece(selectedPiece);

	if (selectedPiece === null) {
		return null;
	}

	const definition = getDefinitionById(selectedPiece.definitionId);

	if (!definition) {
		return null;
	}

	const stats = previewPiece?.stats ?? definition.stages[selectedPiece.stage];

	return (
		<div className={styles.root}>
			<div className={styles.info}>
				<div className={styles.nameContainer}>
					<span className={styles.name}>{definition.name}</span>
					<BalanceIcon
						amount={definition.cost}
						className={styles.balanceIcon}
					/>
				</div>
				<div className={styles.traits}>
					{selectedPiece.traits.map((trait) => (
						<TraitIcon key={trait} trait={trait} label />
					))}
				</div>
			</div>
			<div className={styles.stats}>
				<span className={styles.stat}>ATK {stats.attack}</span>
				<span className={styles.stat}>DEF {stats.defense}</span>
				<span className={styles.stat}>SPD {stats.speed}</span>
				<span className={styles.stat}>HP {stats.hp}</span>
			</div>
		</div>
	);
}
