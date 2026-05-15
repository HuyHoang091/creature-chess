import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type AuthMode = "guest" | "account" | "anonymous";
export type AuthStatus =
	| "idle"
	| "loading"
	| "authenticated"
	| "unauthenticated";

export type AuthState = {
	mode: AuthMode;
	status: AuthStatus;
	localPlayerId: string;
	accessToken: string | null;
	requiresProfileCompletion: boolean;
};

const initialState: AuthState = {
	mode: "anonymous",
	status: "idle",
	localPlayerId: "",
	accessToken: null,
	requiresProfileCompletion: false,
};

export const { reducer: authReducer, actions: AuthCommands } = createSlice({
	name: "auth",
	initialState,
	reducers: {
		setMode: (state, action: PayloadAction<AuthMode>) => {
			state.mode = action.payload;
		},
		setStatus: (state, action: PayloadAction<AuthStatus>) => {
			state.status = action.payload;
		},
		setLocalPlayerId: (state, action: PayloadAction<string>) => {
			state.localPlayerId = action.payload;
		},
		setAccessToken: (state, action: PayloadAction<string | null>) => {
			state.accessToken = action.payload;
		},
		setRequiresProfileCompletion: (state, action: PayloadAction<boolean>) => {
			state.requiresProfileCompletion = action.payload;
		},
		resetAuth: () => initialState,
	},
});
