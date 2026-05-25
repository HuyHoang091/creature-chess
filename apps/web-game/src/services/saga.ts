import { createAction } from "@reduxjs/toolkit";
import { eventChannel } from "redux-saga";
import { Socket } from "socket.io-client";
import { all, call, cancel, delay, fork, put, select, take } from "typed-redux-saga";
import { gameSaga } from "~/sagas";
import { AUTH0_ENABLED } from "~/auth/auth0/config";
import {
	setStoredLocalToken,
	setStoredMode,
} from "~/auth/SessionBootstrapProvider";
import { AppShellCommands } from "~/store/appShell/state";
import { AuthCommands } from "~/store/auth/state";
import { FriendsCommands } from "~/store/friends/state";
import { MenuCommands } from "~/store/menu/state";
import { NotificationCommands } from "~/store/notifications/state";
import { PrivateLobbyCommands } from "~/store/privateLobby/state";
import { ProfileCommands } from "~/store/profile/state";
import { RoomInviteCommands } from "~/store/roomInvites/state";
import { JoinRequestToastCommands } from "~/store/joinRequestToasts/state";
import { AppState } from "~/store/state";
import { getCookieValue } from "~/utils/getCookieValue";

import { BoardSlice } from "@shoki/board";

import { PieceModel, RoomSnapshotDto } from "@creature-chess/models";
import { GameServerToClient, LobbyServerToClient } from "@creature-chess/networking";
import { HandshakeIntent, HandshakeRequest } from "@creature-chess/networking/handshake";

import { gameNetworking } from "./game";
import { lobbyNetworking } from "./lobby/networking";
import { clearCurrentSocket } from "./socket";
import { getSocket } from "./socket";

type ConnectionResult =
	| {
			type: "lobby";
			payload: LobbyServerToClient.LobbyConnectionPacket;
	  }
	| {
			type: "game";
			payload: GameServerToClient.GameConnectionPacket;
	  }
	| {
			type: "action";
			payload: any;
	  }
	| {
			type: "forced-logout";
			payload: { reason?: string; expiresAt?: string | null };
	  };

type BoardSlices = {
	boardSlice: BoardSlice<PieceModel>;
	benchSlice: BoardSlice<PieceModel>;
};

const listenForConnection = function* (socket: Socket, slices: BoardSlices) {
	const channel = eventChannel<ConnectionResult>((emit) => {
		const onLobbyConnected = (
			payload: LobbyServerToClient.LobbyConnectionPacket
		) => emit({ type: "lobby", payload });
		const onGameConnected = (
			payload: GameServerToClient.GameConnectionPacket
		) => emit({ type: "game", payload });
		const onFriendsSnapshot = (payload: AppState["friends"]) =>
			emit({ type: "action", payload: FriendsCommands.setPayload(payload) });
		const onRoomSnapshot = (payload: RoomSnapshotDto) =>
			emit({ type: "action", payload: PrivateLobbyCommands.setSnapshot(payload) });
		const onJoinRequestResolved = (payload: {
			requestId: string;
			status: "accepted" | "declined";
		}) =>
			emit({
				type: "action",
				payload: NotificationCommands.pushNotification({
					id: payload.requestId,
					message:
						payload.status === "accepted"
							? "Join request accepted"
							: "Join request declined",
				}),
			});
		const onJoinRequestReceived = (payload: {
			id: string;
			requesterNickname: string;
		}) =>
			emit({
				type: "action",
				payload: JoinRequestToastCommands.addJoinRequestToast({
					id: payload.id,
					requestId: payload.id,
					requesterNickname: payload.requesterNickname,
					createdAt: Date.now(),
					durationMs: 10000,
				}),
			});
		const onRoomInviteReceived = (payload: { id: string; fromNickname: string }) =>
			emit({
				type: "action",
				payload: RoomInviteCommands.addInviteToast({
					id: payload.id,
					inviteId: payload.id,
					fromNickname: payload.fromNickname,
					createdAt: Date.now(),
					durationMs: 10000,
				}),
			});
		const onForcedLogout = (payload: {
			reason?: string;
			expiresAt?: string | null;
		}) => emit({ type: "forced-logout", payload });

		socket.on("connected", onLobbyConnected);
		socket.on("gameConnected", onGameConnected);
		socket.on("friendsSnapshot", onFriendsSnapshot);
		socket.on("roomSnapshot", onRoomSnapshot);
		socket.on("roomJoinRequestResolved", onJoinRequestResolved);
		socket.on("roomJoinRequestReceived", onJoinRequestReceived);
		socket.on("roomInviteReceived", onRoomInviteReceived);
		socket.on("auth:forcedLogout", onForcedLogout);

		return () => {
			socket.off("connected", onLobbyConnected);
			socket.off("gameConnected", onGameConnected);
			socket.off("friendsSnapshot", onFriendsSnapshot);
			socket.off("roomSnapshot", onRoomSnapshot);
			socket.off("roomJoinRequestResolved", onJoinRequestResolved);
			socket.off("roomJoinRequestReceived", onJoinRequestReceived);
			socket.off("roomInviteReceived", onRoomInviteReceived);
			socket.off("auth:forcedLogout", onForcedLogout);
		};
	});

	let lobbyTask;

	while (true) {
		const connection = yield* take(channel);
		if (connection.type === "lobby") {
			lobbyTask = yield* fork(lobbyNetworking, socket, connection.payload);
			continue;
		}

		if (connection.type === "game") {
			if (lobbyTask) {
				yield cancel(lobbyTask);
			}
			yield all([
				call(gameNetworking, socket, connection.payload),
				call(gameSaga, connection.payload, slices),
			]);
			continue;
		}

		if (connection.type === "forced-logout") {
			clearCurrentSocket();
			setStoredLocalToken(null);
			setStoredMode("anonymous");
			yield put(FriendsCommands.reset());
			yield put(ProfileCommands.setCurrentUser(null));
			yield put(AuthCommands.resetAuth());
			yield put(PrivateLobbyCommands.setSnapshot({ room: null, invites: [] }));
			yield put(
				NotificationCommands.pushNotification({
					id: `forced-logout-${Date.now()}`,
					message:
						connection.payload.reason ||
						"Tài khoản của bạn đã bị thu hồi quyền truy cập.",
				})
			);
			yield put(
				MenuCommands.setLoadingMessage(
					connection.payload.reason || "Phiên đăng nhập đã bị kết thúc."
				)
			);
			yield put(AppShellCommands.setPanel(null));
			yield put(AppShellCommands.setScreen("landing"));
			continue;
		}

		yield put(connection.payload);
	}
};

