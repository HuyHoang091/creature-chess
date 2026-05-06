import React, { useMemo } from "react";

import classNames from "classnames";
import { useDispatch, useSelector } from "react-redux";
import { AppState } from "~/store";
import { UIActions, closeOverlay } from "~/store/game/ui";

import { getDefinitionById } from "@creature-chess/gamemode";
import { PieceModel } from "@creature-chess/models";

import { CreatureImage } from "../ui/creatureImage";
import styles from "./PieceBattleStats.module.css";

type Props = {
	pieces: PieceModel[];
	stats: Record<
		string,
		{
			damageDealt: number;
			damageTaken: number;
			turnsSurvived: number;
		}
	>;
};

export function PieceBattleStats(props: Props) {
	const dispatch = useDispatch();

	const selectedPieceId = useSelector<AppState, string | null>(
		(state) => state.game.ui.selectedPieceId
	);

	const piecesWithStats = useMemo(
		() =>
			props.pieces.map((piece) => ({
				piece,
				stats: props.stats[piece.id] ?? null,
			})),
		[props.pieces, props.stats]
	);

	const sortedPieces = useMemo(
		() =>
			[...piecesWithStats].sort(
				(a, b) => (b.stats?.damageDealt ?? 0) - (a.stats?.damageDealt ?? 0)
			),
		[piecesWithStats]
	);

	const onClickPiece = (pieceId: string) => {
		if (pieceId !== selectedPieceId) {
			dispatch(UIActions.selectPiece(pieceId));
			dispatch(closeOverlay());
		} else {
			dispatch(UIActions.clearSelectedPiece());
		}
	};

	return (
		<div className={styles.container}>
			<table className={styles.table}>
				<thead>
					<tr>
						<td className={styles.headerCell} />
						<td className={styles.headerCell}>Piece</td>
						<td className={styles.headerCell}>Damage Dealt</td>
					</tr>
				</thead>
				<tbody>
					{sortedPieces.map(({ piece, stats }) =>
						stats ? (
							<tr
								key={piece.id}
								className={piece.id === selectedPieceId ? styles.selected : ""}
								onClick={() => onClickPiece(piece.id)}
							>
								<td
									className={classNames(styles.imageContainer, styles.cell)}
								>
									<CreatureImage
										definitionId={piece.definitionId}
										className={styles.image}
									/>
								</td>
								<td className={styles.cell}>
									{getDefinitionById(piece.definitionId)?.name}
								</td>
								<td className={styles.cell}>{stats.damageDealt}</td>
							</tr>
						) : (
							<tr
								key={piece.id}
								className={piece.id === selectedPieceId ? styles.selected : ""}
								onClick={() => onClickPiece(piece.id)}
							>
								<td
									className={classNames(styles.imageContainer, styles.cell)}
								>
									<CreatureImage
										definitionId={piece.definitionId}
										className={styles.image}
									/>
								</td>
								<td className={styles.cell}>
									{getDefinitionById(piece.definitionId)?.name}
								</td>
								<td className={styles.cell}>-</td>
							</tr>
						)
					)}
				</tbody>
			</table>
		</div>
	);
}
