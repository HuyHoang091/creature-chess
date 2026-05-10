import * as React from "react";
import { useDrop, useDragLayer } from "react-dnd";
import { useDispatch, useSelector } from "react-redux";
import { AppState } from "~/store";

import { PlayerActions } from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";

import styles from "./Overlays.module.css";
import { getGlobalDraggingItemId, subscribeToDragState } from "../../inventory/dragState";

function TrashDropTarget({ className }: { className: string }) {
    const dispatch = useDispatch();

    const inPreparingPhase = useSelector<AppState, boolean>(
        (state) => state.game.roundInfo.phase === GamePhase.PREPARING
    );

    const { isDragging, itemType } = useDragLayer((monitor) => ({
        isDragging: monitor.isDragging(),
        itemType: monitor.getItemType(),
    }));

    const [{ isOver }, drop] = useDrop<{ id: string }, void, { isOver: boolean }>({
        accept: "BoardItem",
        drop: ({ id }) => {
            if (inPreparingPhase) {
                dispatch(PlayerActions.sellPiecePlayerAction({ pieceId: id }));
            }
        },
        canDrop: () => inPreparingPhase,
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    });

    const isVisible = isDragging && itemType === "BoardItem" && inPreparingPhase;

    const stateClass = isOver ? styles.trashZoneHovering : styles.trashZoneIdle;
    const visibilityClass = isVisible ? styles.trashZoneVisible : styles.trashZoneHidden;

    return (
        <div
            ref={drop}
            className={`${styles.trashZone} ${className} ${stateClass} ${visibilityClass}`}
        >
            <span className={styles.trashZoneIcon}>🗑</span>
            <span className={styles.trashZoneLabel}>Sell</span>
        </div>
    );
}

export function TrashZone() {
    return (
        <>
            <TrashDropTarget className={styles.trashZoneLeft} />
            <TrashDropTarget className={styles.trashZoneRight} />
        </>
    );
}
