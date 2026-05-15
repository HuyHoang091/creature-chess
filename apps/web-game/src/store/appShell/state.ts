import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type AppScreen =
	| "landing"
	| "auth-loading"
	| "complete-profile"
	| "home"
	| "friends"
	| "party"
	| "private-lobby"
	| "public-queue"
	| "match-result"
	| "history"
	| "game";

export type AppShellState = {
	screen: AppScreen;
	panel: AppScreen | null;
	modal: string | null;
	lastError: string | null;
	isBootstrapped: boolean;
};

const initialState: AppShellState = {
	screen: "landing",
	panel: null,
	modal: null,
	lastError: null,
	isBootstrapped: false,
};

export const { reducer: appShellReducer, actions: AppShellCommands } =
	createSlice({
		name: "appShell",
		initialState,
		reducers: {
			setScreen: (state, action: PayloadAction<AppScreen>) => {
				state.screen = action.payload;
				state.panel = null;
			},
			setPanel: (state, action: PayloadAction<AppScreen | null>) => {
				state.panel = action.payload;
			},
			setModal: (state, action: PayloadAction<string | null>) => {
				state.modal = action.payload;
			},
			setLastError: (state, action: PayloadAction<string | null>) => {
				state.lastError = action.payload;
			},
			setBootstrapped: (state, action: PayloadAction<boolean>) => {
				state.isBootstrapped = action.payload;
			},
		},
	});
