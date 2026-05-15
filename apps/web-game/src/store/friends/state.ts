import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
	type BlockedUserDto,
	type FriendDto,
	type FriendRequestDto,
} from "@creature-chess/models";

export type FriendsState = {
	friends: FriendDto[];
	incomingRequests: FriendRequestDto[];
	outgoingRequests: FriendRequestDto[];
	blockedUsers: BlockedUserDto[];
	searchResults: FriendDto[];
	loading: boolean;
	error: string | null;
	hydrated: boolean;
	hydratedForUserId: string | null;
};

const presenceRank: Record<FriendDto["presence"], number> = {
	offline: 0,
	online: 1,
	in_room: 2,
	in_game: 3,
};

const mergeFriendsPreservingPresence = (
	current: FriendDto[],
	incoming: FriendDto[]
) => {
	const currentById = new Map(current.map((item) => [item.userId, item]));
	return incoming.map((item) => {
		const existing = currentById.get(item.userId);
		if (!existing) {
			return item;
		}
		return presenceRank[existing.presence] > presenceRank[item.presence]
			? { ...item, presence: existing.presence }
			: item;
	});
};

const initialState: FriendsState = {
	friends: [],
	incomingRequests: [],
	outgoingRequests: [],
	blockedUsers: [],
	searchResults: [],
	loading: false,
	error: null,
	hydrated: false,
	hydratedForUserId: null,
};

export const { reducer: friendsReducer, actions: FriendsCommands } = createSlice(
	{
		name: "friends",
		initialState,
		reducers: {
			setPayload: (
				state,
				action: PayloadAction<
					Pick<
						FriendsState,
						"friends" | "incomingRequests" | "outgoingRequests" | "blockedUsers"
					>
				>
			) => {
				state.friends = action.payload.friends;
				state.incomingRequests = action.payload.incomingRequests;
				state.outgoingRequests = action.payload.outgoingRequests;
				state.blockedUsers = action.payload.blockedUsers;
				state.hydrated = true;
			},
			hydratePayload: (
				state,
				action: PayloadAction<
					Pick<
						FriendsState,
						"friends" | "incomingRequests" | "outgoingRequests" | "blockedUsers"
					> & { userId: string }
				>
			) => {
				state.friends = mergeFriendsPreservingPresence(
					state.friends,
					action.payload.friends
				);
				state.incomingRequests = action.payload.incomingRequests;
				state.outgoingRequests = action.payload.outgoingRequests;
				state.blockedUsers = action.payload.blockedUsers;
				state.hydrated = true;
				state.hydratedForUserId = action.payload.userId;
			},
			setSearchResults: (state, action: PayloadAction<FriendDto[]>) => {
				state.searchResults = action.payload;
			},
			setLoading: (state, action: PayloadAction<boolean>) => {
				state.loading = action.payload;
			},
			setError: (state, action: PayloadAction<string | null>) => {
				state.error = action.payload;
			},
			reset: () => initialState,
		},
	}
);
