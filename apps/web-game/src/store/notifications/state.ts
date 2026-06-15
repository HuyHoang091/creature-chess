import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NotificationState = {
	items: { id: string; message: string; read: boolean; data?: any }[];
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
			action: PayloadAction<{ id: string; message: string; data?: any }>
		) => {
			const existingIndex = state.items.findIndex(item => item.id === action.payload.id);
			if (existingIndex >= 0) {
				// Move existing notification to top but keep read status
				const [existing] = state.items.splice(existingIndex, 1);
				state.items.unshift({ ...existing, message: action.payload.message, data: action.payload.data });
			} else {
				state.items.unshift({
					id: action.payload.id,
					message: action.payload.message,
					read: false,
					data: action.payload.data,
				});
			}
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
