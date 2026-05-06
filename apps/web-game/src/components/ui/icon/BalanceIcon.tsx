import React from "react";

import { faCoins } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import styles from "../Ui.module.css";

type Props = {
	amount: number;
	className?: string;
	iconClassName?: string;
};

export function BalanceIcon({ amount, className, iconClassName }: Props) {
	return (
		<div className={classNames(styles.balanceWrapper, className)}>
			<span>{amount}</span>
			<FontAwesomeIcon
				icon={faCoins}
				className={classNames(styles.balanceIcon, iconClassName)}
			/>
		</div>
	);
}
