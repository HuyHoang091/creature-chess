import { apiFetch } from "./api";
import type { PrivateRoomDto, RoomInviteDto, RoomSnapshotDto } from "@creature-chess/models";

export const fetchCurrentRoom = (token: string) =>
	apiFetch<RoomSnapshotDto>(
		"/rooms/current",
		{ method: "GET" },
		token
	);

export const createRoom = (token: string) =>
	apiFetch<{ room: PrivateRoomDto }>("/rooms", { method: "POST" }, token);

export const joinRoom = (token: string, code: string) =>
	apiFetch<{ room: PrivateRoomDto }>(
		"/rooms/join",
		{ method: "POST", body: JSON.stringify({ code }) },
		token
	);

export const leaveRoom = (token: string) =>
	apiFetch<{ room: PrivateRoomDto | null }>(
		"/rooms/leave",
		{ method: "POST" },
		token
	);

export const inviteToRoom = (token: string, targetUserId: string) =>
	apiFetch<{ invite: RoomInviteDto }>(
		"/rooms/invite",
		{ method: "POST", body: JSON.stringify({ targetUserId }) },
		token
	);

export const acceptRoomInvite = (token: string, inviteId: string) =>
	apiFetch<{ room: PrivateRoomDto }>(
		`/rooms/invite/${inviteId}/accept`,
		{ method: "POST" },
		token
	);

export const declineRoomInvite = (token: string, inviteId: string) =>
	apiFetch<{ success: boolean }>(
		`/rooms/invite/${inviteId}/decline`,
		{ method: "POST" },
		token
	);
