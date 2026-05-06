import React from "react";



import { DndProvider } from "@shoki-web/board-react";

import { UnifiedBoard } from "./UnifiedBoard";
import { OverlayManager } from "./overlays/OverlayManager";
import { TrashZone } from "./overlays/TrashZone";

import styles from "./GameBoard.module.css";

export function BoardContainer() {

    return (
        <DndProvider>
            <div className={styles.boardContainer}>
                <UnifiedBoard>
                    <OverlayManager />
                </UnifiedBoard>
                <TrashZone />
            </div>
        </DndProvider>
    );
}
