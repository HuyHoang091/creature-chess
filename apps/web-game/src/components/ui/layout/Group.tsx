import * as React from "react";

import classNames from "classnames";


type Props = {
	children: React.ReactNode | React.ReactNode[];
	spacer?: boolean;
	className?: string;
};

import styles from "./Group.module.css";

export function Group({ children, className, spacer = true }: Props) {
	return (
		<div
			className={classNames(
				styles.group,
				{ [styles.spacer]: spacer },
				className
			)}
		>
			{children}
		</div>
	);
}
