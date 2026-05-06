import * as React from "react";

import { useSetSetting, useSetting } from "~/settings";

import { QuitGameButton } from "./quitGameButton";
import styles from "./Settings.module.css";

export function Settings() {
	const showPing = useSetting("showPing");
	const setShowPing = useSetSetting("showPing");

	return (
		<div className={styles.settings}>
			<div>
				<QuitGameButton />
			</div>

			<div className={styles.row}>
				<input
					type="checkbox"
					checked={showPing}
					onChange={() => setShowPing(!showPing)}
                    className={styles.checkboxInput}
                    id="showPingCheck"
				/>

				<label htmlFor="showPingCheck" className={styles.checkboxLabel}>Show ping</label>
			</div>
		</div>
	);
}
