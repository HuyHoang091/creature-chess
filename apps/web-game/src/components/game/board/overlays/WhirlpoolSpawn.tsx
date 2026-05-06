import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";
import { revealEnemyPieces, hideEnemyPieces } from "~/store/game/ui";

import { GamePhase } from "@creature-chess/models";
import { WhirlpoolEffect } from "./effectAppears";

import styles from "./Overlays.module.css";

const WHIRLPOOL_APPEAR_MS = 600;
const PARTICLE_FLY_MS = 800;
const REVEAL_MS = 600;
const TOTAL_MS = WHIRLPOOL_APPEAR_MS + PARTICLE_FLY_MS + REVEAL_MS;

type SpawnPhase = "idle" | "whirlpool" | "particles" | "reveal";

interface SpawnTarget {
    targetXPercent: number;
    targetYPercent: number;
    delay: number;
}

export function WhirlpoolSpawn() {
    const dispatch = useDispatch();
    const localPlayerId = useLocalPlayerId();

    const phase = useSelector<AppState, GamePhase | null>(
        (state) => state.game.roundInfo.phase
    );
    const matchBoard = useSelector(
        (state: AppState) => state.game.match?.board
    );

    const [spawnPhase, setSpawnPhase] = useState<SpawnPhase>("idle");
    const hasSpawnedRef = React.useRef(false);

    // Tính vị trí quân địch
    const enemyTargets: SpawnTarget[] = useMemo(() => {
        if (!matchBoard) return [];

        const { piecePositions, pieces, size } = matchBoard;
        const targets: SpawnTarget[] = [];

        Object.entries(piecePositions).forEach(([posKey, pieceId]) => {
            const piece = pieces[pieceId];
            if (!piece || piece.ownerId === localPlayerId) return;

            const [x, y] = posKey.split(",").map(Number);
            targets.push({
                targetXPercent: ((x + 0.5) / size.width) * 100,
                targetYPercent: ((y + 0.5) / size.height) * 100,
                delay: Math.random() * 0.3,
            });
        });

        return targets;
    }, [matchBoard, localPlayerId]);

    useEffect(() => {
        // --- PREPARING Phase: Reset ---
        if (phase === GamePhase.PREPARING) {
            hasSpawnedRef.current = false;
            setSpawnPhase("idle");
            dispatch(revealEnemyPieces());
            return;
        }

        // --- READY Phase: Start Whirlpool ---
        if (phase === GamePhase.READY) {
            hasSpawnedRef.current = false;
            setSpawnPhase("whirlpool");
            dispatch(hideEnemyPieces());
            return;
        }

        // --- PLAYING Phase: Switch to particles one time ---
        if (phase === GamePhase.PLAYING && matchBoard && !hasSpawnedRef.current) {
            hasSpawnedRef.current = true;

            if (enemyTargets.length === 0) {
                // Ghost target / empty board
                setSpawnPhase("idle");
                dispatch(revealEnemyPieces());
                return;
            }

            setSpawnPhase("particles");

            const t1 = setTimeout(() => {
                setSpawnPhase("reveal");
                dispatch(revealEnemyPieces());
            }, PARTICLE_FLY_MS);

            const t2 = setTimeout(() => setSpawnPhase("idle"), PARTICLE_FLY_MS + REVEAL_MS);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [phase, matchBoard, enemyTargets.length, dispatch]);

    if (spawnPhase === "idle") return null;

    return (
        <div className={styles.whirlpoolOverlay}>
            {/* Xoáy nước trung tâm */}
            {(spawnPhase === "whirlpool" || spawnPhase === "particles") && (
                <div
                    className={`${styles.whirlpoolCenter} ${
                        spawnPhase === "particles" ? styles.whirlpoolFading : ""
                    }`}
                >
                    <WhirlpoolEffect
                        size={180}
                        speedMultiplier={2.5}
                        intensity={1.5}
                        hue={180}
                    />
                </div>
            )}

            {/* Đốm sáng bay đến vị trí quân địch */}
            {(spawnPhase === "particles" || spawnPhase === "reveal") &&
                enemyTargets.map((target, i) => (
                    <React.Fragment key={i}>
                        <div
                            className={styles.whirlpoolParticle}
                            style={{
                                "--tx": `${target.targetXPercent}%`,
                                "--ty": `${target.targetYPercent}%`,
                                "--delay": `${target.delay}s`,
                            } as React.CSSProperties}
                        />
                        {/* Flash tại vị trí đích */}
                        <div
                            className={styles.whirlpoolFlash}
                            style={{
                                left: `${target.targetXPercent}%`,
                                top: `${target.targetYPercent}%`,
                                "--flash-delay": `${target.delay + 0.7}s`,
                            } as React.CSSProperties}
                        />
                    </React.Fragment>
                ))}
        </div>
    );
}
