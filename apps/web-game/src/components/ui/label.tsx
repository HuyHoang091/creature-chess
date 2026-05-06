import * as React from "react";

import styles from "./Ui.module.css";

type Props = {
	type?: "default" | "highlight";
	children: React.ReactNode | React.ReactNode[];
};

const Label: React.FunctionComponent<Props> = (props) => {
	const className = props.type === "highlight" ? styles.labelHighlight : styles.labelDefault;

	return <span className={className}>{props.children}</span>;
};

export { Label };
