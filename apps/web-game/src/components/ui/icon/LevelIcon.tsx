import React from "react";

import { faSquareCaretUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import styles from "../Ui.module.css";

type Props = {
	amount: number;
	className?: string;
	iconClassName?: string;
};

const LEVEL_COLOURS = ["#696969", "#2e762e", "#2e89ff", "#931093", "#e09429"];

export function LevelIcon(props: Props) {
	const { amount, className, iconClassName } = props;
	// 2 levels per colour
	const iconColor = LEVEL_COLOURS[Math.floor((amount - 1) / 2)];

	return (
		<div className={classNames(styles.levelWrapper, className)}>
			<span>lvl {amount}</span>
			<FontAwesomeIcon
				icon={faSquareCaretUp}
				className={iconClassName}
				style={{ color: iconColor }}
			/>
		</div>
	);
}
