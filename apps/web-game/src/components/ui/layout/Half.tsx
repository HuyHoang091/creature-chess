import * as React from "react";

import classNames from "classnames";
import { useLayoutContext } from "./LayoutContext";

import styles from "./Half.module.css";

type Props = {
	className?: string;
	children: React.ReactNode | React.ReactNode[];
};

export const Half: React.FunctionComponent<Props> = (props) => {
	const { isVertical } = useLayoutContext();
	const halfClass = isVertical ? styles.verticalHalf : styles.horizontalHalf;

	return (
		<div className={classNames(halfClass, props.className)}>
			{props.children}
		</div>
	);
};
