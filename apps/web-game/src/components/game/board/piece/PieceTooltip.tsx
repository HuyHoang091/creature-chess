import * as React from "react";
import { PieceModel } from "@creature-chess/models";

import styles from "./PieceTooltip.module.css";

import { getStats } from "@creature-chess/battle";

type Props = {
    piece: PieceModel;
};

export function PieceTooltip({ piece }: Props) {
    const def = piece.definition;
	const stats = def ? getStats(piece) : undefined;

    return (
        <div className={styles.tooltip}>
            <div className={styles.name}>{def?.name || `Piece #${piece.definitionId}`}</div>

            <div className={styles.row}>
                <span className={styles.label}>Stage</span>
                <span className={`${styles.value} ${styles.stageStars}`}>
                    {"★".repeat(piece.stage)}
                </span>
            </div>

            <div className={styles.row}>
                <span className={styles.label}>HP</span>
                <span className={`${styles.value} ${styles.hpGreen}`}>
                    {piece.currentHealth} / {stats?.hp || piece.maxHealth}
                </span>
            </div>

            {def && (
                <>
                    <div className={styles.row}>
                        <span className={styles.label}>ATK</span>
                        <span className={`${styles.value} ${styles.atkRed}`}>{stats?.attack}</span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>DEF</span>
                        <span className={`${styles.value} ${styles.defBlue}`}>{stats?.defense}</span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>SPD</span>
                        <span className={styles.value}>{stats?.speed}</span>
                    </div>
                    <div className={styles.row}>
                        <span className={styles.label}>Range</span>
                        <span className={styles.value}>{stats?.attackType.range}</span>
                    </div>
                </>
            )}

            {piece.traits.length > 0 && (
                <div className={styles.traitsRow}>
                    {piece.traits.map((t) => (
                        <span key={t} className={styles.traitTag}>{t}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
