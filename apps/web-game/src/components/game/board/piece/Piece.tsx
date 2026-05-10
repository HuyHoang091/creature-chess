import * as React from "react";

import classNames from "classnames";
import styles from "./Piece.module.css";

import { CreatureImage } from "../../../ui/creatureImage";
import { getItemDefinition } from "@creature-chess/models";
import { usePiece } from "./PieceContext";
import { PieceMeta } from "./meta";
import { PieceHealthbar } from "./meta/PieceHealthbar";
import { PieceManabar } from "./meta/PieceManabar";
import { PieceStageIndicator } from "./meta/PieceStageIndicator";

interface Props {
	healthbar: "none" | "friendly" | "enemy" | "spectating";

	className?: string;
	children?: React.ReactNode | React.ReactNode[];
	onClick?: () => void;
}


export function Piece(props: Props) {
	const { piece } = usePiece();
	const { healthbar, children, className, onClick } = props;

	const stageIndicator = (
		<div className={styles.stage}>
			<PieceStageIndicator stage={piece.stage} />
		</div>
	);

	return (
		<div className={classNames(styles.piece, className)} onClick={onClick}>
			<div className={styles.metaContainer}>
				<PieceMeta piece={piece} />
			</div>

			<div className={styles.healthbarContainer}>
				{healthbar !== "none" && (
					<div style={{ display: "flex", flexDirection: "row", height: "100%", width: "100%" }}>
						<div style={{ flex: 1, position: "relative" }}>
							<PieceHealthbar
								color={healthbar}
								current={piece.currentHealth}
								max={piece.maxHealth}
							>
								{stageIndicator}
							</PieceHealthbar>
						</div>
						<div style={{ flex: 1, marginLeft: 2, position: "relative" }}>
							<PieceManabar 
								current={piece.currentMana} 
								max={piece.maxMana || 100} 
							/>
						</div>
					</div>
				)}

				{healthbar === "none" && <>{stageIndicator}</>}
			</div>

			<div className={styles.imageContainer}>
				<CreatureImage
					definitionId={piece.definitionId}
					facing={piece.facingAway ? "back" : "front"}
				/>
			</div>

			{piece.items && piece.items.length > 0 && (
				<div className={styles.itemsContainer}>
					{piece.items.map((item, index) => {
						const def = getItemDefinition(item.itemId);
						if (!def) return null;
						return (
							<div key={index} className={styles.equippedItem} title={def.name}>
								{def.icon}
							</div>
						);
					})}
				</div>
			)}

			{children}
		</div>
	);
}
