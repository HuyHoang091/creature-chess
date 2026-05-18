import React from "react";
import { BoardState, HasId, PiecePosition } from "@shoki/board";
import {
	ClickBoardTileEvent,
	DropBoardItemEvent,
} from "@shoki-web/board-react";
import { PieceModel } from "@creature-chess/models";

import { HexBoardGrid } from "./HexBoardGrid";
import styles from "./ThemedBoard.module.css";

type Props = {
	theme?: "default";
	state: BoardState<PieceModel>;
	renderItem: (piece: HasId) => {
		item: React.ReactNode | React.ReactNode[];
		draggable?: boolean;
	};
	renderTileBackground?: (position: PiecePosition) => React.ReactNode;
	dragDrop?: boolean;
	onDropItem?: (event: DropBoardItemEvent) => void;
	onClickTile?: (event: ClickBoardTileEvent) => void;
	isPreparing?: boolean;
	deployZoneRows?: number[];
};

export function ThemedBoard(props: Props) {
	const deployRowSet = React.useMemo(
		() => new Set(props.deployZoneRows ?? []),
		[props.deployZoneRows]
	);

	const tileBackgroundRenderer = React.useCallback(
		(position: PiecePosition) => (
			<div className={styles.tileEffects}>
				<div className={styles.tileInnerGlow} />
				{props.isPreparing && deployRowSet.has(position.y) ? (
					<div className={styles.deployGlow} />
				) : null}
				{props.renderTileBackground?.(position)}
			</div>
		),
		[deployRowSet, props]
	);

	return (
		<div className={styles.boardFrame}>
			<HexBoardGrid
				state={props.state}
				renderItem={props.renderItem}
				renderTileBackground={tileBackgroundRenderer}
				dragDrop={props.dragDrop}
				onDropItem={props.onDropItem}
				onClickTile={props.onClickTile}
				lightTileClassName={styles.lightTile}
				darkTileClassName={styles.darkTile}
				className={styles.boardGrid}
			/>
		</div>
	);
}
