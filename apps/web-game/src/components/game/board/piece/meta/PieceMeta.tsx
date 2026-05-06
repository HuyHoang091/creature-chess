import * as React from "react";
import { PieceModel } from "@creature-chess/models";
import { TraitIcon } from "../../../../ui/TraitIcon";
import styles from "./PieceMeta.module.css";

type Props = {
	piece: PieceModel;
};

const PieceMeta: React.FunctionComponent<Props> = ({ piece }) => {
	return (
		<div className={styles.typeIndicatorContainer}>
			{piece.traits.map((trait) => (
				<TraitIcon key={trait} trait={trait} className={styles.traitIcon} />
			))}
		</div>
	);
};

export { PieceMeta };
