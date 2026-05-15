import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { UserDTO } from "@creature-chess/models";

export type ProfileState = {
	currentUser: UserDTO | null;
	statsSummary: {
		totalGames: number;
		wins: number;
	} | null;
	loading: boolean;
	error: string | null;
};

const initialState: ProfileState = {
	currentUser: null,
	statsSummary: null,
	loading: false,
	error: null,
};

export const { reducer: profileReducer, actions: ProfileCommands } = createSlice(
	{
		name: "profile",
		initialState,
		reducers: {
			setCurrentUser: (state, action: PayloadAction<UserDTO | null>) => {
				state.currentUser = action.payload;
				state.statsSummary = action.payload
					? {
							totalGames: action.payload.stats.gamesPlayed,
							wins: action.payload.stats.wins,
					  }
					: null;
			},
			setLoading: (state, action: PayloadAction<boolean>) => {
				state.loading = action.payload;
			},
			setError: (state, action: PayloadAction<string | null>) => {
				state.error = action.payload;
			},
		},
	}
);
