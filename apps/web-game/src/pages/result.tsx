import React from "react";

import styles from "./ResultPage.module.css";

export const ResultPage = () => (
	<div className={styles.wrapper}>
		<div className={styles.card}>
			<div className={styles.title}>Match Complete</div>
			<div className={styles.muted}>
				Post-match result shell is ready for public/private match result wiring.
			</div>
		</div>
	</div>
);
