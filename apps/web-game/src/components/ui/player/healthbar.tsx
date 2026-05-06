import * as React from "react";

import { MAX_HEALTH } from "@creature-chess/models/config";

import { ProgressBar } from "../progressBar";
import styles from "./Player.module.css";

type Props = {
	health: number;
};

const renderHealthbar = (current: number) => `${current} / ${MAX_HEALTH} hp`;

const PlayerHealthbar: React.FunctionComponent<Props> = ({ health }) => {
	return (
		<ProgressBar
			className={styles.playerHealth}
			fillClassName={styles.healthFill}
			contentClassName={styles.healthContent}
			current={health}
			max={MAX_HEALTH}
			renderContents={renderHealthbar}
		/>
	);
};

export { PlayerHealthbar };
