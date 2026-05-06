import * as React from "react";

import styles from "./Footer.module.css";

export const Footer: React.FunctionComponent = () => {
	return (
		<div className={styles.footer}>
			{/* <span className={styles.item}>v{APP_VERSION || "-.-.-"}</span>
			{" - "}
			<a
				className={styles.item}
				href="https://github.com/Jameskmonger/creature-chess"
			>
				GitHub
			</a> */}
		</div>
	);
};
