import React from "react";

import styles from "./BaseRegistrationInput.module.css";

const BaseRegistrationInput: React.FunctionComponent<{
	heading: string;
	info: string;
	children: React.ReactNode;
}> = ({ heading, info, children }) => {
	return (
		<div className={styles.input}>
			<h1 className={styles.inputHeading}>{heading}</h1>
			<h2 className={styles.info}>{info}</h2>

			{children}
		</div>
	);
};

export { BaseRegistrationInput };
