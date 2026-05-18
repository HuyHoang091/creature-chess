import * as React from "react";
import { useSelector } from "react-redux";

import { getItemDefinition } from "@creature-chess/models";

import { AppState } from "../../../store";
import { ItemIcon } from "./ItemIcon";
import styles from "./InventoryPanel.module.css";

export const InventoryPanel: React.FC = () => {
	const inventory = useSelector<AppState, string[]>(
		(state) => state.game.playerInfo.inventory || []
	);
	const emptySlots = Math.max(4 - inventory.length, 0);

	return (
		<div className={styles.inventoryPanel}>
			<div className={styles.title}>Items</div>
			<div className={styles.itemGrid}>
				{inventory.map((itemId, index) => {
					const def = getItemDefinition(itemId);
					if (!def) return null;
					return (
						<ItemIcon
							key={`${itemId}-${index}`}
							itemId={itemId}
							icon={def.icon}
							name={def.name}
							description={def.description}
							inventoryIndex={index}
						/>
					);
				})}
				{Array.from({ length: emptySlots }, (_, index) => (
					<div
						key={`empty-slot-${index}`}
						className={styles.emptySlot}
						aria-hidden="true"
					/>
				))}
			</div>
			{inventory.length === 0 ? (
				<div className={styles.emptyHint}>No items yet</div>
			) : null}
		</div>
	);
};
