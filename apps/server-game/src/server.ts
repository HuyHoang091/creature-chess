import { collectDefaultMetrics, register } from "prom-client";
import { createClient } from "redis";
import { Server } from "socket.io";

import {
	GamemodeSettings,
	GamemodeSettingsPresets,
} from "@creature-chess/models/settings";

import { createDatabaseConnection, DatabaseConnection } from "@cc-server/data";

import {
	activePlayers,
	activeBattles,
	activeGames,
	activeRooms,
	battlesStarted,
	gamesStarted,
	playersInGame,
	playersInRoom,
	socketConnections,
	socketInBytes,
	socketOutBytes,
} from "./Metrics";
import { createManagementClient } from "./external/auth0";
import { getBots } from "./external/bots";
import { Game, PlayerGameParticipant } from "./game";
import { onHandshakeSuccess } from "./handshake";
import { Lobby } from "./lobby";
import { logger } from "./log";
import { AuthenticatedSocket } from "./player/socket";
import { FriendManager } from "./social/friendManager";
import { PresenceManager } from "./social/presenceManager";
import { PrivateRoomManager } from "./social/privateRoomManager";
import { SocialUser, toPrivateRoomDto } from "./social/types";
import { VoiceChatManager } from "./social/voiceChatManager";

register.setDefaultLabels({
	nodeId: process.env.NODE_APP_INSTANCE || "default",
});

collectDefaultMetrics({ register });

const MAX_PLAYERS = 8;
const LOBBY_WAIT_TIME = 6;

type StartGameOptions = {
	database: DatabaseConnection;
	settings: GamemodeSettings;
	players: PlayerGameParticipant[];
	persistHistory: boolean;
	onFinish: (game: Game) => void | Promise<void>;
};

const buildSocialUserFromSocket = (
	socket: AuthenticatedSocket
): SocialUser => ({
	userId: socket.data.id,
	nickname: socket.data.nickname || "Unknown",
	profilePicture: socket.data.profile?.picture ?? null,
});

const createGameRunner = async ({
	database,
	settings,
	players,
	persistHistory,
	onFinish,
}: StartGameOptions) => {
	const botsRequired = Math.max(0, MAX_PLAYERS - players.length);
	const bots = await getBots(database, botsRequired);

	if (persistHistory) {
		for (const {
			player: { id, type },
		} of players) {
			if (type === "player") {
				await database.user.addGamePlayed(id);
			}
		}
	}

	const game = new Game(
		settings,
		{ players, bots },
		{
			onFinish: async (event) => {
				if (persistHistory) {
					const members = game.getMembers();
					const winner = event.players.find((player) => player.position === 1);

					await database.matchHistory.createMatchSummary({
						mode: "public_casual",
						startedAt: game.getStartedAt(),
						endedAt: new Date(),
						playerCount: members.length,
						winnerUserId:
							winner &&
							members.find((member) => member.id === winner.id)?.type ===
								"PLAYER"
								? winner.id
								: null,
						participants: event.players.map((player) => {
							const member = members.find((item) => item.id === player.id);
							return {
								userId: member?.type === "PLAYER" ? member.id : null,
								guestId:
									member?.type === "PLAYER" && member.id.length <= 4
										? member.id
										: null,
								displayName: member?.name || player.id,
								placement: player.position,
								isBot: member?.type === "BOT",
								result:
									player.position === 1
										? "win"
										: player.position <= 4
											? "top4"
											: "loss",
							};
						}),
					});

					if (winner) {
						const winnerMember = members.find(
							(member) => member.id === winner.id
						);
						if (winnerMember?.type === "PLAYER" && winner.id.length > 4) {
							await database.user.addWin(winner.id);
						}
					}
				}

				logger.info("Game finished");
				await onFinish(game);
			},
		}
	);

	return game;
};

