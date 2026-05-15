import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type JoinRequestToast = {
	id: string;
	requestId: string;
	requesterNickname: string;
	createdAt: number;
	durationMs: number;
};

export type JoinRequestToastsState = {
	items: JoinRequestToast[];
};

const initialState: JoinRequestToastsState = {
	items: [],
};

export const {
	reducer: joinRequestToastsReducer,
	actions: JoinRequestToastCommands,
} = createSlice({
	name: "joinRequestToasts",
	initialState,
	reducers: {
		addJoinRequestToast: (state, action: PayloadAction<JoinRequestToast>) => {
			state.items.unshift(action.payload);
			state.items = state.items.slice(0, 3);
		},
		removeJoinRequestToast: (state, action: PayloadAction<string>) => {
			state.items = state.items.filter((item) => item.id !== action.payload);
		},
		clearAllJoinRequestToasts: (state) => {
			state.items = [];
		},
	},
});
