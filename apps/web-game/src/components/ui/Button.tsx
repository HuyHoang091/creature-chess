import React from "react";
import classNames from "classnames";
import styles from "./Button.module.css";

type ButtonProps = {
	children: React.ReactNode;
	disabled?: boolean;

	onClick?: () => void;

	type?: "primary" | "secondary";
	size?: "small" | "medium" | "large";
};

export function Button({
	type = "primary",
	size = "medium",
	...props
}: ButtonProps) {
	const className = classNames(
		styles.button,
		styles[type],
		styles[size]
	);

	return (
		<button
			onClick={props.onClick}
			className={className}
			disabled={props.disabled}
		>
			{props.children}
		</button>
	);
}
