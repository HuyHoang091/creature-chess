import * as React from "react";

import classNames from "classnames";
import styles from "./Text.module.css";

type Props = {
	children: React.ReactNode;
	tag?: "span" | "p";
	className?: string;
	uppercase?: boolean;
	size?: "sm" | "md" | "lg";
	font?: "standard" | "cursive";
	light?: boolean;
	center?: boolean;
};

export function Text(props: Props) {
	const { children, tag = "span", className, uppercase, size, font, light, center } = props;

	const Tag = tag;

	const dynamicStyle: React.CSSProperties = {
		fontSize: size === "sm" ? "0.8em" : size === "lg" ? "1.2em" : "1em",
		textTransform: uppercase ? "uppercase" : "none",
		fontFamily: font === "cursive" ? '"Caveat Brush", cursive' : '"Roboto", "sans-serif"',
		color: light ? "#fff" : "#000",
		marginBottom: tag === "p" && size !== "sm" ? "0.5em" : "0",
		textAlign: center ? "center" : "left",
	};

	return (
		<Tag
			className={classNames(styles.text, className)}
			style={dynamicStyle}
		>
			{children}
		</Tag>
	);
}
