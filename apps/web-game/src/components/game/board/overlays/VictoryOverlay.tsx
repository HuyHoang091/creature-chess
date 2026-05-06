import * as React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";
import { getPlayerById } from "~/store/selectors";

import styles from "./Overlays.module.css";

export function VictoryOverlay() {
	const winnerName = useSelector<AppState, string | null>((state) => {
		const { winnerId } = state.game.ui;

		if (!winnerId) {
			return null;
		}

		return getPlayerById(winnerId)(state)?.name || null;
	});

	const onMenuClick = () => (window.location.href = APP_URL);

	if (!winnerName) {
		return null;
	}

	return (
        <div className={styles.overlayContainer}>
            <div className={styles.overlayContent} style={{ borderColor: "#c8aa6e" }}>
                <div className={styles.overlayTitle} style={{ color: "#c8aa6e", textShadow: "0 0 15px rgba(200, 170, 110, 0.5)" }}>Victory</div>
                <div className={styles.overlaySubtitle} style={{ fontSize: '18px', fontWeight: 'bold' }}>
                    {winnerName} wins the game!
                </div>
                <div className={styles.overlayButtons}>
                    <button
                        className={`${styles.overlayBtn} ${styles.overlayBtnExit}`}
                        onClick={onMenuClick}
                    >
                        🏠 Main Menu
                    </button>
                </div>
            </div>
		</div>
	);
}
