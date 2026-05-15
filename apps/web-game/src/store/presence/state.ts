import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { PresenceState } from "@creature-chess/models";

export type PresenceEntry = {
	online: boolean;
	state: PresenceState;
};

export type PresenceStoreState = Record<string, PresenceEntry>;

const initialState: PresenceStoreState = {};

export const { reducer: presenceReducer, actions: PresenceCommands } =
	createSlice({
		name: "presence",
		initialState,
		reducers: {
			setPresence: (
				state,
				action: PayloadAction<{ userId: string; value: PresenceEntry }>
			) => {
				state[action.payload.userId] = action.payload.value;
			},
		},
	});
