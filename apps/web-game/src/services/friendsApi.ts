import type { FriendDto, FriendsResponseDto } from "@creature-chess/models";

import { apiFetch } from "./api";

export const fetchFriends = (token: string) =>
	apiFetch<FriendsResponseDto>("/friends", { method: "GET" }, token);

export const searchFriends = (token: string, query: string) =>
	apiFetch<{ results: FriendDto[] }>(
		`/friends/search?q=${encodeURIComponent(query)}`,
		{ method: "GET" },
		token
	);

export const sendFriendRequest = (token: string, targetUserId: string) =>
	apiFetch("/friends/request", {
		method: "POST",
		body: JSON.stringify({ targetUserId }),
	}, token);

export const acceptFriendRequest = (token: string, requestId: string) =>
	apiFetch(`/friends/request/${requestId}/accept`, { method: "POST" }, token);

export const declineFriendRequest = (token: string, requestId: string) =>
	apiFetch(`/friends/request/${requestId}/decline`, { method: "POST" }, token);

export const cancelFriendRequest = (token: string, requestId: string) =>
	apiFetch(`/friends/request/${requestId}/cancel`, { method: "POST" }, token);

export const removeFriend = (token: string, userId: string) =>
	apiFetch(`/friends/${userId}`, { method: "DELETE" }, token);

export const blockUser = (token: string, targetUserId: string) =>
	apiFetch(
		"/blocks",
		{
			method: "POST",
			body: JSON.stringify({ targetUserId }),
		},
		token
	);

export const unblockUser = (token: string, userId: string) =>
	apiFetch(`/blocks/${userId}`, { method: "DELETE" }, token);
