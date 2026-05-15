import React from "react";
import { useSelector } from "react-redux";

import { pingPresence } from "~/services/presenceApi";
import { AppState } from "~/store/state";

const mapScreenToPresence = (screen: AppState["appShell"]["screen"]) => {
	if (screen === "private-lobby") {
		return "lobby";
	}
	if (screen === "public-queue") {
		return "queue";
	}
	if (screen === "party") {
		return "party";
	}
	return "home";
};

export const usePresenceHeartbeat = () => {
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const screen = useSelector((state: AppState) => state.appShell.screen);
	const inGame = useSelector((state: AppState) => state.game.ui.inGame);
	const inLobby = useSelector((state: AppState) => state.lobby !== null);

	React.useEffect(() => {
		if (!token || authMode !== "account") {
			return;
		}

		const state = inGame
			? "game"
			: inLobby
				? "lobby"
				: mapScreenToPresence(screen);

		let cancelled = false;

		const tick = async () => {
			if (cancelled) {
				return;
			}

			try {
				await pingPresence(token, state);
			} catch (error) {
				// swallow heartbeat errors
			}
		};

		tick();
		const interval = window.setInterval(tick, 15000);

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [authMode, inGame, inLobby, screen, token]);
};
