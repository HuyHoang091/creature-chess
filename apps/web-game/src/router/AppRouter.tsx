import React from "react";

import { useSelector } from "react-redux";
import { AppShell } from "~/components/app/AppShell";
import { Panel } from "~/components/app/Panel";

import { AiCoachUpgradePage } from "../pages/aiCoachUpgrade";
import { CompleteProfilePage } from "../pages/completeProfile";
import { FriendsPage } from "../pages/friends";
import { GamePage } from "../pages/game";
import { HistoryPage } from "../pages/history";
import { HomePage } from "../pages/home";
import { LobbyPage } from "../pages/lobby";
import { MenuPage } from "../pages/menu";
import { PrivateLobbyPage } from "../pages/privateLobby";
import { ProfilePage } from "../pages/profile";
import { ResultPage } from "../pages/result";
import { SettingsPage } from "../pages/settings";
import { VFXStorybook } from "../pages/storybook/VFXStorybook";
import { AppState } from "../store";
import { EventPage } from "../pages/event/EventPage";

export const AppRouter = () => {
	const pathname = window.location.pathname;
	const isInGame = useSelector((state: AppState) => state.game.ui.inGame);
	const isInLobby = useSelector((state: AppState) => state.lobby !== null);
	const screen = useSelector((state: AppState) => state.appShell.screen);
	const panel = useSelector((state: AppState) => state.appShell.panel);

	if (pathname.startsWith("/events/")) {
		const slug = pathname.split("/events/")[1];
		if (slug) {
			return <EventPage slug={slug} />;
		}
	}

	if (pathname === "/storybook") {
		return <VFXStorybook />;
	}

	if (pathname === "/admin") {
		window.location.replace(APP_ADMIN_URL);
		return null;
	}

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
	} else if (panel === "profile") {
		panelNode = (
			<Panel title="Profile">
				<ProfilePage />
			</Panel>
		);
	} else if (panel === "settings") {
		panelNode = (
			<Panel title="Settings">
				<SettingsPage />
			</Panel>
		);
	} else if (panel === "match-result") {
		panelNode = (
			<Panel title="Match Result">
				<ResultPage />
			</Panel>
		);
	} else if (panel === "ai-coach" as any) {
		panelNode = (
			<Panel title="AI Coach">
				<AiCoachUpgradePage />
			</Panel>
		);
	}

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

	return (
		<AppShell panel={panelNode}>
			<HomePage />
		</AppShell>
	);
};
