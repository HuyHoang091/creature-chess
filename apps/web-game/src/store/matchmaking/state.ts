import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type MatchmakingState = {
	queueState: "idle" | "searching" | "matched" | "cancelled" | "error";
	queueType: "casual-public";
	estimatedWaitSeconds: number | null;
	startedAt: number | null;
	partySize: number;
};

const initialState: MatchmakingState = {
	queueState: "idle",
	queueType: "casual-public",
	estimatedWaitSeconds: null,
	startedAt: null,
	partySize: 1,
};

export const {
	reducer: matchmakingReducer,
	actions: MatchmakingCommands,
} = createSlice({
	name: "matchmaking",
	initialState,
	reducers: {
		setQueueState: (
			state,
			action: PayloadAction<MatchmakingState["queueState"]>
		) => {
			state.queueState = action.payload;
			if (action.payload === "searching") {
				state.startedAt = Date.now();
			}
			if (action.payload === "idle" || action.payload === "cancelled") {
				state.startedAt = null;
			}
		},
		setEstimatedWaitSeconds: (
			state,
			action: PayloadAction<number | null>
		) => {
			state.estimatedWaitSeconds = action.payload;
		},
		setPartySize: (state, action: PayloadAction<number>) => {
			state.partySize = action.payload;
		},
	},
});
