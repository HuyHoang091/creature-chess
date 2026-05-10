import * as React from "react";
import { useDispatch } from "react-redux";
import { useDragLayer } from "react-dnd";

import { PlayerActions } from "@creature-chess/gamemode";

import { Piece } from "./Piece";
import { usePiece } from "./PieceContext";
import { PieceTooltip } from "./PieceTooltip";

import styles from "./SelectablePiece.module.css";

import { findRecipe, getItemDefinition, ItemDefinition } from "@creature-chess/models";
import { getGlobalDraggingItemId } from "../../inventory/dragState";

export const SelectablePiece: React.FC = () => {
	const { piece } = usePiece();
	const dispatch = useDispatch();
	const [hovered, setHovered] = React.useState(false);
	const [previewCraft, setPreviewCraft] = React.useState<ItemDefinition | null>(null);

	// Ẩn tooltip khi bất kỳ item nào đang được kéo qua react-dnd
	const { isDragging } = useDragLayer((monitor) => ({
		isDragging: monitor.isDragging(),
	}));

	if (!piece) {
		return null;
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault(); // Cho phép drop item
		if (getGlobalDraggingItemId() && piece.items && piece.items.length > 0) {
			let foundRecipe: string | null = null;
			for (const current of piece.items) {
				const existDef = getItemDefinition(current.itemId);
				if (existDef?.tier === 1) {
					const recipe = findRecipe(getGlobalDraggingItemId()!, current.itemId);
					if (recipe) {
						foundRecipe = recipe;
						break;
					}
				}
			}
			if (foundRecipe) {
				const resultDef = getItemDefinition(foundRecipe);
				if (resultDef && previewCraft?.id !== resultDef.id) {
					setPreviewCraft(resultDef);
				}
			}
		}
	};

	const handleDragLeave = () => {
		setPreviewCraft(null);
	};

	const handleDrop = (e: React.DragEvent) => {
		setPreviewCraft(null);
		try {
			const dataStr = e.dataTransfer.getData("text/plain");
			if (dataStr) {
				const data = JSON.parse(dataStr);
				if (data.type === "item") {
					e.preventDefault();
					dispatch(
						PlayerActions.equipItemPlayerAction({
							pieceId: piece.id,
							inventoryIndex: data.inventoryIndex,
						})
					);
				}
			}
		} catch (error) {
			console.error("Failed to parse drop data", error);
		}
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	const showTooltip = hovered && !isDragging && !previewCraft;

	return (
		<div
			className={`${styles.selectablePiece} ${previewCraft ? styles.previewPieceHover : ""}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onDragOver={handleDragOver}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			title={previewCraft ? `Sẽ ghép thành:\n${previewCraft.name}\n${previewCraft.description}` : ""}
		>
			<Piece healthbar="none" />
			{showTooltip && <PieceTooltip piece={piece} />}
			{previewCraft && (
				<div className={styles.previewCraftOverlay}>
					<span className={styles.previewCraftIcon}>{previewCraft.icon}</span>
				</div>
			)}
		</div>
	);
};
