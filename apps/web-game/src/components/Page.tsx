import React from "react";

import { PageBoardBackground } from "./PageBackground";
import styles from "./Page.module.css";

type Props = {
	children: React.ReactNode;
	hasBackground?: boolean;
};

export function Page(props: Props) {
	return (
		<div className={styles.root}>
			{props.hasBackground && <PageBoardBackground />}

			<div className={styles.page}>
				<div className={styles.content}>{props.children}</div>
			</div>
		</div>
	);
}
