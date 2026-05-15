import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type RoomInviteToast = {
	id: string;
	inviteId: string;
	fromNickname: string;
	createdAt: number;
	durationMs: number;
};

export type RoomInvitesState = {
	items: RoomInviteToast[];
};

const initialState: RoomInvitesState = {
	items: [],
};

export const {
	reducer: roomInvitesReducer,
	actions: RoomInviteCommands,
} = createSlice({
	name: "roomInvites",
	initialState,
	reducers: {
		addInviteToast: (state, action: PayloadAction<RoomInviteToast>) => {
			state.items.unshift(action.payload);
			state.items = state.items.slice(0, 3);
		},
		removeInviteToast: (state, action: PayloadAction<string>) => {
			state.items = state.items.filter((item) => item.id !== action.payload);
		},
		clearAllInviteToasts: (state) => {
			state.items = [];
		},
	},
});
