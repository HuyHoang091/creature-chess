import React from "react";
import { useSelector } from "react-redux";
import { AppState } from "../store";
import { GamePage } from "../pages/game";
import { LobbyPage } from "../pages/lobby";
import { MenuPage } from "../pages/menu";
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

	if (isInGame) {
		return <GamePage />;
	}

	if (isInLobby) {
		return <LobbyPage />;
	}

	return <MenuPage />;
};
