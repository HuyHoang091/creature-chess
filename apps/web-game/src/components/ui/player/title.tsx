import * as React from "react";

import { PlayerTitle } from "@creature-chess/models/player/title";
import styles from "./Player.module.css";

export function Title(props: { title: PlayerTitle | null }) {
	if (!props.title) {
		return null;
	}

	const color = `#${props.title.color.toString(16)}`;

	return (
		<span className={styles.title} style={{ color }}>
			{props.title.text}
		</span>
	);
}
