import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { RoomInviteDto, RoomSnapshotDto } from "@creature-chess/models";

export type PrivateLobbyState = RoomSnapshotDto & {
	loading: boolean;
	error: string | null;
	requestJoinPendingByUserId: Record<string, boolean>;
	decisionPendingByRequestId: Record<string, boolean>;
};

const initialState: PrivateLobbyState = {
	room: null,
	invites: [],
	loading: false,
	error: null,
	requestJoinPendingByUserId: {},
	decisionPendingByRequestId: {},
};

export const { reducer: privateLobbyReducer, actions: PrivateLobbyCommands } =
	createSlice({
		name: "privateLobby",
		initialState,
		reducers: {
			setSnapshot: (state, action: PayloadAction<RoomSnapshotDto>) => {
				state.room = action.payload.room;
				state.invites = action.payload.invites;
			},
			setLoading: (state, action: PayloadAction<boolean>) => {
				state.loading = action.payload;
			},
			setError: (state, action: PayloadAction<string | null>) => {
				state.error = action.payload;
			},
			setRequestJoinPending: (
				state,
				action: PayloadAction<{ userId: string; value: boolean }>
			) => {
				state.requestJoinPendingByUserId[action.payload.userId] = action.payload.value;
			},
			setDecisionPending: (
				state,
				action: PayloadAction<{ requestId: string; value: boolean }>
			) => {
				state.decisionPendingByRequestId[action.payload.requestId] =
					action.payload.value;
			},
			removeInvite: (state, action: PayloadAction<string>) => {
				state.invites = state.invites.filter((invite) => invite.id !== action.payload);
			},
			setInvites: (state, action: PayloadAction<RoomInviteDto[]>) => {
				state.invites = action.payload;
			},
		},
	});
