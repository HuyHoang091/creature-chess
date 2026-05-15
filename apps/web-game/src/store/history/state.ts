import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { MatchHistoryItemDto } from "@creature-chess/models";

export type HistoryState = {
	items: MatchHistoryItemDto[];
	nextCursor: string | null;
	loading: boolean;
	error: string | null;
};

const initialState: HistoryState = {
	items: [],
	nextCursor: null,
	loading: false,
	error: null,
};

export const { reducer: historyReducer, actions: HistoryCommands } = createSlice(
	{
		name: "history",
		initialState,
		reducers: {
			setPayload: (
				state,
				action: PayloadAction<{
					items: MatchHistoryItemDto[];
					nextCursor: string | null;
				}>
			) => {
				state.items = action.payload.items;
				state.nextCursor = action.payload.nextCursor;
			},
			appendPayload: (
				state,
				action: PayloadAction<{
					items: MatchHistoryItemDto[];
					nextCursor: string | null;
				}>
			) => {
				state.items = [...state.items, ...action.payload.items];
				state.nextCursor = action.payload.nextCursor;
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