export const startServer = async ({ io }: { io: Server }) => {
	logger.info("Starting server...");
	const authClient = createManagementClient();
	const database = await createDatabaseConnection(logger);
	logger.info("Database connection created");

	const presenceManager = new PresenceManager();
	const roomManager = new PrivateRoomManager();
	const voiceChatManager = new VoiceChatManager();

	let lobbies: Lobby[] = [];
	let games: Game[] = [];

	gamesStarted.reset();
	activeGames.reset();
	battlesStarted.reset();
	activeBattles.reset();
	activePlayers.reset();
	playersInRoom.reset();
	playersInGame.reset();
	activeRooms.reset();
	socketConnections.reset();
	socketInBytes.reset();
	socketOutBytes.reset();

	const emitToUser = (userId: string, event: string, payload: unknown) => {
		for (const socket of presenceManager.getSockets(userId)) {
			socket.emit(event, payload);
		}
	};

	const refreshOperationalMetrics = () => {
		activePlayers.set(presenceManager.getConnectedUserCount());
		playersInRoom.set(presenceManager.countUsersByState("in_room"));
		playersInGame.set(presenceManager.countUsersByState("in_game"));
		activeRooms.set(roomManager.getRoomCount());
		socketConnections.set(io.engine.clientsCount);
	};

	const friendManager = new FriendManager(
		database,
		presenceManager,
		emitToUser
	);

	const emitRoomSnapshot = (userId: string) => {
		const room = roomManager.getRoomForUser(userId);
		emitToUser(userId, "roomSnapshot", {
			room: room ? toPrivateRoomDto(room) : null,
			invites: roomManager.getInvitesForUser(userId),
		});
	};

	const emitRoomToMembers = (userIds: string[]) => {
		for (const userId of userIds) {
			emitRoomSnapshot(userId);
		}
	};

	const updatePresence = async (
		userId: string,
		state: "online" | "in_room" | "in_game"
	) => {
		presenceManager.setState(userId, state);
		refreshOperationalMetrics();
		await friendManager.emitSnapshotToFriendsOf(userId);
	};

	const onPublicGameFinished = async (game: Game) => {
		games = games.filter((item) => item !== game);
		refreshOperationalMetrics();
		for (const member of game.getMembers()) {
			if (member.type === "PLAYER" && member.id.length > 4) {
				await updatePresence(member.id, "online");
			}
		}
	};

	const onCustomGameFinished = async (game: Game, roomId: string) => {
		games = games.filter((item) => item !== game);
		refreshOperationalMetrics();
		const room = roomManager.markWaiting(roomId);
		if (!room) {
			return;
		}
		for (const member of room.members) {
			await updatePresence(member.userId, "in_room");
		}
		emitRoomToMembers(room.members.map((member) => member.userId));
	};

	const buildRoomPlayers = (userIds: string[]) =>
		userIds
			.map((userId) => {
				const socket = presenceManager.getPrimarySocket(userId);
				if (!socket) {
					return null;
				}
				const { nickname, profilePicture } = buildSocialUserFromSocket(socket);
				return {
					player: {
						id: userId,
						name: nickname,
						profile: {
							picture: profilePicture ?? 1,
							title: null,
						},
						type: "player" as const,
					},
					socket,
				};
			})
			.filter(Boolean) as PlayerGameParticipant[];

	const forceLogoutUser = async (
		userId: string,
		reason: string,
		expiresAt: string | null
	) => {
		const room = roomManager.getRoomForUser(userId);
		const affectedRoomMembers = room
			? room.members.map((member) => member.userId)
			: [];
		if (room) {
			roomManager.leaveRoom(userId);
			emitRoomToMembers([...new Set([...affectedRoomMembers, userId])]);
		}

		emitToUser(userId, "auth:forcedLogout", {
			reason,
			expiresAt,
		});
		for (const socket of presenceManager.getSockets(userId)) {
			socket.disconnect(true);
		}
		presenceManager.setState(userId, "offline");
		refreshOperationalMetrics();
		await friendManager.emitSnapshotToFriendsOf(userId);
	};

	if (process.env.REDIS_URL) {
		const moderationSubscriber = createClient({ url: process.env.REDIS_URL });
		moderationSubscriber
			.connect()
			.then(async () => {
				await moderationSubscriber.subscribe("admin:moderation", (message) => {
					try {
						const payload = JSON.parse(message) as {
							type?: string;
							userId?: string;
							reason?: string;
							expiresAt?: string | null;
						};
						if (payload.type !== "force_logout" || !payload.userId) {
							return;
						}
						forceLogoutUser(
							payload.userId,
							payload.reason || "Account access was revoked",
							payload.expiresAt ?? null
						).catch((error) =>
							logger.error("Failed to force logout moderated user", error)
						);
					} catch (error) {
						logger.error("Failed to parse moderation command", error);
					}
				});
			})
			.catch((error) =>
				logger.error("Failed to connect moderation subscriber", error)
			);
	}

	const matchmaking = async (socket: AuthenticatedSocket) => {
		logger.info(
			`[Matchmaking (${socket.data.nickname})] Beginning matchmaking`
		);

		if (socket.data.type === "player") {
			await updatePresence(socket.data.id, "in_game");
		}

		const matchingLobby = lobbies.find((lobby) =>
			lobby.isInLobby(socket.data.id)
		);
		if (matchingLobby) {
			logger.info(`[Matchmaking (${socket.data.nickname})] Lobby found`);
			matchingLobby.connect(socket);
			return;
		}

		const matchingGame = games.find((game) => game.canJoinGame(socket.data.id));
		if (matchingGame) {
			logger.info(`[Matchmaking (${socket.data.nickname})] Game found`);
			matchingGame.connect(socket);
			return;
		}

		const openLobby = lobbies.find((lobby) => lobby.getFreeSlotCount() > 0);
		if (openLobby) {
			logger.info(
				`[Matchmaking (${socket.data.nickname})] Joined existing lobby`
			);
			openLobby.connect(socket);
			return;
		}

		const lobby = new Lobby({
			waitTimeS: LOBBY_WAIT_TIME,
			maxPlayers: MAX_PLAYERS,
			onStart: async (settings, players) => {
				lobbies = lobbies.filter((other) => other !== lobby);
				const game = await createGameRunner({
					database,
					settings,
					players,
					persistHistory: true,
					onFinish: onPublicGameFinished,
				});
				games.push(game);
			},
		});

		lobbies.push(lobby);
		logger.info(`[Matchmaking (${socket.data.nickname})] New lobby created`);
		lobby.connect(socket);
	};

	const ackError = (
		ack: ((payload: unknown) => void) | undefined,
		code: string,
		message: string
	) => ack?.({ ok: false, error: { code, message } });
	const ackOk = (
		ack: ((payload: unknown) => void) | undefined,
		payload: Record<string, unknown> = {}
	) => ack?.({ ok: true, ...payload });

	const registerSocialHandlers = (socket: AuthenticatedSocket) => {
		if (socket.data.type !== "player") {
			socket.on("queue:joinPublic", () => {
				matchmaking(socket).catch((error) => {
					logger.error("Failed to join public queue", error);
				});
			});
			return;
		}

		const userId = socket.data.id;
		const socialUser = buildSocialUserFromSocket(socket);

		socket.on(
			"socialBootstrap",
			async (_payload, ack?: (payload: unknown) => void) => {
				await friendManager.emitSnapshot(userId);
				emitRoomSnapshot(userId);
				ackOk(ack);
			}
		);

		socket.on("queue:joinPublic", async () => {
			await matchmaking(socket);
		});

		socket.on(
			"friendsRequestSend",
			async (
				payload: { targetUserId?: string },
				ack?: (payload: unknown) => void
			) => {
				const targetUserId = payload?.targetUserId;
				if (!targetUserId) {
					return ackError(ack, "BAD_REQUEST", "Missing targetUserId");
				}
				if (targetUserId === userId) {
					return ackError(ack, "SELF", "Cannot add yourself");
				}

				const [targetUser, blocked, existingFriendship, existingRequest] =
					await Promise.all([
						database.user.getById(targetUserId),
						database.block.existsEitherDirection(userId, targetUserId),
						database.friendship.exists(userId, targetUserId),
						database.friendRequest.findBetweenUsers(userId, targetUserId),
					]);

				if (!targetUser) {
					return ackError(ack, "TARGET_NOT_FOUND", "Target user not found");
				}
				if (blocked) {
					return ackError(
						ack,
						"BLOCKED",
						"Blocked users cannot become friends"
					);
				}
				if (existingFriendship) {
					return ackError(ack, "ALREADY_FRIEND", "Already friends");
				}
				if (existingRequest) {
					return ackError(
						ack,
						"REQUEST_EXISTS",
						"A pending request already exists"
					);
				}

				const created = await database.friendRequest.create(
					userId,
					targetUserId
				);
				if (!created.ok) {
					return ackError(
						ack,
						created.reason === "conflict" ? "REQUEST_EXISTS" : "SERVER_ERROR",
						created.reason === "conflict"
							? "A pending request already exists"
							: "Failed to create friend request"
					);
				}

				await friendManager.emitSnapshot(userId);
				await friendManager.emitSnapshot(targetUserId);
				ackOk(ack, { requestId: created.value.id });
			}
		);

		socket.on(
			"friendsRequestAccept",
			async (
				payload: { requestId?: string },
				ack?: (payload: unknown) => void
			) => {
				if (!payload?.requestId) {
					return ackError(ack, "BAD_REQUEST", "Missing requestId");
				}
				const request = await database.friendRequest.accept(
					payload.requestId,
					userId
				);
				if (!request) {
					return ackError(ack, "NOT_FOUND", "Request not found");
				}
				await database.friendship.createPair(
					request.sender_id,
					request.receiver_id
				);
				await friendManager.emitSnapshot(request.sender_id);
				await friendManager.emitSnapshot(request.receiver_id);
				ackOk(ack);
			}
		);

		socket.on("roomCreate", (_payload, ack?: (payload: unknown) => void) => {
			const room = roomManager.createRoom(socialUser);
			updatePresence(userId, "in_room").catch((error) =>
				logger.error("Failed to update room presence", error)
			);
			refreshOperationalMetrics();
			emitRoomSnapshot(userId);
			ackOk(ack, { room: toPrivateRoomDto(room) });
		});

		socket.on(
			"roomJoinByCode",
			async (payload: { code?: string }, ack?: (payload: unknown) => void) => {
				const code = payload?.code?.trim().toUpperCase();
				if (!code) {
					return ackError(ack, "BAD_REQUEST", "Missing room code");
				}
				const result = roomManager.joinRoomByCode(socialUser, code);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to join room");
				}
				await updatePresence(userId, "in_room");
				refreshOperationalMetrics();
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				ackOk(ack, { room: toPrivateRoomDto(result.room) });
			}
		);

		socket.on(
			"roomGetSnapshot",
			(_payload, ack?: (payload: unknown) => void) => {
				const room = roomManager.getRoomForUser(userId);
				ackOk(ack, {
					room: room ? toPrivateRoomDto(room) : null,
					invites: roomManager.getInvitesForUser(userId),
				});
			}
		);

		socket.on("roomLeave", (_payload, ack?: (payload: unknown) => void) => {
			const currentRoom = roomManager.getRoomForUser(userId);
			const room = roomManager.leaveRoom(userId);
			updatePresence(userId, "online").catch((error) =>
				logger.error("Failed to set presence online", error)
			);
			refreshOperationalMetrics();
			if (currentRoom) {
				emitRoomToMembers(
					currentRoom.members.map((member) => member.userId).concat(userId)
				);
			}
			ackOk(ack, { room: room ? toPrivateRoomDto(room) : null });
		});

		socket.on(
			"roomInvite",
			(
				payload: { targetUserId?: string },
				ack?: (payload: unknown) => void
			) => {
				const targetUserId = payload?.targetUserId;
				if (!targetUserId) {
					return ackError(ack, "BAD_REQUEST", "Missing targetUserId");
				}
				const result = roomManager.createInvite(socialUser, targetUserId);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to create invite");
				}
				emitRoomSnapshot(targetUserId);
				emitToUser(targetUserId, "roomInviteReceived", result.invite);
				ackOk(ack, { invite: result.invite });
			}
		);

		socket.on(
			"roomInviteAccept",
			(payload: { inviteId?: string }, ack?: (payload: unknown) => void) => {
				if (!payload?.inviteId) {
					return ackError(ack, "BAD_REQUEST", "Missing inviteId");
				}
				const result = roomManager.acceptInvite(socialUser, payload.inviteId);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to accept invite");
				}
				updatePresence(userId, "in_room").catch((error) =>
					logger.error("Failed to update invite presence", error)
				);
				refreshOperationalMetrics();
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				ackOk(ack, { room: toPrivateRoomDto(result.room) });
			}
		);

		socket.on(
			"roomInviteDecline",
			(payload: { inviteId?: string }, ack?: (payload: unknown) => void) => {
				if (!payload?.inviteId) {
					return ackError(ack, "BAD_REQUEST", "Missing inviteId");
				}
				const removed = roomManager.declineInvite(userId, payload.inviteId);
				if (!removed) {
					return ackError(ack, "INVITE_NOT_FOUND", "Invite not found");
				}
				emitRoomSnapshot(userId);
				ackOk(ack);
			}
		);

		socket.on(
			"roomRequestJoin",
			(
				payload: { targetUserId?: string },
				ack?: (payload: unknown) => void
			) => {
				const targetUserId = payload?.targetUserId;
				if (!targetUserId) {
					return ackError(ack, "BAD_REQUEST", "Missing targetUserId");
				}
				const result = roomManager.requestJoin(targetUserId, socialUser);
				if (!result.ok) {
					return ackError(ack, result.reason, "Room not available");
				}
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				emitToUser(
					result.room.ownerUserId,
					"roomJoinRequestReceived",
					result.request
				);
				ackOk(ack, { requestId: result.request.id });
			}
		);

		socket.on(
			"roomJoinRequestAccept",
			async (
				payload: { requestId?: string },
				ack?: (payload: unknown) => void
			) => {
				if (!payload?.requestId) {
					return ackError(ack, "BAD_REQUEST", "Missing requestId");
				}
				const room = roomManager.getRoomForUser(userId);
				const request = room?.pendingJoinRequests.find(
					(item) => item.id === payload.requestId
				);
				if (!request) {
					return ackError(ack, "REQUEST_NOT_FOUND", "Request not found");
				}
				const requesterSocket = presenceManager.getPrimarySocket(
					request.requesterUserId
				);
				if (!requesterSocket) {
					return ackError(ack, "REQUESTER_OFFLINE", "Requester is offline");
				}
				const result = roomManager.acceptJoinRequest(
					userId,
					payload.requestId,
					buildSocialUserFromSocket(requesterSocket)
				);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to accept request");
				}
				await updatePresence(request.requesterUserId, "in_room");
				refreshOperationalMetrics();
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				emitToUser(request.requesterUserId, "roomJoinRequestResolved", {
					requestId: payload.requestId,
					status: "accepted",
				});
				ackOk(ack, { room: toPrivateRoomDto(result.room) });
			}
		);

		socket.on(
			"roomJoinRequestDecline",
			(payload: { requestId?: string }, ack?: (payload: unknown) => void) => {
				if (!payload?.requestId) {
					return ackError(ack, "BAD_REQUEST", "Missing requestId");
				}
				const result = roomManager.declineJoinRequest(
					userId,
					payload.requestId
				);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to decline request");
				}
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				emitToUser(result.request.requesterUserId, "roomJoinRequestResolved", {
					requestId: payload.requestId,
					status: "declined",
				});
				ackOk(ack);
			}
		);

		socket.on(
			"roomReadyToggle",
			(payload, ack?: (payload: unknown) => void) => {
				const result = roomManager.toggleReady(userId);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to toggle ready");
				}
				emitRoomToMembers(result.room.members.map((member) => member.userId));
				ackOk(ack, { room: toPrivateRoomDto(result.room) });
			}
		);

		socket.on(
			"roomStart",
			async (_payload, ack?: (payload: unknown) => void) => {
				const result = roomManager.startRoom(userId);
				if (!result.ok) {
					return ackError(ack, result.reason, "Cannot start room");
				}

				const memberIds = result.room.members.map((member) => member.userId);
				const players = buildRoomPlayers(memberIds);
				if (players.length !== memberIds.length) {
					return ackError(ack, "MEMBER_OFFLINE", "A room member is offline");
				}

				// Preserve voice chat channel before dissolving the room
				voiceChatManager.authorizeChannel(result.room.id, memberIds);
				const voiceChatChannelId = result.room.id;
				for (const memberId of memberIds) {
					emitToUser(memberId, "voiceChat:channelReady", {
						channelId: voiceChatChannelId,
					});
				}

				// Remove members from private room and send them to public matchmaking
				for (const memberId of memberIds) {
					roomManager.leaveRoom(memberId);
				}

				for (const memberId of memberIds) {
					const memberSocket = presenceManager.getPrimarySocket(memberId);
					if (memberSocket) {
						await matchmaking(memberSocket);
					}
				}

				ackOk(ack);
			}
		);

		// ── Voice Chat ──────────────────────────────────────────────────────────────
		socket.on("voiceChat:join", (payload: { channelId?: string } = {}) => {
			let resolvedChannelId: string | null = null;

			// If user is currently in a room, use that room's ID as the channel
			const room = roomManager.getRoomForUser(userId);
			if (room) {
				// Auto-authorize room members when they join voice chat
				voiceChatManager.authorizeChannel(room.id, [userId]);
				resolvedChannelId = room.id;
			} else if (
				payload?.channelId &&
				voiceChatManager.isAuthorized(userId, payload.channelId)
			) {
				// Rejoin an authorized channel (e.g., user refreshed during game)
				resolvedChannelId = payload.channelId;
			}

			if (!resolvedChannelId) {
				socket.emit("voiceChat:error", {
					message: "Not authorized for voice chat",
				});
				return;
			}

			const peers = voiceChatManager.join(userId, resolvedChannelId);

			// Tell this user about existing active peers
			socket.emit("voiceChat:members", { channelId: resolvedChannelId, peers });

			// Tell existing active peers that this user joined
			for (const peerId of peers) {
				emitToUser(peerId, "voiceChat:peer-joined", { peerId: userId });
			}
		});

		socket.on("voiceChat:leave", () => {
			const { channelId, remainingPeers } = voiceChatManager.leave(userId);
			if (channelId) {
				for (const peerId of remainingPeers) {
					emitToUser(peerId, "voiceChat:peer-left", { peerId: userId });
				}
			}
		});

		socket.on(
			"voiceChat:offer",
			(payload: { targetUserId?: string; sdp?: RTCSessionDescriptionInit }) => {
				if (!payload?.targetUserId || !payload?.sdp) {
					return;
				}
				if (!voiceChatManager.canSignal(userId, payload.targetUserId)) {
					return;
				}
				emitToUser(payload.targetUserId, "voiceChat:offer", {
					fromId: userId,
					sdp: payload.sdp,
				});
			}
		);

		socket.on(
			"voiceChat:answer",
			(payload: { targetUserId?: string; sdp?: RTCSessionDescriptionInit }) => {
				if (!payload?.targetUserId || !payload?.sdp) {
					return;
				}
				if (!voiceChatManager.canSignal(userId, payload.targetUserId)) {
					return;
				}
				emitToUser(payload.targetUserId, "voiceChat:answer", {
					fromId: userId,
					sdp: payload.sdp,
				});
			}
		);

		socket.on(
			"voiceChat:ice",
			(payload: { targetUserId?: string; candidate?: RTCIceCandidateInit }) => {
				if (!payload?.targetUserId || !payload?.candidate) {
					return;
				}
				if (!voiceChatManager.canSignal(userId, payload.targetUserId)) {
					return;
				}
				emitToUser(payload.targetUserId, "voiceChat:ice", {
					fromId: userId,
					candidate: payload.candidate,
				});
			}
		);
	};

	onHandshakeSuccess({ io, authClient, database }, async (socket, request) => {
		registerSocialHandlers(socket);

		if (socket.data.type === "player") {
			presenceManager.connect(socket);
			refreshOperationalMetrics();
			const existingRoom = roomManager.getRoomForUser(socket.data.id);
			if (existingRoom) {
				await updatePresence(
					socket.data.id,
					existingRoom.status === "in_game" ? "in_game" : "in_room"
				);
			} else {
				await updatePresence(socket.data.id, "online");
			}
			socket.emit("socialReady", { userId: socket.data.id });
			await friendManager.emitSnapshot(socket.data.id);
			emitRoomSnapshot(socket.data.id);
		}

		socket.on("disconnect", () => {
			const { channelId: voiceChatChannel, remainingPeers: voiceChatPeers } =
				voiceChatManager.leave(socket.data.id);
			if (voiceChatChannel) {
				for (const peerId of voiceChatPeers) {
					emitToUser(peerId, "voiceChat:peer-left", { peerId: socket.data.id });
				}
			}

			presenceManager.disconnect(socket, (userId) => {
				refreshOperationalMetrics();
				friendManager.emitSnapshotToFriendsOf(userId).catch((error) => {
					logger.error("Failed to emit offline snapshot", error);
				});
			});
		});

		const shouldRestoreExistingRuntime =
			lobbies.some((lobby) => lobby.isInLobby(socket.data.id)) ||
			games.some((game) => game.canJoinGame(socket.data.id));

		if (
			shouldRestoreExistingRuntime ||
			request.data.intent === "matchmake" ||
			(request.type === "guest" && !request.data.intent)
		) {
			await matchmaking(socket);
		}
	});
};
