import * as React from "react";
import styles from "./ItemIcon.module.css";

import { useDispatch } from "react-redux";
import { PlayerActions } from "@creature-chess/gamemode";
import { findRecipe, getItemDefinition, ItemDefinition } from "@creature-chess/models";
import { getGlobalDraggingItemId, setGlobalDraggingItemId } from "./dragState";

interface ItemIconProps {
	itemId: string;
	icon: string;
	name: string;
	description: string;
	inventoryIndex?: number;
	equippedPieceId?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
	itemId,
	icon,
	name,
	description,
	inventoryIndex,
	equippedPieceId,
}) => {
	const dispatch = useDispatch();

	const [previewResult, setPreviewResult] = React.useState<ItemDefinition | null>(null);

	const handleDragStart = (e: React.DragEvent) => {
		if (inventoryIndex !== undefined) {
			setGlobalDraggingItemId(itemId);
			e.dataTransfer.setData(
				"text/plain",
				JSON.stringify({ type: "item", inventoryIndex, itemId })
			);
		}
	};

	const handleDragEnd = (e: React.DragEvent) => {
		setGlobalDraggingItemId(null);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		if (getGlobalDraggingItemId() && getGlobalDraggingItemId() !== itemId) {
			const resultId = findRecipe(getGlobalDraggingItemId()!, itemId);
			if (resultId) {
				const resultDef = getItemDefinition(resultId);
				if (resultDef && previewResult?.id !== resultDef.id) {
					setPreviewResult(resultDef);
				}
			}
		}
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	const handleDragLeave = (e: React.DragEvent) => {
		setPreviewResult(null);
	};

	const handleDrop = (e: React.DragEvent) => {
		setPreviewResult(null);
		try {
			const dataStr = e.dataTransfer.getData("text/plain");
			if (dataStr) {
				const data = JSON.parse(dataStr);
				if (
					data.type === "item" &&
					data.inventoryIndex !== undefined &&
					inventoryIndex !== undefined
				) {
					e.preventDefault();
					dispatch(
						PlayerActions.craftItemInventoryPlayerAction({
							fromIndex: data.inventoryIndex,
							toIndex: inventoryIndex,
						})
					);
				}
			}
		} catch (error) {
			console.error("Error parsing drag data", error);
		}
	};

	return (
		<div
			className={`${styles.itemIconContainer} ${previewResult ? styles.previewActive : ""}`}
			draggable={inventoryIndex !== undefined}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			title={previewResult ? `Tạo thành:\n${previewResult.name}\n${previewResult.description}` : `${name}\n${description}`}
		>
			<span className={styles.icon}>{previewResult ? previewResult.icon : icon}</span>
			{previewResult && <div className={styles.previewOverlay}></div>}
		</div>
	);
};
