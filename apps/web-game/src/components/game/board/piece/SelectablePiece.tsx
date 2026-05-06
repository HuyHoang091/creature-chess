import * as React from "react";

import { useDragLayer } from "react-dnd";

import { Piece } from "./Piece";
import { usePiece } from "./PieceContext";
import { PieceTooltip } from "./PieceTooltip";

import styles from "./SelectablePiece.module.css";

export const SelectablePiece: React.FC = () => {
    const { piece } = usePiece();
    const [hovered, setHovered] = React.useState(false);

    // Ẩn tooltip khi bất kỳ item nào đang được kéo
    const { isDragging } = useDragLayer((monitor) => ({
        isDragging: monitor.isDragging(),
    }));

    if (!piece) {
        return null;
    }

    const showTooltip = hovered && !isDragging;

    return (
        <div
            className={styles.selectablePiece}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <Piece healthbar="none" />
            {showTooltip && <PieceTooltip piece={piece} />}
        </div>
    );
};
