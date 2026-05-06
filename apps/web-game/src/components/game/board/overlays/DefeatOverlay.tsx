import * as React from "react";
import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";

import styles from "./Overlays.module.css";

// Dùng module-level variable để persist qua re-mount
let defeatDismissed = false;

export function DefeatOverlay() {
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const localPlayerId = useLocalPlayerId();

    const localPlayer = useSelector((state: AppState) =>
        state.game.playerList.find((p) => p.id === localPlayerId)
    );

    const winnerId = useSelector((state: AppState) => state.game.ui.winnerId);

    // Reset khi game mới (winnerId xuất hiện = game kết thúc, reset cho game tiếp)
    React.useEffect(() => {
        if (winnerId) {
            defeatDismissed = false;
        }
    }, [winnerId]);

    if (
        defeatDismissed ||
        winnerId ||
        !localPlayer ||
        localPlayer.health > 0
    ) {
        return null;
    }

    const onSpectate = () => {
        defeatDismissed = true;
        forceUpdate();
    };

    const onMainMenu = () => {
        window.location.href = APP_URL;
    };

    return (
        <div className={styles.overlayContainer}>
            <div className={styles.overlayContent}>
                <div className={styles.overlayTitle}>Defeated</div>
                <div className={styles.overlaySubtitle}>
                    You have been eliminated. Would you like to spectate the rest of the game?
                </div>
                <div className={styles.overlayButtons}>
                    <button
                        className={`${styles.overlayBtn} ${styles.overlayBtnSpectate}`}
                        onClick={onSpectate}
                    >
                        👁 Spectate
                    </button>
                    <button
                        className={`${styles.overlayBtn} ${styles.overlayBtnExit}`}
                        onClick={onMainMenu}
                    >
                        🏠 Main Menu
                    </button>
                </div>
            </div>
        </div>
    );
}
