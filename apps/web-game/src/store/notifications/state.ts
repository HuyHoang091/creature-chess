import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NotificationState = {
	items: { id: string; message: string; read: boolean }[];
};

const initialState: NotificationState = {
	items: [],
};

export const {
	reducer: notificationsReducer,
	actions: NotificationCommands,
} = createSlice({
	name: "notifications",
	initialState,
	reducers: {
		pushNotification: (
			state,
			action: PayloadAction<{ id: string; message: string }>
		) => {
			state.items.unshift({
				id: action.payload.id,
				message: action.payload.message,
				read: false,
			});
			state.items = state.items.slice(0, 5);
		},
		setNotifications: (
			state,
			action: PayloadAction<NotificationState["items"]>
		) => {
			state.items = action.payload;
		},
		markRead: (state, action: PayloadAction<string>) => {
			const item = state.items.find((entry) => entry.id === action.payload);
			if (item) {
				item.read = true;
			}
		},
	},
});
