import * as React from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { BalanceIcon } from "~/components/ui/icon/BalanceIcon";
import { useGamemodeSettings } from "~/contexts/GamemodeSettingsContext";
import { AppState } from "~/store";

import {
    PlayerActions,
    getPlayerLevel,
    getPlayerMoney,
    getPlayerXp,
} from "@creature-chess/gamemode";
import { getXpToNextLevel } from "@creature-chess/gamemode/src/player/xp";
import { MAX_LEVEL } from "@creature-chess/models/config";

import {
    faArrowsRotate,
    faLock,
    faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./PlayerGameProfile.module.css";

export function PlayerGameProfile() {
    const { buyXpAmount, buyXpCost, rerollCost } = useGamemodeSettings();

    const dispatch = useDispatch();

    const playerId = useLocalPlayerId();

    const level = useSelector<AppState, number>((state) =>
        getPlayerLevel(state.game)
    );
    const xp = useSelector<AppState, number>((state) => getPlayerXp(state.game));
    const money = useSelector<AppState, number>((state) =>
        getPlayerMoney(state.game)
    );
    const health = useSelector<AppState, number | null>((state) => {
        const player = state.game.playerList.find((p) => p.id === playerId);
        return player?.health || null;
    });

    const shopLocked = useSelector<AppState, boolean>(
        (state) => state.game.cardShop.locked
    );

    const onBuyXp = () => dispatch(PlayerActions.buyXpPlayerAction());
    const onReroll = () => dispatch(PlayerActions.rerollCardsPlayerAction());
    const onToggleLock = () => dispatch(PlayerActions.toggleShopLockPlayerAction());

    if (health === null) {
        return null;
    }

    const xpMax = level < MAX_LEVEL ? getXpToNextLevel(level) : 1;
    const xpPercent = level < MAX_LEVEL ? (xp / xpMax) * 100 : 100;

    return (
        <div className={styles.profile}>
            {/* Level Badge */}
            <div className={styles.levelBadge}>
                <span className={styles.levelNumber}>{level}</span>
                <span className={styles.levelLabel}>Level</span>
            </div>

            {/* XP Bar */}
            {level < MAX_LEVEL && (
                <>
                    <div className={styles.xpBarOuter}>
                        <div
                            className={styles.xpBarInner}
                            style={{ width: `${xpPercent}%` }}
                        />
                    </div>
                    <span className={styles.xpText}>
                        {xp}/{xpMax} XP
                    </span>
                </>
            )}

            {/* Gold */}
            <div className={styles.goldDisplay}>
                <span className={styles.goldIcon}>🪙</span>
                <span>{money}</span>
            </div>

            {/* Buttons: Buy XP / Reroll / Lock */}
            <div className={styles.buttonsRow}>
                {level < MAX_LEVEL && (
                    <button
                        className={styles.btn}
                        onClick={onBuyXp}
                        disabled={money < buyXpCost}
                    >
                        <span>Buy XP</span>
                        <span className={styles.btnCost}>${buyXpCost}</span>
                    </button>
                )}

                <button
                    className={`${styles.btn} ${styles.btnReroll}`}
                    onClick={onReroll}
                    disabled={money < rerollCost}
                >
                    <FontAwesomeIcon icon={faArrowsRotate} />
                    <span className={styles.btnCost}>${rerollCost}</span>
                </button>

                <button
                    className={`${styles.btn} ${shopLocked ? styles.btnLock : ""}`}
                    onClick={onToggleLock}
                >
                    <FontAwesomeIcon icon={shopLocked ? faLock : faLockOpen} />
                </button>
            </div>
        </div>
    );
}
