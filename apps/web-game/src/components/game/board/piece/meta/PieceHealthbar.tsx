import * as React from "react";
import { ProgressBar } from "../../../../ui/progressBar";
import styles from "./PieceMeta.module.css";

interface HealthbarProps {
	color: "friendly" | "enemy" | "spectating";
	current: number;
	max: number;
	children?: React.ReactNode | React.ReactNode[];
}

const PieceHealthbar: React.FunctionComponent<HealthbarProps> = (props) => {
	const getFillClass = () => {
		if (props.color === "spectating") return styles.fillSpectating;
		if (props.color === "enemy") return styles.fillEnemy;
		return styles.fillFriendly;
	};

	return (
		<ProgressBar
			fillClassName={getFillClass()}
			current={props.current}
			max={props.max}
			vertical
		>
			{props.children}
		</ProgressBar>
	);
};

export { PieceHealthbar };
