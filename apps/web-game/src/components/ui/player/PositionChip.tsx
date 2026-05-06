import React from "react";

import styles from "./Player.module.css";

type Props = {
	position: number;
};

export function PositionChip({ position }: Props) {
	return <div className={styles.positionChip}>#{position}</div>;
}
