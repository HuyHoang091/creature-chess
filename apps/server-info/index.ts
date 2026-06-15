import cors from "cors";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import express from "express";
import { logger as expressWinston } from "express-winston";
import { createServer } from "http";
import { Server } from "socket.io";

import {
	type FriendsResponseDto,
	type MatchHistoryDetailDto,
	type MatchHistoryResponseDto,
} from "@creature-chess/models";
import {
	validateNicknameFormat,
	AVAILABLE_PROFILE_PICTURES,
} from "@creature-chess/user/profile";

import { authenticate, convertDatabaseUserToUserModel } from "@cc-server/auth";
import { createDatabaseConnection, DatabaseConnection } from "@cc-server/data";

import { logger } from "./src/log";
import { getManagementClient } from "./src/util/auth0";
import { runtimeSocialState } from "./src/util/runtime-social";
import {
	toBlockedUserDto,
	toFriendDto,
	toFriendRequestDto,
	toMatchHistoryDetailDto,
	toMatchHistoryItemDto,
} from "./src/util/social-dto";
import { userModelToDto } from "./src/util/user-model-to-dto";

import Filter = require("bad-words");

const LOCAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOCAL_LOGIN_RATE_LIMIT = 100;
const LOCAL_REGISTER_RATE_LIMIT = 40;

const app = express();
const PORT = 3002;
const SOCIAL_SOCKET_PATH = "/social/socket.io";

app.disable("etag");

// Define a middleware to parse JSON requests
app.use(
	cors({
		origin: [
			"http://creaturechess.local-dev.com:8090",
			"http://localhost:8090",
			"http://creaturechess.local-dev.com",
			"http://localhost",
			"http://covuasinhvat.xyz",
			"http://www.covuasinhvat.xyz",
			"https://covuasinhvat.xyz",
			"https://www.covuasinhvat.xyz",
		],
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
		exposedHeaders: ["Set-Cookie"],
	})
);

app.use(express.json());
type RateLimitOptions = {
	windowMs: number;
	max: number;
	prefix: string;
	keyBuilder?: (req: express.Request) => string | null;
	skip?: (req: express.Request) => boolean;
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getRateLimitClientIp(req: express.Request) {
	return req.ip || req.socket.remoteAddress || "unknown";
}

function getNormalizedEmail(value: unknown) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function rateLimit({ windowMs, max, prefix, keyBuilder, skip }: RateLimitOptions) {
	return (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		if (skip?.(req)) {
			next();
			return;
		}

		const keySuffix = keyBuilder?.(req) || `ip:${getRateLimitClientIp(req)}`;
		const key = `${prefix}:${keySuffix}`;
		const now = Date.now();
		const bucket = rateBuckets.get(key);

		if (!bucket || bucket.resetAt <= now) {
			rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
			next();
			return;
		}

		bucket.count += 1;
		if (bucket.count > max) {
			res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
			res.status(429).json({ message: "Too many requests" });
			return;
		}

		next();
	};
}
app.use(expressWinston({ winstonInstance: logger }));
app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok", service: "info" });
});

app.use((req, res, next) => {
	const {
		headers: { cookie },
	} = req;
	if (cookie) {
		const values = cookie.split(";").reduce((acc, item) => {
			const data = item.trim().split("=");
			return { ...acc, [data[0]]: data[1] };
		}, {});
		res.locals.cookie = values;
	} else {
		res.locals.cookie = {};
	}
	next();
});

async function getNicknameUpdate(
	database: DatabaseConnection,
	filter: Filter,
	body: { nickname?: string },
	currentUserId?: string
): Promise<{ error: string | null; nickname: string | null }> {
	const { nickname } = body;

	if (!nickname) {
		return { error: null, nickname: null };
	}

	const trimmedNickname = nickname.trim();

	const nicknameError = validateNicknameFormat(trimmedNickname);

	if (nicknameError) {
		return { error: nicknameError, nickname: null };
	}

	if (filter.isProfane(trimmedNickname)) {
		return { error: "Profanity filter", nickname: null };
	}

	const existing = await database.user.getByNickname(trimmedNickname);
	const isUnique = existing === null || existing.id === currentUserId;

	if (!isUnique) {
		return { error: "Nickname already in use", nickname: null };
	}

	return { error: null, nickname: trimmedNickname };
}

function getPersonalInfoUpdate(body: { personalInfo?: string | null }): {
	error: string | null;
	personalInfo?: string | null;
} {
	if (body.personalInfo === undefined) {
		return { error: null };
	}

	if (body.personalInfo === null) {
		return { error: null, personalInfo: null };
	}

	const personalInfo = body.personalInfo.trim();

	if (personalInfo.length > 280) {
		return {
			error: "Personal information must be 280 characters or fewer",
		};
	}

	return { error: null, personalInfo };
}

async function getPictureUpdate(body: {
	picture?: string;
}): Promise<{ error: string | null; picture: number | null }> {
	const { picture } = body;

	if (!picture) {
		return { error: null, picture: null };
	}

	const pictureId = parseInt(picture, 10);

	if (isNaN(pictureId)) {
		return { error: "Invalid picture id", picture: null };
	}

	if (!Object.keys(AVAILABLE_PROFILE_PICTURES).includes(picture.toString())) {
		return { error: "Picture id supplied is not useable", picture: null };
	}

	return { error: null, picture: pictureId };
}

const REPORT_REASONS = new Set([
	"abuse",
	"spam",
	"offensive_name",
	"cheating",
	"other",
]);

function isUserLocked(user: {
	locked?: boolean;
	lockedReason?: string | null;
}) {
	return Boolean(user.locked);
}

async function requireAuthenticatedUser(
	req: express.Request,
	res: express.Response,
	authClient: ReturnType<typeof getManagementClient>,
	database: DatabaseConnection
) {
	const token = parseAuthorizationToken(
		req.headers.authorization as string | undefined
	);

	if (!token) {
		res.status(401).json({ message: "Not authorized" });
		return null;
	}

	let user = null;

	if (token.startsWith("local_")) {
		user = await authenticateLocalToken(database, token);
	} else {
		user = await authenticate(authClient, database, token);
	}

	if (!user) {
		res.status(401).json({ message: "Not authorized" });
		return null;
	}

	if (isUserLocked(user)) {
		res.status(403).json({
			message: user.lockedReason || "Account is locked",
		});
		return null;
	}

	return user;
}

function ensureSocialEligible(
	res: express.Response,
	user: { socialEligible?: boolean }
) {
	if (!user.socialEligible) {
		res
			.status(403)
			.json({ message: "Social features require a registered account" });
		return false;
	}

	return true;
}

function parseAuthorizationToken(value?: string) {
	if (!value) {
		return null;
	}

	return value.startsWith("Bearer ") ? value.slice(7) : value;
}

