import * as React from "react";

import classNames from "classnames";
import styles from "./creatureImage.module.css";

interface Props {
	baseUrl?: string;
	definitionId: number;
	facing?: "front" | "back";
	className?: string;
}

function getCreatureUrl(facing: "front" | "back", definitionId: number) {
	return `${APP_IMAGE_ROOT}/creatures/${facing}/${definitionId}.png`;
}

export function CreatureImage({ facing, definitionId, className }: Props) {
	return (
		<img
			className={classNames(styles.image, className)}
			src={getCreatureUrl(facing || "front", definitionId)}
		/>
	);
}
