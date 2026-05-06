import * as React from "react";

import styles from "./Text.module.css";

export function Header4({ children }: { children: React.ReactNode }) {
	return <h4 className={styles.h4}>{children}</h4>;
}
