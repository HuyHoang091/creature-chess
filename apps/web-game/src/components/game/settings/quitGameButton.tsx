import * as React from "react";

import { useDispatch } from "react-redux";

import { PlayerActions } from "@creature-chess/gamemode";
import styles from "./Settings.module.css";

export function QuitGameButton() {
	const dispatch = useDispatch();
	const [areYouSure, setAreYouSure] = React.useState<boolean>(false);

	const onClick = areYouSure
		? () => {
				dispatch(PlayerActions.quitGamePlayerAction());
			}
		: () => {
				setAreYouSure(true);
			};

	if (!areYouSure) {
		return (
			<button className={styles.button} onClick={onClick}>
				Quit Game
			</button>
		);
	}

	return (
		<button className={styles.button} onClick={onClick}>
			Click again to quit
		</button>
	);
}
