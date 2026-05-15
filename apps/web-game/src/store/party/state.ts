import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type PartyMemberState = {
	userId: string;
	nickname: string;
	profilePicture: number | null;
	isLeader: boolean;
	presence: "home" | "party" | "queue" | "lobby" | "game";
};

export type PartyState = {
	partyId: string | null;
	leaderId: string | null;
	members: PartyMemberState[];
	chat: { id: string; senderName: string; message: string; sentAt: string }[];
	inviteInbox: { id: string; fromUserId: string; fromName: string }[];
	status: "idle" | "in-party" | "queued" | "in-private-lobby";
};

const initialState: PartyState = {
	partyId: null,
	leaderId: null,
	members: [],
	chat: [],
	inviteInbox: [],
	status: "idle",
};

export const { reducer: partyReducer, actions: PartyCommands } = createSlice({
	name: "party",
	initialState,
	reducers: {
		setPartyState: (state, action: PayloadAction<Partial<PartyState>>) => ({
			...state,
			...action.payload,
		}),
		resetPartyState: () => initialState,
	},
});
