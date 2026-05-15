import React from "react";
import { useSelector } from "react-redux";
import { AppState } from "../store";
import { AppShell } from "~/components/app/AppShell";
import { Panel } from "~/components/app/Panel";
import { CompleteProfilePage } from "../pages/completeProfile";
import { FriendsPage } from "../pages/friends";
import { GamePage } from "../pages/game";
import { HistoryPage } from "../pages/history";
import { HomePage } from "../pages/home";
import { LobbyPage } from "../pages/lobby";
import { MenuPage } from "../pages/menu";
import { PrivateLobbyPage } from "../pages/privateLobby";
import { ResultPage } from "../pages/result";
import { VFXStorybook } from "../pages/storybook/VFXStorybook";

export const AppRouter = () => {
	// ==========================================
	// HIDDEN ROUTE: URL "/storybook" để test VFX
	// ==========================================
	if (window.location.pathname === "/storybook") {
		return <VFXStorybook />;
	}

	const isInGame = useSelector((state: AppState) => state.game.ui.inGame);
	const isInLobby = useSelector((state: AppState) => state.lobby !== null);
	const screen = useSelector((state: AppState) => state.appShell.screen);
	const panel = useSelector((state: AppState) => state.appShell.panel);

	if (isInGame) {
		return <GamePage />;
	}

	if (isInLobby) {
		return <LobbyPage />;
	}

	let panelNode: React.ReactNode = null;
	if (panel === "friends") {
		panelNode = (
			<Panel title="Friends">
				<FriendsPage />
			</Panel>
		);
	} else if (panel === "history") {
		panelNode = (
			<Panel title="Match History">
				<HistoryPage />
			</Panel>
		);
	} else if (panel === "match-result") {
		panelNode = (
			<Panel title="Match Result">
				<ResultPage />
			</Panel>
		);
	}

	// Full-screen pages (no AppShell wrapper)
	switch (screen) {
		case "auth-loading":
		case "landing":
			return <MenuPage />;
		case "complete-profile":
			return <CompleteProfilePage />;
		case "private-lobby":
			return (
				<>
					<PrivateLobbyPage />
					{panelNode}
				</>
			);
		default:
			break;
	}

	// Authenticated hub: always render HomePage background + optional panel
	return (
		<AppShell panel={panelNode}>
			<HomePage />
		</AppShell>
	);
};
