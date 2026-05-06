import * as React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";
import styles from "./DebugBar.module.css";

export function DebugBar() {
	const network = useSelector<AppState, AppState["game"]["network"]>(
		(state) => state.game.network
	);

	const [timeoutState, setTimeoutState] = React.useState(false);

	React.useEffect(() => {
		const interval = setInterval(() => {
			const timeSinceLast = Date.now() - network.lastPingTimestamp;

			if (timeSinceLast > 5000) {
				setTimeoutState(true);
			} else {
				setTimeoutState(false);
			}
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [network.lastPingTimestamp]);

	return (
		<div className={styles.debugBar}>
			<span className={styles.ping}>
				{timeoutState ? "XXX" : `${network.pingMs}ms`}
			</span>
		</div>
	);
}
