import * as React from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";

import { PlayerActions } from "@creature-chess/gamemode";
import { GamePhase } from "@creature-chess/models";
import {
    PlayerListPlayer,
    PlayerStatus,
} from "@creature-chess/models/game/playerList";

import { PlayerAvatar } from "../../ui/player";
import styles from "./PlayerList.module.css";

function getHpColor(healthPercent: number): string {
    if (healthPercent > 0.6) return "#22a15c";
    if (healthPercent > 0.3) return "#c8aa6e";
    return "#e74c3c";
}

export function PlayerListTFT() {
    const dispatch = useDispatch();
    const localPlayerId = useLocalPlayerId();

    const players = useSelector<AppState, PlayerListPlayer[]>(
        (state) => state.game.playerList
    );

    const currentlySpectatingId = useSelector<AppState, string | null>(
        (state) => state.game.spectating.id
    );

    const opponentId = useSelector<AppState, string | null>(
        (state) => state.game.playerInfo.opponentId
    );
    const phase = useSelector<AppState, GamePhase | null>(
        (state) => state.game.roundInfo.phase
    );
    const showOpponent = opponentId !== null
        && (phase === GamePhase.READY || phase === GamePhase.PLAYING);

    const maxHealth = 100;

    const handleClick = (player: PlayerListPlayer) => {
        if (player.id === localPlayerId) return;
        if (player.status === PlayerStatus.DEAD || player.status === PlayerStatus.QUIT) return;

        const isSpectating = currentlySpectatingId === player.id;
        dispatch(
            PlayerActions.spectatePlayerAction(
                isSpectating ? { playerId: null } : { playerId: player.id }
            )
        );
    };

    return (
        <div className={styles.list}>
            <div className={styles.title}>Players</div>
            {players.map((player, index) => {
                const isLocal = player.id === localPlayerId;
                const isSpectating = currentlySpectatingId === player.id;
                const isDead = player.status === PlayerStatus.DEAD;
                const isQuit = player.status === PlayerStatus.QUIT;
                const healthPercent = player.health / maxHealth;
                const isOpponent = showOpponent && player.id === opponentId;

                let itemClass = styles.playerItem;
                if (isLocal) itemClass += ` ${styles.playerItemLocal}`;
                if (isSpectating) itemClass += ` ${styles.playerItemSpectating}`;
                if (isOpponent) itemClass += ` ${styles.playerItemOpponent}`;
                if (isDead || isQuit) itemClass += ` ${styles.playerItemDead}`;

                return (
                    <div
                        key={player.id}
                        className={itemClass}
                        onClick={() => handleClick(player)}
                    >
                        <span className={styles.rank}>{index + 1}</span>
                        <div className={styles.avatarWrapper}>
                            <PlayerAvatar player={player} className={styles.avatarImg} />
                        </div>
                        <div className={styles.info}>
                            <div className={styles.nameRow}>
                                <span className={styles.name}>
                                    {player.name}
                                    {isOpponent && (
                                        <span className={styles.opponentIcon}>⚔️</span>
                                    )}
                                </span>
                                <span className={styles.level}>Lv.{player.level}</span>
                            </div>
                            {isDead ? (
                                <span className={styles.deadBadge}>☠ ELIMINATED</span>
                            ) : isQuit ? (
                                <span className={styles.quitBadge}>LEFT</span>
                            ) : (
                                <>
                                    <div className={styles.hpBarOuter}>
                                        <div
                                            className={styles.hpBarInner}
                                            style={{
                                                width: `${healthPercent * 100}%`,
                                                background: getHpColor(healthPercent),
                                            }}
                                        />
                                    </div>
                                    <span className={styles.hpText}>
                                        {player.health} HP
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