async function getGuestSession() {
	const response = await fetch(APP_API_URL + "/guest/session", {
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		return null;
	}

	const { id } = await response.json();
	return id as string;
}

export const openConnection = createAction("openConnection");
export const ensureConnection = createAction("ensureConnection");

const buildHandshakeRequest = async (
	state: AppState,
	intent: HandshakeIntent
): Promise<HandshakeRequest | null> => {
	if (state.auth.mode === "account" && state.auth.accessToken) {
		return {
			type: AUTH0_ENABLED ? "auth0" : "local",
			data: {
				accessToken: state.auth.accessToken,
				intent,
			},
		};
	}

	if (state.auth.mode === "guest" && intent === "matchmake") {
		const session = await getGuestSession();
		const token = getCookieValue("guest-token");
		if (!session || !token) {
			return null;
		}
		return {
			type: "guest",
			data: {
				accessToken: token,
				intent,
			},
		};
	}

	return null;
};

export const networkingSaga = function* (slices: BoardSlices) {
	let listenerTask = null;
	let activeSocket: Socket | null = null;

	while (true) {
		const action = yield* take([
			openConnection.toString(),
			ensureConnection.toString(),
		]);
		const state = yield* select((appState: AppState) => appState);
		const shouldJoinMatch = action.type === openConnection.toString();

		if (shouldJoinMatch) {
			yield put(MenuCommands.setLoadingMessage("Connecting..."));
			yield put(AppShellCommands.setScreen("public-queue"));
		}

		if (!activeSocket?.connected) {
			const request = (yield* call(() =>
				buildHandshakeRequest(
					state,
					shouldJoinMatch && state.auth.mode !== "account"
						? "matchmake"
						: "social"
				)
			)) as HandshakeRequest | null;

			if (!request) {
				if (shouldJoinMatch) {
					yield put(MenuCommands.setLoadingMessage("Missing authentication request"));
					yield put(AppShellCommands.setScreen("landing"));
				}
				continue;
			}

			try {
				activeSocket = (yield* call(getSocket as any, request)) as Socket;
			} catch (error) {
				yield put(MenuCommands.setLoadingMessage("Failed to connect"));
				yield put(AppShellCommands.setScreen("landing"));
				continue;
			}

			if (listenerTask) {
				yield cancel(listenerTask);
			}
			listenerTask = yield* fork(listenForConnection, activeSocket, slices);
			yield* delay(0);

			if (state.auth.mode === "account") {
				activeSocket.emit("socialBootstrap", {});
			}
		}

		if (shouldJoinMatch && activeSocket) {
			activeSocket.emit("queue:joinPublic");
		}
	}
};
