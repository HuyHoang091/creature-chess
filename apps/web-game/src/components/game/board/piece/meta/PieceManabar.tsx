import * as React from "react";
import { ProgressBar } from "../../../../ui/progressBar";
import styles from "./PieceMeta.module.css";

interface ManabarProps {
	current: number;
	max: number;
}

const PieceManabar: React.FunctionComponent<ManabarProps> = (props) => {
	return (
		<ProgressBar
			fillClassName={styles.fillMana}
			current={props.current}
			max={props.max}
			vertical
		/>
	);
};

export { PieceManabar };
