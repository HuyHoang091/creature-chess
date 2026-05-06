import * as React from "react";

import { Card as CardModel } from "@creature-chess/models";

import { TraitIcon } from "../../../ui/TraitIcon";
import { CreatureImage } from "../../../ui/creatureImage";
import { Layout } from "../../../ui/layout";
import styles from "./CardShop3D.module.css";

type Props = {
	card: CardModel;
	alreadyOwned: boolean;
	onClick?: () => void;
	disabled?: boolean;
};

export function Card3D(props: Props) {
	const {
		card: { name, definitionId, cost, traits },
		onClick,
		disabled = false,
        alreadyOwned,
	} = props;

    const bgAndBorderColor = alreadyOwned ? "#587261" : "#303030";

	return (
		<div
			className={styles.card}
            style={{ background: bgAndBorderColor, borderColor: bgAndBorderColor }}
			onClick={!disabled ? onClick || undefined : undefined}
		>
			<Layout direction="column" noSpacer>
				<div className={styles.cost}>
					<span>${cost}</span>
				</div>
				<CreatureImage
					definitionId={definitionId}
					className={styles.cardImage}
				/>
				<div className={styles.cardInfo}>
					<Layout direction="row" noSpacer className={styles.cardInfoTopBar}>
						<div className={styles.typeIndicator}>
							{traits.map((trait) => (
								<TraitIcon key={trait} trait={trait} />
							))}
						</div>
						<h2 className={styles.name}>{name}</h2>
					</Layout>
					<div className={styles.cardMeta}>
						{traits.map((trait) => (
							<TraitIcon key={trait} trait={trait} />
						))}
					</div>
				</div>
			</Layout>
		</div>
	);
}
