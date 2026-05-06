import * as React from "react";

import { useSelector, useDispatch } from "react-redux";
import { AppState } from "~/store";

import { PlayerActions } from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";

import styles from "./Overlays.module.css";

export function ReadyUpButton() {
	const dispatch = useDispatch();

	const isDead = useSelector<AppState, boolean>(
		(state) => state.game.playerInfo.health === 0
	);

	const inPreparingPhase = useSelector<AppState, boolean>(
		(state) => state.game.roundInfo.phase === GamePhase.PREPARING
	);
	const notReady = useSelector<AppState, boolean>(
		(state) => state.game.playerInfo.ready === false
	);

	const canReadyUp = inPreparingPhase && notReady && !isDead;
	const onReadyUp = React.useCallback(() => {
		if (!canReadyUp) {
			return;
		}

		dispatch(PlayerActions.readyUpPlayerAction());
	}, [canReadyUp, dispatch]);

	if (!canReadyUp) {
		// To keep the Sell button in the same place
		return <div />;
	}

	return (
		<button className={styles.readyUpButton} onClick={onReadyUp}>
			Ready
		</button>
	);
}
