import React from "react";
import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";

import { BoardSelectors } from "@shoki/board";
import { getPlayerLevel } from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";

import styles from "./Overlays.module.css";

export function PieceCount() {
    const playerId = useLocalPlayerId();

    const pieceCount = useSelector<AppState, number>(
        (state) =>
            BoardSelectors.getAllPieces(state.game.board).filter(
                (p) => p.ownerId === playerId
            ).length
    );
    const level = useSelector<AppState, number>((state) =>
        getPlayerLevel(state.game)
    );

    const inPreparingPhase = useSelector<AppState, boolean>(
        (state) => state.game.roundInfo.phase === GamePhase.PREPARING
    );

    if (!inPreparingPhase) {
        return null;
    }

    const isWarning = pieceCount < level;

    return (
        <div className={styles.pieceCountWrapper}>
            <div className={`${styles.pieceCountBadge} ${isWarning ? styles.pieceCountWarning : ""}`}>
                ⚔ {pieceCount} / {level}
            </div>
        </div>
    );
}
