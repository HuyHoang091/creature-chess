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
				<div className={styles.header}>
					{/* <img
						src={`${APP_IMAGE_ROOT}/ui/logo.png`}
						alt="Creature Chess"
						className={styles.logo}
					/> */}
				</div>
				<div className={styles.content}>{props.children}</div>
			</div>
		</div>
	);
}
