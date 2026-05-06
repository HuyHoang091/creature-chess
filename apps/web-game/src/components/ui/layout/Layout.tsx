import * as React from "react";

import classNames from "classnames";
import { Property } from "csstype";


import styles from "./Layout.module.css";

type FlexDirection = "column" | "column-reverse" | "row" | "row-reverse";

type Props = {
	className?: string;
	children: React.ReactNode | React.ReactNode[];
	justifyContent?: Property.JustifyContent;
	direction: FlexDirection;
	noSpacer?: boolean;
	grow?: boolean;
};

import { LayoutContext } from "./LayoutContext";

const isVertical = (direction: Property.FlexDirection) =>
	direction === "column" || direction === "column-reverse";

export const Layout = React.forwardRef<any, Props>((props, ref) => {
	const {
		direction,
		justifyContent = "space-between",
		noSpacer = false,
		grow = false,
		className,
		children,
	} = props;

	const isVert = isVertical(direction);

	const dynamicStyle: React.CSSProperties = {
		flexDirection: direction,
		justifyContent,
	};

	return (
		<div
			ref={ref}
			className={classNames(
				styles.layout,
				{
					[styles.grow]: grow,
					[styles.spacer]: !noSpacer,
				},
				className
			)}
			style={dynamicStyle}
		>
			<LayoutContext.Provider value={{ isVertical: isVert }}>
				{children}
			</LayoutContext.Provider>
		</div>
	);
});
