import * as React from "react";

import styles from "./Text.module.css";

export function Header2({ children }: { children: React.ReactNode }) {
	return <h2 className={styles.h2}>{children}</h2>;
}
