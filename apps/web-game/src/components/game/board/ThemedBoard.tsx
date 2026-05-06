import React from "react";
import { BoardState, HasId, PiecePosition } from "@shoki/board";
import {
    BoardGrid,
    ClickBoardTileEvent,
    DropBoardItemEvent,
} from "@shoki-web/board-react";
import { PieceModel } from "@creature-chess/models";

// Import file CSS Module đã chỉnh sửa ở trên
import styles from "./ThemedBoard.module.css";

type Props = {
    theme?: "default";
    state: BoardState<PieceModel>;
    renderItem: (piece: HasId) => {
        item: React.ReactNode | React.ReactNode[];
        draggable?: boolean;
    };
    renderTileBackground?: (position: PiecePosition) => React.ReactNode;
    dragDrop?: boolean;
    onDropItem?: (event: DropBoardItemEvent) => void;
    onClickTile?: (event: ClickBoardTileEvent) => void;
    flipDarkLight?: boolean;
};

export function ThemedBoard(props: Props) {
    return (
        <div style={{
            padding: '4px',
            border: '1px solid #333',
            background: '#020202',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)'
        }}>
            <BoardGrid
                state={props.state}
                renderItem={props.renderItem}
                renderTileBackground={props.renderTileBackground}
                dragDrop={props.dragDrop}
                onDropItem={props.onDropItem}
                onClickTile={props.onClickTile}
                // Sử dụng class từ CSS Module mới
                lightTileClassName={
                    props.flipDarkLight ? styles.darkTile : styles.lightTile
                }
                darkTileClassName={
                    props.flipDarkLight ? styles.lightTile : styles.darkTile
                }
                // Có thể thêm className cho container grid nếu thư viện hỗ trợ
                className={styles.boardGrid}
            />
        </div>
    );
}
