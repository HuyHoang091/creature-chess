import * as React from "react";

import classNames from "classnames";

import { TraitId } from "@creature-chess/models/gamemode/traits";
import styles from "./TraitIcon.module.css";

interface Props {
	trait: TraitId;
	className?: string;
	label?: boolean;
}

function getIconUrl(iconName: string) {
	return `${APP_IMAGE_ROOT}/ui/${iconName}`;
}

const ICON_FOR_TRAIT: Record<TraitId, string> = {
	["fire"]: getIconUrl("traits/trait-fire.svg"),
	["earth"]: getIconUrl("traits/trait-earth.svg"),
	["metal"]: getIconUrl("traits/trait-metal.svg"),
	["water"]: getIconUrl("traits/trait-water.svg"),
	["wood"]: getIconUrl("traits/trait-wood.svg"),
	["arcane"]: getIconUrl("traits/trait-arcane.svg"),
	["valiant"]: getIconUrl("traits/trait-valiant.svg"),
	["cunning"]: getIconUrl("traits/trait-cunning.svg"),
};

export function TraitIcon({ trait, className, label = false }: Props) {
	return (
		<div className={classNames(styles.traitIcon, className)}>
			<img src={ICON_FOR_TRAIT[trait]} alt={`${trait} trait`} />
			{label && (
				<div className={styles.labelContainer}>
					<span className={styles.label}>{trait}</span>
				</div>
			)}
		</div>
	);
}
