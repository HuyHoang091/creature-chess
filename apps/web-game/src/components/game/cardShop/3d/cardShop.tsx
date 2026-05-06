import * as React from "react";

import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useGamemodeSettings } from "~/contexts/GamemodeSettingsContext";

import { Card as CardModel } from "@creature-chess/models";

import { Button } from "../../../ui/Button";
import { Layout } from "../../../ui/layout";
import { DynamicAspectRatioComponent } from "../../board/DynamicAspectRatioComponent";
import { CardSelector } from "./cardSelector";
import styles from "./CardShop3D.module.css";

type Props = {
	cards: (CardModel | null)[];
	ownedDefinitionIds: number[];
	money: number;
	isLocked?: boolean;
	onReroll?: () => void;
	onToggleLock?: () => void;
	onBuy?: (index: number) => void;
};

export function CardShop({
	cards,
	ownedDefinitionIds,
	money,
	isLocked = false,
	onReroll,
	onToggleLock,
	onBuy,
}: Props) {
	const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

	const onBuyCurrentCard = () =>
		onBuy && selectedIndex !== null && onBuy(selectedIndex);

	const { rerollCost } = useGamemodeSettings();

	const ref = React.useRef<HTMLDivElement>(null);
	const ASPECT_RATIO = 1 / 1;

	return (
		<Layout className={styles.container} direction="column" ref={ref}>
			<DynamicAspectRatioComponent
				aspectRatio={ASPECT_RATIO}
				containerRef={ref}
				className={styles.aspectWrapper}
			>
				<CardSelector
					cards={cards}
					money={money}
					onSelectCard={setSelectedIndex}
					ownedDefinitionIds={ownedDefinitionIds}
				/>

				<Layout
					className={styles.controls}
					direction="row"
					justifyContent="space-between"
				>
					<Button
						type="primary"
						onClick={onReroll}
						disabled={money < rerollCost}
					>
						<FontAwesomeIcon icon={faArrowsRotate} />
						&nbsp;${rerollCost}
					</Button>

					<div className={styles.purchase} onClick={onBuyCurrentCard}>
						<span>Purchase</span>
					</div>

					<Button type="primary" onClick={onToggleLock}>
						{isLocked ? "Unlock" : "Lock"}
					</Button>
				</Layout>
			</DynamicAspectRatioComponent>
		</Layout>
	);
}
