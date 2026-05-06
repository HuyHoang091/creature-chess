import React from "react";

import { getRandomBoardState } from "~/utils/getRandomBoardState";

import { PieceModel } from "@creature-chess/models";

import { ThemedBoard } from "./game/board/ThemedBoard";
import { PieceContextProvider, Piece } from "./game/board/piece";

import styles from "./PageBackground.module.css";

const renderItem = (boardId: string) => (piece: PieceModel) => ({
	item: (
		<PieceContextProvider
			value={{
				piece: {
					id: piece.id,
					definitionId: piece.definitionId,
					facingAway: piece.facingAway,
					traits: piece.traits,
					currentHealth: piece.currentHealth,
					maxHealth: piece.maxHealth,
				} as unknown as PieceModel,
				viewingPlayerId: boardId,
			}}
		>
			<Piece healthbar={piece.ownerId === "home" ? "friendly" : "enemy"} />
		</PieceContextProvider>
	),
	draggable: false,
});

export function PageBoardBackground() {

	const state1 = React.useMemo(() => getRandomBoardState("1"), []);
	const render1 = React.useMemo<any>(() => renderItem("1"), []);

	const state2 = React.useMemo(() => getRandomBoardState("2"), []);
	const render2 = React.useMemo<any>(() => renderItem("2"), []);

	const state3 = React.useMemo(() => getRandomBoardState("3"), []);
	const render3 = React.useMemo<any>(() => renderItem("3"), []);

	const state4 = React.useMemo(() => getRandomBoardState("4"), []);
	const render4 = React.useMemo<any>(() => renderItem("4"), []);

	return (
		<div className={styles.root}>
			<div className={styles.segment} style={{ top: 0, left: 0 }}>
				<ThemedBoard state={state1} renderItem={render1} dragDrop={false} />
			</div>
			<div className={styles.segment} style={{ top: 0, right: 0 }}>
				<ThemedBoard state={state2} renderItem={render2} dragDrop={false} />
			</div>
			<div className={styles.segment} style={{ bottom: 0, left: 0 }}>
				<ThemedBoard state={state3} renderItem={render3} dragDrop={false} />
			</div>
			<div className={styles.segment} style={{ bottom: 0, right: 0 }}>
				<ThemedBoard state={state4} renderItem={render4} dragDrop={false} />
			</div>
		</div>
	);
}
