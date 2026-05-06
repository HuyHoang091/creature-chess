import * as React from "react";

import classNames from "classnames";
import styles from "./Ui.module.css";

interface Props {
	className?: string;
	fillClassName?: string;
	contentClassName?: string;

	current: number;
	max: number;

	vertical?: boolean;
	renderContents?: (current: number, max: number) => string | JSX.Element;
	children?: React.ReactNode;
}

const getPercentage = (current: number, max: number) =>
	Math.floor(Math.min((current / max) * 100, 100)) + "%";

const ProgressBar: React.FC<Props> = (props) => {
	const {
		className,
		fillClassName = "",
		contentClassName = "",
		current,
		max,
		vertical = false,
		renderContents,
		children,
	} = props;

	const fillStyle: React.CSSProperties = vertical
		? { height: getPercentage(current, max) }
		: { width: getPercentage(current, max) };

	return (
		<div className={classNames(styles.progressContainer, className)}>
			<div
				className={classNames(styles.progressFill, fillClassName)}
				style={fillStyle}
			/>
			{renderContents && (
				<span className={classNames(styles.progressContents, contentClassName)}>
					{renderContents(current, max)}
				</span>
			)}

			{children}
		</div>
	);
};

export { ProgressBar };
