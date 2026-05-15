import * as React from "react";

import { useSelector } from "react-redux";
import { DesktopGame } from "~/components/game";
import { GamemodeSettingsContextProvider } from "~/contexts/GamemodeSettingsContext";
import { AppState } from "~/store";

import styles from "./GamePage.module.css";

export function GamePage() {
	const settings = useSelector((state: AppState) => state.game.settings);

	return (
		<GamemodeSettingsContextProvider value={settings}>
			<div className={styles.gameWrapper}>
				<div className={styles.portraitWarning}>
					<div className={styles.portraitWarningContent}>
						<svg
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
							<line x1="12" y1="18" x2="12.01" y2="18"></line>
						</svg>
						<p>Xin vui long xoay ngang man hinh de choi he thong co nay.</p>
					</div>
				</div>
				<div className={styles.gameContent}>
					<DesktopGame />
				</div>
			</div>
		</GamemodeSettingsContextProvider>
	);
}