function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 64).toString("hex");
	return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
	const [salt, hash] = storedHash.split(":");

	if (!salt || !hash) {
		return false;
	}

	const candidate = scryptSync(password, salt, 64);
	const stored = Buffer.from(hash, "hex");

	if (candidate.length !== stored.length) {
		return false;
	}

	return timingSafeEqual(candidate, stored);
}

async function authenticateLocalToken(
	database: DatabaseConnection,
	token: string
) {
	const session = await database.session.getByToken(token);

	if (!session) {
		return null;
	}

	const user = await database.user.getById(session.user_id);

	return user ? convertDatabaseUserToUserModel(user) : null;
}

function guestCleanUpProcess(database: DatabaseConnection) {
	setInterval(async () => {
		const now = new Date();
		await database.prisma.guests.deleteMany({
			where: {
				expires_at: {
					lte: now,
				},
			},
		});
		await database.session.deleteExpired(now);
	}, 60000); // Check every minute
}

async function startServer() {
	const authClient = getManagementClient();
	const filter = new Filter();

	const database = await createDatabaseConnection(logger);
	const httpServer = createServer(app);
	const socialIo = new Server(httpServer, {
		path: SOCIAL_SOCKET_PATH,
		cors: {
			origin: true,
			credentials: true,
		},
	});
	const userSocketIds = new Map<string, Set<string>>();

	const emitFriendsSnapshot = async (userId: string) => {
		const sockets = userSocketIds.get(userId);
		if (!sockets || sockets.size === 0) {
			return;
		}
		const [friendships, incomingRequests, outgoingRequests, blockedUsers] =
			await Promise.all([
				database.friendship.listForUser(userId),
				database.friendRequest.getIncomingForUser(userId),
				database.friendRequest.getOutgoingForUser(userId),
				database.block.listForUser(userId),
			]);
		const targetIds = new Set<string>();
		for (const item of friendships) {
			targetIds.add(
				item.user_low_id === userId ? item.user_high_id : item.user_low_id
			);
		}
		for (const item of incomingRequests) {
			targetIds.add(item.sender_id);
		}
		for (const item of outgoingRequests) {
			targetIds.add(item.receiver_id);
		}
		for (const item of blockedUsers) {
			targetIds.add(item.blocked_user_id);
		}
		const users = await database.prisma.users.findMany({
			where: { id: { in: [...targetIds] } },
		});
		const usersById = new Map(users.map((u) => [u.id, u]));
		const payload = {
			friends: friendships
				.map((friendship) =>
					usersById.get(
						friendship.user_low_id === userId
							? friendship.user_high_id
							: friendship.user_low_id
					)
				)
				.filter(Boolean)
				.map((item) =>
					toFriendDto(item!, runtimeSocialState.getPresence(item!.id))
				),
			incomingRequests: incomingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			outgoingRequests: outgoingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			blockedUsers: blockedUsers.map((block) =>
				toBlockedUserDto(block, usersById.get(block.blocked_user_id) ?? null)
			),
		};
		for (const socketId of sockets) {
			socialIo.to(socketId).emit("friends:snapshot", payload);
		}
	};

	const emitRoomSnapshot = (userId: string) => {
		const sockets = userSocketIds.get(userId);
		if (!sockets || sockets.size === 0) {
			return;
		}
		const room = runtimeSocialState.getRoomForUser(userId);
		const invites = runtimeSocialState.getInvitesForUser(userId);
		for (const socketId of sockets) {
			socialIo.to(socketId).emit("room:snapshot", { room, invites });
		}
	};

	const emitRoomToMembers = (memberIds: string[]) => {
		for (const id of memberIds) {
			emitRoomSnapshot(id);
		}
	};

	guestCleanUpProcess(database);

	async function getNewToken() {
		let token: string | null = null;

		do {
			// TODO make this secure
			const newToken =
				Math.random().toString(36).substring(2, 15) +
				Math.random().toString(36).substring(2, 15);

			const existing = await database.prisma.guests.findFirst({
				where: {
					token: newToken,
					expires_at: {
						gte: new Date(),
					},
				},
			});

			if (!existing) {
				token = newToken;
			}
		} while (token === null);

		return token;
	}

	async function getNewGuestId() {
		let id: string | null = null;

		do {
			// random between 0001 and 9999 as string with leading zeros
			const newId = (Math.floor(Math.random() * 10000) + 1)
				.toString()
				.padStart(4, "0");

			const existing = await database.prisma.guests.findFirst({
				where: {
					id: newId,
				},
			});

			if (!existing) {
				id = newId;
			}
		} while (id === null);

		return id;
	}

	async function createLocalSession(userId: string) {
		const token = `local_${randomBytes(32).toString("hex")}`;
		const expiresAt = new Date(Date.now() + LOCAL_SESSION_TTL_MS);
		const session = await database.session.create(userId, token, expiresAt);

		if (!session) {
			return null;
		}

		return {
			token,
			expiresAt,
		};
	}

	socialIo.on("connection", (socket) => {
		let connectedUserId: string | null = null;

		const ackError = (
			ack: ((payload: unknown) => void) | undefined,
			code: string,
			message: string
		) => ack?.({ ok: false, error: { code, message } });
		const ackOk = (
			ack: ((payload: unknown) => void) | undefined,
			payload: Record<string, unknown> = {}
		) => ack?.({ ok: true, ...payload });

		socket.on(
			"social:subscribe",
			async (payload: { token?: string }, ack?: (payload: unknown) => void) => {
				const token = parseAuthorizationToken(payload?.token);
				if (!token) {
					return ackError(ack, "UNAUTHORIZED", "Missing token");
				}
				const user = token.startsWith("local_")
					? await authenticateLocalToken(database, token)
					: await authenticate(authClient, database, token);
				if (!user || user.locked || !user.socialEligible) {
					return ackError(ack, "UNAUTHORIZED", "Not authorized");
				}
				connectedUserId = user.id;
				const set = userSocketIds.get(user.id) ?? new Set<string>();
				set.add(socket.id);
				userSocketIds.set(user.id, set);
				runtimeSocialState.updatePresence(user.id, "online");
				socket.emit("social:ready", { userId: user.id });
				await emitFriendsSnapshot(user.id);
				emitRoomSnapshot(user.id);
				ackOk(ack);
			}
		);

		socket.on("presence:setState", async (payload: { state?: string }) => {
			if (!connectedUserId) {
				return;
			}
			const nextState = payload?.state;
			if (
				nextState === "home" ||
				nextState === "party" ||
				nextState === "friends"
			) {
				runtimeSocialState.updatePresence(connectedUserId, "online");
			} else if (nextState === "lobby") {
				runtimeSocialState.updatePresence(connectedUserId, "in_room");
			} else if (nextState === "queue" || nextState === "game") {
				runtimeSocialState.updatePresence(connectedUserId, "in_game");
			}
			const friendships =
				await database.friendship.listForUser(connectedUserId);
			for (const friendship of friendships) {
				const friendId =
					friendship.user_low_id === connectedUserId
						? friendship.user_high_id
						: friendship.user_low_id;
				await emitFriendsSnapshot(friendId);
			}
		});

		socket.on(
			"room:create",
			async (_payload, ack?: (payload: unknown) => void) => {
				if (!connectedUserId) {
					return ackError(ack, "UNAUTHORIZED", "Not subscribed");
				}
				const user = await database.user.getById(connectedUserId);
				if (!user) {
					return ackError(ack, "UNAUTHORIZED", "User missing");
				}
				const room = runtimeSocialState.createRoom({
					userId: connectedUserId,
					nickname: user.nickname || "Unknown",
					profilePicture: user.profile_picture ?? null,
				});
				runtimeSocialState.updatePresence(connectedUserId, "in_room");
				emitRoomSnapshot(connectedUserId);
				ackOk(ack, { room });
			}
		);

		socket.on(
			"friends:requestSend",
			async (
				payload: { targetUserId?: string },
				ack?: (payload: unknown) => void
			) => {
				if (!connectedUserId) {
					return ackError(ack, "UNAUTHORIZED", "Not subscribed");
				}
				const targetUserId = payload?.targetUserId;
				if (!targetUserId) {
					return ackError(ack, "BAD_REQUEST", "Missing targetUserId");
				}
				if (targetUserId === connectedUserId) {
					return ackError(ack, "SELF", "Cannot add yourself");
				}
				const [targetUser, blocked, existingFriendship, existingRequest] =
					await Promise.all([
						database.user.getById(targetUserId),
						database.block.existsEitherDirection(connectedUserId, targetUserId),
						database.friendship.exists(connectedUserId, targetUserId),
						database.friendRequest.findBetweenUsers(
							connectedUserId,
							targetUserId
						),
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
					return ackError(ack, "REQUEST_EXISTS", "Request already exists");
				}
				const created = await database.friendRequest.create(
					connectedUserId,
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
				await emitFriendsSnapshot(connectedUserId);
				await emitFriendsSnapshot(targetUserId);
				ackOk(ack, { requestId: created.value.id });
			}
		);

		socket.on(
			"friends:requestAccept",
			async (
				payload: { requestId?: string },
				ack?: (payload: unknown) => void
			) => {
				if (!connectedUserId) {
					return ackError(ack, "UNAUTHORIZED", "Not subscribed");
				}
				if (!payload?.requestId) {
					return ackError(ack, "BAD_REQUEST", "Missing requestId");
				}
				const request = await database.friendRequest.accept(
					payload.requestId,
					connectedUserId
				);
				if (!request) {
					return ackError(ack, "NOT_FOUND", "Request not found");
				}
				await database.friendship.createPair(
					request.sender_id,
					request.receiver_id
				);
				await emitFriendsSnapshot(request.sender_id);
				await emitFriendsSnapshot(request.receiver_id);
				ackOk(ack);
			}
		);

		socket.on(
			"room:joinByCode",
			async (payload: { code?: string }, ack?: (payload: unknown) => void) => {
				if (!connectedUserId) {
					return ackError(ack, "UNAUTHORIZED", "Not subscribed");
				}
				const code = payload?.code?.trim();
				if (!code) {
					return ackError(ack, "BAD_REQUEST", "Missing room code");
				}
				const user = await database.user.getById(connectedUserId);
				if (!user) {
					return ackError(ack, "UNAUTHORIZED", "User missing");
				}
				const room = runtimeSocialState.joinRoom(code, {
					userId: connectedUserId,
					nickname: user.nickname || "Unknown",
					profilePicture: user.profile_picture ?? null,
				});
				if (!room) {
					return ackError(ack, "ROOM_NOT_FOUND", "Room not found");
				}
				if (room === "full") {
					return ackError(ack, "ROOM_FULL", "Room is full");
				}
				runtimeSocialState.updatePresence(connectedUserId, "in_room");
				emitRoomToMembers(room.members.map((m) => m.userId));
				ackOk(ack, { room });
			}
		);

		socket.on("room:leave", (_payload, ack?: (payload: unknown) => void) => {
			if (!connectedUserId) {
				return ackError(ack, "UNAUTHORIZED", "Not subscribed");
			}
			const currentRoom = runtimeSocialState.getRoomForUser(connectedUserId);
			const memberIds = currentRoom?.members.map((m) => m.userId) ?? [];
			const room = runtimeSocialState.leaveRoom(connectedUserId);
			runtimeSocialState.updatePresence(connectedUserId, "online");
			emitRoomToMembers([...memberIds, connectedUserId]);
			ackOk(ack, { room });
		});

		socket.on(
			"room:readyToggle",
			(_payload, ack?: (payload: unknown) => void) => {
				if (!connectedUserId) {
					return ackError(ack, "UNAUTHORIZED", "Not subscribed");
				}
				const result = runtimeSocialState.toggleReady(connectedUserId);
				if (!result.ok) {
					return ackError(ack, result.reason, "Unable to toggle ready");
				}
				emitRoomToMembers(result.room.members.map((m) => m.userId));
				ackOk(ack, { room: result.room });
			}
		);

		socket.on("room:start", (_payload, ack?: (payload: unknown) => void) => {
			if (!connectedUserId) {
				return ackError(ack, "UNAUTHORIZED", "Not subscribed");
			}
			const result = runtimeSocialState.startRoom(connectedUserId);
			if (!result.ok) {
				return ackError(ack, result.reason, "Cannot start room");
			}
			const memberIds = result.room.members.map((m) => m.userId);
			emitRoomToMembers(memberIds);
			for (const memberId of memberIds) {
				const sockets = userSocketIds.get(memberId);
				if (!sockets) {
					continue;
				}
				for (const socketId of sockets) {
					socialIo.to(socketId).emit("room:startGame", {
						roomId: result.room.id,
						matchTicket: result.matchTicket,
					});
				}
			}
			ackOk(ack, { room: result.room, matchTicket: result.matchTicket });
		});

		socket.on("disconnect", async () => {
			if (!connectedUserId) {
				return;
			}
			const set = userSocketIds.get(connectedUserId);
			if (set) {
				set.delete(socket.id);
				if (set.size === 0) {
					userSocketIds.delete(connectedUserId);
					runtimeSocialState.updatePresence(connectedUserId, "offline");
					const friendships =
						await database.friendship.listForUser(connectedUserId);
					for (const friendship of friendships) {
						const friendId =
							friendship.user_low_id === connectedUserId
								? friendship.user_high_id
								: friendship.user_low_id;
						await emitFriendsSnapshot(friendId);
					}
				}
			}
		});
	});

	function serializeEvent(item: any) {
		let tasks: any[] = [];
		let rewards: any[] = [];
		let pageContent: any[] = [];
		try { tasks = item.tasks ? JSON.parse(item.tasks) : []; } catch { tasks = []; }
		try { rewards = item.rewards ? JSON.parse(item.rewards) : []; } catch { rewards = []; }
		try { pageContent = item.page_content ? JSON.parse(item.page_content) : []; } catch { pageContent = []; }
		return {
			id: item.id,
			name: item.name,
			description: item.description ?? "",
			status: item.status,
			startsAt: item.starts_at?.toISOString() ?? null,
			endsAt: item.ends_at?.toISOString() ?? null,
			bannerUrl: item.banner_url ?? null,
			themeColor: item.theme_color ?? null,
			pageSlug: item.page_slug ?? null,
			eventType: item.event_type ?? null,
			config: item.config ? (() => { try { return JSON.parse(item.config); } catch { return {}; } })() : {},
			tasks,
			rewards,
			pageContent,
		};
	}

	app.get("/events/public", async (req, res) => {
		const events = await (database.prisma.game_events as any).findMany({
			where: { status: "active" },
			orderBy: { created_at: "desc" },
		});
		return res.status(200).json({ events: events.map(serializeEvent) });
	});

	app.get("/events/public/:slug", async (req, res) => {
		const event = await (database.prisma.game_events as any).findFirst({
			where: { page_slug: req.params.slug, status: { in: ["active", "scheduled"] } },
		});
		if (!event) return res.status(404).json({ message: "Event not found or not active" });
		return res.status(200).json({ event: serializeEvent(event) });
	});

	app.post("/events/claim", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) return; // 401 response is handled by requireAuthenticatedUser

		const { eventId, taskId } = req.body;
		if (!eventId || !taskId) return res.status(400).json({ message: "Missing eventId or taskId" });

		// 1. Fetch event
		const event = await (database.prisma.game_events as any).findFirst({
			where: { id: eventId, status: "active" },
		});
		if (!event) return res.status(404).json({ message: "Event not active or not found" });

		// 2. Determine reward based on taskId
		let goldReward = 0;
		let gemsReward = 0;

		const tasks = event.tasks ? JSON.parse(event.tasks) : [];
		const rewards = event.rewards ? JSON.parse(event.rewards) : [];

		if (taskId.startsWith("daily_login_day_")) {
			// e.g. daily_login_day_0, daily_login_day_1...
			const dayIndex = parseInt(taskId.replace("daily_login_day_", ""), 10);
			if (rewards.length > 0 && !isNaN(dayIndex)) {
				const r = rewards[dayIndex % rewards.length];
				if (r.type === "gems") gemsReward += r.amount;
				if (r.type === "gold" || r.type === "coins") goldReward += r.amount;
			}
		} else if (taskId.startsWith("daily_login_milestone_")) {
			const mId = taskId.replace("daily_login_milestone_", "");
			const r = rewards.find((rw: any) => rw.id === mId);
			if (r) {
				if (r.type === "gems") gemsReward += r.amount;
				if (r.type === "gold" || r.type === "coins") goldReward += r.amount;
			}
		} else if (taskId.startsWith("reward_")) {
			const r = rewards.find((rw: any) => rw.id === taskId);
			if (r) {
				if (r.type === "gems") gemsReward += r.amount;
				if (r.type === "gold" || r.type === "coins") goldReward += r.amount;
			}
		} else {
			// Find task in tasks list
			const task = tasks.find((t: any) => t.id === taskId);
			if (!task) return res.status(404).json({ message: "Task not found" });
			if (task.reward?.gold) goldReward += task.reward.gold;
			if (task.reward?.gems) gemsReward += task.reward.gems;
		}

		if (goldReward === 0 && gemsReward === 0) {
			return res.status(400).json({ message: "No reward defined for this task" });
		}

		try {
			// 3. Check if already claimed and atomic insert
			// We use event_player_progress to track claims per task per user
			const existing = await (database.prisma as any).event_player_progress.findFirst({
				where: { user_id: user.id, event_id: eventId, task_id: taskId, claimed: true }
			});
			if (existing) return res.status(400).json({ message: "Already claimed" });

			// Upsert progress to marked as claimed
			await (database.prisma as any).event_player_progress.upsert({
				where: {
					event_id_user_id_task_id: {
						event_id: eventId,
						user_id: user.id,
						task_id: taskId
					}
				},
				create: {
					event_id: eventId,
					user_id: user.id,
					task_id: taskId,
					progress: 1,
					completed: true,
					claimed: true,
					claimed_at: new Date()
				},
				update: {
					completed: true,
					claimed: true,
					claimed_at: new Date()
				}
			});

			// 4. Update user currencies
			const updatedCurrencies = await (database.prisma as any).user_currencies.upsert({
				where: { user_id: user.id },
				create: {
					user_id: user.id,
					gold: goldReward,
					gems: gemsReward
				},
				update: {
					gold: { increment: goldReward },
					gems: { increment: gemsReward }
				}
			});

			return res.status(200).json({
				success: true,
				reward: { gold: goldReward, gems: gemsReward },
				balances: { gold: updatedCurrencies.gold, gems: updatedCurrencies.gems }
			});

		} catch (err: any) {
			logger.error("Claim reward error", err);
			return res.status(500).json({ message: "Failed to claim reward" });
		}
	});

	app.get("/guest/session", async (req, res) => {
		const token = res.locals.cookie["guest-token"];

		let account: { id: string } | null = null;

		if (token) {
			// check its valid
			account = await database.prisma.guests.findFirst({
				where: {
					token,
					expires_at: {
						gte: new Date(),
					},
				},
			});

			account ??= null;
		}

		if (!account) {
			const id = await getNewGuestId();
			const newToken = await getNewToken();

			// expire in 1 hour
			const expiryDate = new Date(Date.now() + 60 * 60 * 1000);

			// create a new guest user
			account = await database.prisma.guests.create({
				data: {
					id,
					token: newToken,
					expires_at: expiryDate,

					profile_picture: Math.floor(Math.random() * 36) + 1,
				},
			});

			// set cookie "guest-token" to the token
			res.cookie("guest-token", newToken, {
				// domain: ".localhost",
				expires: expiryDate,
				sameSite: "lax",

				// TODO improve security here, this is a temporary solution as it's only for guests
				httpOnly: false,
			});
		}

		res.status(200).json({
			id: account?.id ?? null,
		});
	});

	app.post(
		"/auth/local/register",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: LOCAL_REGISTER_RATE_LIMIT,
			prefix: "auth-register",
			keyBuilder: (req) => {
				const email = getNormalizedEmail(req.body?.email);
				const ip = getRateLimitClientIp(req);
				return email ? `ip:${ip}:email:${email}` : `ip:${ip}`;
			},
		}),
		async (req, res) => {
			const { email, password } = req.body as {
				email?: string;
				password?: string;
			};

			if (!email || !password) {
				return res
					.status(400)
					.json({ message: "Email and password are required" });
			}

			const normalizedEmail = email.trim().toLowerCase();

			if (!normalizedEmail.includes("@")) {
				return res.status(400).json({ message: "Invalid email address" });
			}

			if (password.length < 8) {
				return res
					.status(400)
					.json({ message: "Password must be at least 8 characters" });
			}

			const existing = await database.user.getByEmail(normalizedEmail);
			if (existing) {
				return res.status(409).json({ message: "Email already registered" });
			}

			const created = await database.user.createLocal(
				normalizedEmail,
				hashPassword(password)
			);

			if (!created) {
				return res
					.status(500)
					.json({ message: "Failed to create local account" });
			}

			const session = await createLocalSession(created.id);
			if (!session) {
				return res
					.status(500)
					.json({ message: "Failed to create local session" });
			}

			return res.status(201).json({
				token: session.token,
				user: userModelToDto(convertDatabaseUserToUserModel(created)),
			});
		}
	);

	app.post(
		"/auth/local/login",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: LOCAL_LOGIN_RATE_LIMIT,
			prefix: "auth-login",
			keyBuilder: (req) => {
				const email = getNormalizedEmail(req.body?.email);
				const ip = getRateLimitClientIp(req);
				return email ? `ip:${ip}:email:${email}` : `ip:${ip}`;
			},
		}),
		async (req, res) => {
			const { email, password } = req.body as {
				email?: string;
				password?: string;
			};

			if (!email || !password) {
				return res
					.status(400)
					.json({ message: "Email and password are required" });
			}

			const user = await database.user.getByEmail(email.trim().toLowerCase());

			const passwordHash = (user as any)?.password_hash as string | undefined;

			if (!user || !passwordHash || !verifyPassword(password, passwordHash)) {
				return res.status(401).json({ message: "Invalid email or password" });
			}

			if ((user as any).locked_at) {
				return res.status(403).json({
					message: (user as any).locked_reason || "Account is locked",
				});
			}

			const session = await createLocalSession(user.id);
			if (!session) {
				return res
					.status(500)
					.json({ message: "Failed to create local session" });
			}

			runtimeSocialState.updatePresence(user.id, "online");

			return res.status(200).json({
				token: session.token,
				user: userModelToDto(convertDatabaseUserToUserModel(user)),
			});
		}
	);

	app.post("/auth/local/logout", async (req, res) => {
		const token = parseAuthorizationToken(
			req.headers.authorization as string | undefined
		);

		if (!token) {
			return res.status(204).end();
		}

		await database.session.deleteByToken(token);
		return res.status(204).end();
	});

	app.post("/presence/ping", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const rawState =
			typeof req.body?.state === "string" ? req.body.state : "online";
		const state =
			rawState === "lobby"
				? "in_room"
				: rawState === "queue" || rawState === "game"
					? "in_game"
					: rawState === "offline"
						? "offline"
						: "online";
		runtimeSocialState.updatePresence(user.id, state);

		return res.status(204).end();
	});

	app.get("/user/current", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		res.setHeader(
			"Cache-Control",
			"no-store, no-cache, must-revalidate, private"
		);
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");

		const dto = userModelToDto(user);
		
		try {
			const currencies = await (database.prisma as any).user_currencies.findFirst({
				where: { user_id: user.id }
			});
			if (currencies) {
				dto.currencies = { gold: currencies.gold, gems: currencies.gems, tickets: currencies.tickets };
			} else {
				dto.currencies = { gold: 0, gems: 0, tickets: 0 };
			}
		} catch (e) {
			dto.currencies = { gold: 0, gems: 0, tickets: 0 };
		}

		res.status(200).json(dto);
	});

	app.patch("/user/current", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);

		if (!user) {
			logger.info("No user found");

			return res.status(401).json({
				message: "Not authorized",
			});
		}

		const nicknameUpdate = await getNicknameUpdate(
			database,
			filter,
			req.body,
			user.id
		);

		if (nicknameUpdate.error) {
			return res.status(400).json({
				message: nicknameUpdate.error,
			});
		}

		const pictureUpdate = await getPictureUpdate(req.body);

		if (pictureUpdate.error) {
			return res.status(400).json({
				message: pictureUpdate.error,
			});
		}

		const personalInfoUpdate = getPersonalInfoUpdate(req.body);

		if (personalInfoUpdate.error) {
			return res.status(400).json({
				message: personalInfoUpdate.error,
			});
		}

		const updatedUser = await database.user.setProfileInfo(
			user.id,
			nicknameUpdate.nickname,
			pictureUpdate.picture,
			personalInfoUpdate.personalInfo
		);

		if (!updatedUser) {
			return res.status(500).json({
				message: "An error occurred while updating the user",
			});
		}

		res
			.status(200)
			.json(userModelToDto(convertDatabaseUserToUserModel(updatedUser)));
	});

	app.get("/friends", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const [friendships, incomingRequests, outgoingRequests, blockedUsers] =
			await Promise.all([
				database.friendship.listForUser(user.id),
				database.friendRequest.getIncomingForUser(user.id),
				database.friendRequest.getOutgoingForUser(user.id),
				database.block.listForUser(user.id),
			]);

		const relatedUserIds = new Set<string>();

		for (const friendship of friendships) {
			relatedUserIds.add(
				friendship.user_low_id === user.id
					? friendship.user_high_id
					: friendship.user_low_id
			);
		}

		for (const request of [...incomingRequests, ...outgoingRequests]) {
			relatedUserIds.add(request.sender_id);
			relatedUserIds.add(request.receiver_id);
		}

		for (const block of blockedUsers) {
			relatedUserIds.add(block.blocked_user_id);
		}

		relatedUserIds.delete(user.id);

		const users = await database.prisma.users.findMany({
			where: {
				id: {
					in: [...relatedUserIds],
				},
			},
		});
		const usersById = new Map(users.map((item) => [item.id, item]));

		const payload: FriendsResponseDto = {
			friends: friendships
				.map((friendship) =>
					usersById.get(
						friendship.user_low_id === user.id
							? friendship.user_high_id
							: friendship.user_low_id
					)
				)
				.filter((item): item is (typeof users)[number] => Boolean(item))
				.map((item) =>
					toFriendDto(item, runtimeSocialState.getPresence(item.id))
				),
			incomingRequests: incomingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			outgoingRequests: outgoingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			blockedUsers: blockedUsers.map((block) =>
				toBlockedUserDto(block, usersById.get(block.blocked_user_id) ?? null)
			),
		};

		res.status(200).json(payload);
	});

	app.get("/friends/search", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

		if (query.length < 2) {
			return res
				.status(400)
				.json({ message: "Query must be at least 2 characters" });
		}

		const blockedUsers = await database.block.listForUser(user.id);
		const blockedSet = new Set(
			blockedUsers.map((item) => item.blocked_user_id)
		);

		const results = await database.prisma.users.findMany({
			where: {
				id: {
					not: user.id,
				},
				nickname: {
					contains: query,
					mode: "insensitive",
				},
			},
			take: 10,
			orderBy: {
				nickname: "asc",
			},
		});

		res.status(200).json({
			results: results
				.filter((item) => !blockedSet.has(item.id))
				.map((item) => toFriendDto(item, "offline")),
		});
	});

	app.post("/friends/request", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const targetUserId = req.body?.targetUserId;
		if (!targetUserId || typeof targetUserId !== "string") {
			return res.status(400).json({ message: "Missing targetUserId" });
		}

		if (targetUserId === user.id) {
			return res.status(400).json({ message: "Cannot add yourself" });
		}

		const [targetUser, blocked, existingFriendship, existingRequest] =
			await Promise.all([
				database.user.getById(targetUserId),
				database.block.existsEitherDirection(user.id, targetUserId),
				database.friendship.exists(user.id, targetUserId),
				database.friendRequest.findBetweenUsers(user.id, targetUserId),
			]);

		if (!targetUser) {
			return res.status(404).json({ message: "Target user not found" });
		}

		if (blocked) {
			return res
				.status(409)
				.json({ message: "Blocked users cannot become friends" });
		}

		if (existingFriendship) {
			return res.status(409).json({ message: "Already friends" });
		}

		if (existingRequest) {
			return res
				.status(409)
				.json({ message: "A pending request already exists" });
		}

		const created = await database.friendRequest.create(user.id, targetUserId);
		if (!created.ok) {
			if (created.reason === "conflict") {
				return res
					.status(409)
					.json({ message: "A pending request already exists" });
			}
			return res
				.status(500)
				.json({ message: "Failed to create friend request" });
		}

		return res
			.status(201)
			.json(
				toFriendRequestDto(
					created.value,
					await database.user.getById(user.id),
					targetUser
				)
			);
	});

	app.post("/friends/request/:id/accept", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const request = await database.friendRequest.accept(req.params.id, user.id);
		if (!request) {
			return res.status(404).json({ message: "Request not found" });
		}

		await database.friendship.createPair(
			request.sender_id,
			request.receiver_id
		);
		return res.status(200).json({ success: true });
	});

	app.post("/friends/request/:id/decline", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const request = await database.friendRequest.decline(
			req.params.id,
			user.id
		);
		if (!request) {
			return res.status(404).json({ message: "Request not found" });
		}
		return res.status(200).json({ success: true });
	});

	app.post("/friends/request/:id/cancel", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const request = await database.friendRequest.cancel(req.params.id, user.id);
		if (!request) {
			return res.status(404).json({ message: "Request not found" });
		}
		return res.status(200).json({ success: true });
	});

	app.delete("/friends/:userId", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const removed = await database.friendship.deletePair(
			user.id,
			req.params.userId
		);
		return res.status(removed ? 200 : 404).json({ success: removed });
	});

	app.post("/blocks", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const targetUserId = req.body?.targetUserId;
		if (!targetUserId || typeof targetUserId !== "string") {
			return res.status(400).json({ message: "Missing targetUserId" });
		}
		if (targetUserId === user.id) {
			return res.status(400).json({ message: "Cannot block yourself" });
		}

		const created = await database.block.create(user.id, targetUserId);
		if (!created) {
			return res.status(500).json({ message: "Failed to create block" });
		}

		await database.friendship.deletePair(user.id, targetUserId);
		return res.status(201).json({ success: true });
	});

	app.delete("/blocks/:userId", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const removed = await database.block.delete(user.id, req.params.userId);
		return res.status(removed ? 200 : 404).json({ success: removed });
	});

	app.get("/matches/history", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const cursor =
			typeof req.query.cursor === "string" ? req.query.cursor : undefined;
		const limit = Math.min(
			20,
			Math.max(1, parseInt((req.query.limit as string) || "20", 10) || 20)
		);
		const timeFilter =
			req.query.timeFilter === "7d" ||
			req.query.timeFilter === "30d" ||
			req.query.timeFilter === "all"
				? req.query.timeFilter
				: "all";
		const sortBy =
			req.query.sortBy === "time_asc" ||
			req.query.sortBy === "placement_best" ||
			req.query.sortBy === "placement_worst"
				? req.query.sortBy
				: "time_desc";
		const resultFilter =
			req.query.resultFilter === "win" ||
			req.query.resultFilter === "top4" ||
			req.query.resultFilter === "loss"
				? req.query.resultFilter
				: "all";

		const rows = await database.matchHistory.listForUser(user.id, {
			cursor,
			limit: limit + 1,
			timeFilter,
			sortBy,
			resultFilter,
		});
		const hasMore = rows.length > limit;
		const items = rows.slice(0, limit);

		const payload: MatchHistoryResponseDto = {
			items: items.map(({ match, participant }) =>
				toMatchHistoryItemDto(match, participant)
			),
			nextCursor: hasMore ? items[items.length - 1].participant.id : null,
		};

		return res.status(200).json(payload);
	});

	app.get("/matches/history/:matchId", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const detail = await database.matchHistory.getDetailForUser(
			user.id,
			req.params.matchId
		);
		if (!detail) {
			return res.status(404).json({ message: "Match history entry not found" });
		}

		const payload: MatchHistoryDetailDto = toMatchHistoryDetailDto(
			detail.match,
			detail.participant,
			detail.participants
		);

		return res.status(200).json(payload);
	});

	app.post("/reports", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const targetUserId = req.body?.targetUserId;
		const reason = req.body?.reason;
		const matchId =
			typeof req.body?.matchId === "string" ? req.body.matchId : undefined;
		const description =
			typeof req.body?.description === "string"
				? req.body.description.trim()
				: "";

		if (!targetUserId || typeof targetUserId !== "string") {
			return res.status(400).json({ message: "Missing targetUserId" });
		}

		if (targetUserId === user.id) {
			return res.status(400).json({ message: "Cannot report yourself" });
		}

		if (!REPORT_REASONS.has(reason)) {
			return res.status(400).json({ message: "Invalid report reason" });
		}
		if (description.length > 500) {
			return res.status(400).json({ message: "Description must be 500 characters or fewer" });
		}
		if (reason === "other" && !description) {
			return res.status(400).json({ message: "Description is required for this report reason" });
		}

		const targetUser = await database.user.getById(targetUserId);
		if (!targetUser) {
			return res.status(404).json({ message: "Target user not found" });
		}
		const hasSharedMatch = await database.matchHistory.hasSharedMatch(
			user.id,
			targetUserId,
			matchId
		);
		if (!hasSharedMatch) {
			return res.status(400).json({ message: "You have not played with this user" });
		}

		const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const count = await database.report.countForReporterTargetSince(
			user.id,
			targetUserId,
			since
		);

		if (count >= 1) {
			return res.status(429).json({ message: "You have already reported this user in the last 24 hours" });
		}

		const pendingCount = await database.report.countPendingForReporter(user.id);
		if (pendingCount >= 10) {
			return res.status(429).json({ message: "Too many pending reports" });
		}

		const report = await database.report.create(user.id, targetUserId, reason, {
			matchId,
			description: description || null,
			reporterIp: req.ip || req.socket.remoteAddress || null,
		});
		if (!report) {
			return res.status(500).json({ message: "Failed to create report" });
		}

		return res.status(201).json({ success: true });
	});

	app.get("/rooms/current", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const room = runtimeSocialState.getRoomForUser(user.id);
		const invites = runtimeSocialState.getInvitesForUser(user.id);

		return res.status(200).json({
			room,
			invites,
		});
	});

	app.post("/rooms", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const room = runtimeSocialState.createRoom({
			userId: user.id,
			nickname: user.nickname || "Unknown",
			profilePicture: user.profile?.picture ?? null,
		});
		runtimeSocialState.updatePresence(user.id, "in_room");

		return res.status(201).json({ room });
	});

	app.post("/rooms/join", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
		if (!code) {
			return res.status(400).json({ message: "Missing room code" });
		}

		const room = runtimeSocialState.joinRoom(code, {
			userId: user.id,
			nickname: user.nickname || "Unknown",
			profilePicture: user.profile?.picture ?? null,
		});

		if (room === "full") {
			return res.status(409).json({ message: "Room is full" });
		}

		if (!room) {
			return res.status(404).json({ message: "Room not found" });
		}

		runtimeSocialState.updatePresence(user.id, "in_room");
		return res.status(200).json({ room });
	});

	app.post("/rooms/leave", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const room = runtimeSocialState.leaveRoom(user.id);
		runtimeSocialState.updatePresence(user.id, "online");

		return res.status(200).json({ room });
	});

	app.post("/rooms/invite", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}
		if (!ensureSocialEligible(res, user)) {
			return;
		}

		const targetUserId =
			typeof req.body?.targetUserId === "string" ? req.body.targetUserId : "";
		if (!targetUserId) {
			return res.status(400).json({ message: "Missing targetUserId" });
		}

		const room = runtimeSocialState.getRoomForUser(user.id);
		if (!room) {
			return res.status(400).json({ message: "Create a room first" });
		}

		const invite = runtimeSocialState.createInvite({
			roomId: room.id,
			roomCode: room.code,
			fromUserId: user.id,
			fromNickname: user.nickname || "Unknown",
			targetUserId,
		});

		return res.status(201).json({ invite });
	});

	app.post("/rooms/invite/:id/accept", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const invite = runtimeSocialState.takeInvite(req.params.id, user.id);
		if (!invite) {
			return res.status(404).json({ message: "Invite not found" });
		}

		const room = runtimeSocialState.joinRoom(invite.roomCode, {
			userId: user.id,
			nickname: user.nickname || "Unknown",
			profilePicture: user.profile?.picture ?? null,
		});

		if (!room || room === "full") {
			return res.status(409).json({ message: "Unable to join room" });
		}

		runtimeSocialState.updatePresence(user.id, "in_room");
		return res.status(200).json({ room });
	});

	app.post("/rooms/invite/:id/decline", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const removed = runtimeSocialState.declineInvite(req.params.id, user.id);
		return res.status(removed ? 200 : 404).json({ success: removed });
	});

	// ======================================================
	// AI Coach Subscription / Upgrade Routes (UC-016)
	// ======================================================

	const AI_COACH_PLANS: Record<
		string,
		{
			name: string;
			priceUsd: number;
			priceVnd: number;
			queries: number;
			positioning: number;
			build: number;
			battleAnalysis: number;
			description: string;
		}
	> = {
		free: {
			name: "Free",
			priceUsd: 0,
			priceVnd: 0,
			queries: 5,
			positioning: 3,
			build: 2,
			battleAnalysis: 1,
			description: "Basic AI coaching with limited daily usage",
		},
		basic: {
			name: "Basic",
			priceUsd: 2.99,
			priceVnd: 75000,
			queries: 30,
			positioning: 20,
			build: 15,
			battleAnalysis: 10,
			description: "Enhanced coaching with more daily queries",
		},
		pro: {
			name: "Pro",
			priceUsd: 7.99,
			priceVnd: 199000,
			queries: 100,
			positioning: 60,
			build: 50,
			battleAnalysis: 30,
			description: "Professional coaching for competitive players",
		},
		unlimited: {
			name: "Unlimited",
			priceUsd: 14.99,
			priceVnd: 375000,
			queries: 999999,
			positioning: 999999,
			build: 999999,
			battleAnalysis: 999999,
			description: "Unlimited access to all AI coaching features",
		},
	};

	// GET /ai-coach/subscription - Get current subscription for authenticated user
	app.get("/ai-coach/subscription", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		let subscription = await database.prisma.ai_coach_subscriptions.findUnique({
			where: { user_id: user.id },
		});

		if (!subscription) {
			subscription = await database.prisma.ai_coach_subscriptions.create({
				data: {
					user_id: user.id,
					plan: "free",
					queries_limit: AI_COACH_PLANS.free.queries,
					positioning_limit: AI_COACH_PLANS.free.positioning,
					build_limit: AI_COACH_PLANS.free.build,
					battle_analysis_limit: AI_COACH_PLANS.free.battleAnalysis,
				},
			});
		}

		const planDef = AI_COACH_PLANS[subscription.plan] || AI_COACH_PLANS.free;

		return res.status(200).json({
			id: subscription.id,
			plan: subscription.plan,
			planName: planDef.name,
			usage: {
				queries: { used: subscription.queries_used, limit: subscription.queries_limit },
				positioning: { used: subscription.positioning_used, limit: subscription.positioning_limit },
				build: { used: subscription.build_used, limit: subscription.build_limit },
				battleAnalysis: { used: subscription.battle_analysis_used, limit: subscription.battle_analysis_limit },
			},
			periodStart: subscription.period_start,
			periodEnd: subscription.period_end,
			activatedAt: subscription.activated_at,
		});
	});

	// GET /ai-coach/plans - List all available plans
	app.get("/ai-coach/plans", (_req, res) => {
		const plans = Object.entries(AI_COACH_PLANS).map(([key, plan]) => ({
			id: key,
			name: plan.name,
			priceUsd: plan.priceUsd,
			priceVnd: plan.priceVnd,
			limits: {
				queries: plan.queries,
				positioning: plan.positioning,
				build: plan.build,
				battleAnalysis: plan.battleAnalysis,
			},
			description: plan.description,
		}));

		return res.status(200).json({ plans });
	});

	// POST /ai-coach/create-order - Create a PayPal order for a plan upgrade
	app.post("/ai-coach/create-order", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const { planId, amountVnd } = req.body as {
			planId?: string;
			amountVnd?: number;
		};

		if (!planId || !AI_COACH_PLANS[planId]) {
			return res.status(400).json({ message: "Invalid plan" });
		}

		if (planId === "free") {
			return res.status(400).json({ message: "Cannot purchase free plan" });
		}

		const plan = AI_COACH_PLANS[planId];

		// Check if user already has this plan or higher
		const currentSub = await database.prisma.ai_coach_subscriptions.findUnique({
			where: { user_id: user.id },
		});

		const planOrder = ["free", "basic", "pro", "unlimited"];
		const currentPlanIndex = planOrder.indexOf(currentSub?.plan || "free");
		const targetPlanIndex = planOrder.indexOf(planId);

		if (targetPlanIndex <= currentPlanIndex) {
			return res.status(400).json({
				message: "Cannot downgrade or purchase same plan",
			});
		}

		// Create payment record
		const amountUsd = plan.priceUsd;
		const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

		await database.prisma.ai_coach_payments.create({
			data: {
				user_id: user.id,
				paypal_order_id: orderId,
				plan: planId,
				amount_usd: amountUsd,
				amount_vnd: amountVnd || plan.priceVnd,
				status: "pending",
			},
		});

		return res.status(201).json({
			orderId,
			amountUsd: amountUsd.toFixed(2),
			planId,
			planName: plan.name,
		});
	});

	// POST /ai-coach/verify-payment - Verify and activate a PayPal payment
	app.post("/ai-coach/verify-payment", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const { orderId, paypalOrderId, payerName, payerEmail, captureId } = req.body as {
			orderId?: string;
			paypalOrderId?: string;
			payerName?: string;
			payerEmail?: string;
			captureId?: string;
		};

		if (!orderId) {
			return res.status(400).json({ message: "Missing orderId" });
		}

		const payment = await database.prisma.ai_coach_payments.findUnique({
			where: { paypal_order_id: orderId },
		});

		if (!payment) {
			return res.status(404).json({ message: "Payment not found" });
		}

		if (payment.user_id !== user.id) {
			return res.status(403).json({ message: "Unauthorized" });
		}

		if (payment.status === "completed") {
			return res.status(409).json({ message: "Payment already completed" });
		}

		const plan = AI_COACH_PLANS[payment.plan];
		if (!plan) {
			return res.status(500).json({ message: "Invalid plan in payment" });
		}

		// Update payment status
		await database.prisma.ai_coach_payments.update({
			where: { id: payment.id },
			data: {
				status: "completed",
				paypal_order_id: paypalOrderId || orderId,
				payer_name: payerName || null,
				payer_email: payerEmail || null,
				paypal_capture_id: captureId || null,
			},
		});

		// Activate the new plan
		const now = new Date();
		const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

		await database.prisma.ai_coach_subscriptions.upsert({
			where: { user_id: user.id },
			update: {
				plan: payment.plan,
				queries_used: 0,
				queries_limit: plan.queries,
				positioning_used: 0,
				positioning_limit: plan.positioning,
				build_used: 0,
				build_limit: plan.build,
				battle_analysis_used: 0,
				battle_analysis_limit: plan.battleAnalysis,
				period_start: now,
				period_end: periodEnd,
				activated_at: now,
			},
			create: {
				user_id: user.id,
				plan: payment.plan,
				queries_limit: plan.queries,
				positioning_limit: plan.positioning,
				build_limit: plan.build,
				battle_analysis_limit: plan.battleAnalysis,
				period_start: now,
				period_end: periodEnd,
				activated_at: now,
			},
		});

		// Create notification for the user
		await database.prisma.user_notifications.create({
			data: {
				user_id: user.id,
				type: "ai_coach_upgrade",
				title: "AI Coach Upgraded!",
				message: `Your AI Coach has been upgraded to the ${plan.name} plan. Enjoy enhanced coaching features!`,
				payload: JSON.stringify({
					plan: payment.plan,
					amountUsd: payment.amount_usd,
				}),
			},
		});

		// Create email confirmation record
		const userRecord = await database.prisma.users.findUnique({
			where: { id: user.id },
		});

		if (userRecord?.email) {
			await database.prisma.email_outbox.create({
				data: {
					user_id: user.id,
					email: userRecord.email,
					template: "ai_coach_upgrade_confirmation",
					subject: `AI Coach Upgraded to ${plan.name}`,
					payload: JSON.stringify({
						planName: plan.name,
						amountUsd: payment.amount_usd,
						activatedAt: now.toISOString(),
						periodEnd: periodEnd.toISOString(),
					}),
				},
			});
		}

		return res.status(200).json({
			success: true,
			plan: payment.plan,
			planName: plan.name,
			periodEnd: periodEnd.toISOString(),
			message: `Successfully upgraded to ${plan.name} plan`,
		});
	});

	// POST /ai-coach/payment-failed - Record a failed payment
	app.post("/ai-coach/payment-failed", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const { orderId, errorMessage } = req.body as {
			orderId?: string;
			errorMessage?: string;
		};

		if (!orderId) {
			return res.status(400).json({ message: "Missing orderId" });
		}

		await database.prisma.ai_coach_payments.updateMany({
			where: {
				paypal_order_id: orderId,
				user_id: user.id,
			},
			data: {
				status: "failed",
				error_message: errorMessage || "Payment failed",
			},
		});

		return res.status(200).json({ success: true });
	});

	// GET /ai-coach/payment-history - Get payment history for user
	app.get("/ai-coach/payment-history", async (req, res) => {
		const user = await requireAuthenticatedUser(req, res, authClient, database);
		if (!user) {
			return;
		}

		const payments = await database.prisma.ai_coach_payments.findMany({
			where: { user_id: user.id },
			orderBy: { created_at: "desc" },
			take: 20,
		});

		return res.status(200).json({
			payments: payments.map((p) => ({
				id: p.id,
				plan: p.plan,
				planName: AI_COACH_PLANS[p.plan]?.name || p.plan,
				amountUsd: p.amount_usd,
				amountVnd: p.amount_vnd,
				status: p.status,
				createdAt: p.created_at,
			})),
		});
	});

	// Start the server
	httpServer.listen(PORT, () => {
		console.log(`Server is listening on port ${PORT}`);
	});
}

startServer().catch((e) => {
	logger.error("An error occurred while starting the server", e);
	process.exit(1);
});
