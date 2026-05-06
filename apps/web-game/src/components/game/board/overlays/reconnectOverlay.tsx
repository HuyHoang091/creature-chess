import * as React from "react";

import { useSelector } from "react-redux";
import { ConnectionStatus } from "~/services/connection-status";
import { AppState } from "~/store";

import { Group } from "../../../ui/layout";
import styles from "./Overlays.module.css";

const ReconnectOverlay: React.FunctionComponent = () => {
	const connectionStatus = useSelector<AppState, ConnectionStatus>(
		(state) => state.game.ui.connectionStatus
	);

	if (
		connectionStatus === ConnectionStatus.NOT_CONNECTED ||
		connectionStatus === ConnectionStatus.CONNECTED
	) {
		return null;
	}

	return (
		<div className={styles.overlayContainer}>
			<div className={styles.overlayContent}>
				<Group>
					{connectionStatus === ConnectionStatus.DISCONNECTED && (
						<>
							<h2 style={{color: '#e74c3c'}}>Disconnecting...</h2>
							<p>You've been disconnected - but you can get back in!</p>
							<p>Please refresh the page to rejoin</p>
						</>
					)}
				</Group>
			</div>
		</div>
	);
};

export { ReconnectOverlay };
