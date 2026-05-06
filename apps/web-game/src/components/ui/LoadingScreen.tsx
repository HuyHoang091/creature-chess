import React from "react";

import { Page } from "../Page";
import styles from "./LoadingScreen.module.css";

type Props = {
	message?: string;
};

export function LoadingScreen({ message }: Props) {
	return (
		<Page hasBackground>
			<div className={styles.loadingArea}>
				<div className={styles.spinner} />
				{message && <p className={styles.message}>{message}</p>}
			</div>
		</Page>
	);
}
