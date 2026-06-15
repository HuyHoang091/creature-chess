import cors from "cors";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import express from "express";
import { logger as expressWinston } from "express-winston";
import { createClient, RedisClientType } from "redis";

import { createDatabaseConnection, DatabaseConnection } from "@cc-server/data";

import { getRecentLogEntries, logger } from "./src/log";

const app = express();
const PORT = parseInt(process.env.ADMIN_PORT || "3003", 10);
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_RATE_LIMIT = 60;
const ADMIN_MUTATION_RATE_LIMIT = 240;
const ADMIN_EXPORT_RATE_LIMIT = 30;

const ADMIN_PERMISSIONS = {
	user_management: "user_management",
	report_management: "report_management",
	server_monitoring: "server_monitoring",
	bot_management: "bot_management",
	event_management: "event_management",
	admin_permissions: "admin_permissions",
} as const;

type AdminPermission =
	(typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

const ADMIN_PERMISSION_VALUES = Object.values(ADMIN_PERMISSIONS);

const REPORT_REASONS = new Set([
	"abuse",
	"spam",
	"offensive_name",
	"cheating",
	"other",
]);

const REPORT_ACTIONS = new Set([
	"review",
	"dismiss",
	"warning",
	"temporary_ban",
	"permanent_ban",
]);

const EVENT_STATUSES = new Set(["draft", "scheduled", "active", "ended"]);
const USER_ROLES = new Set(["player", "admin"]);

type RateLimitOptions = {
	windowMs: number;
	max: number;
	prefix: string;
	keyBuilder?: (req: express.Request) => string | null;
	skip?: (req: express.Request) => boolean;
};

type MonitoringBucket = {
	requests: number;
	totalMs: number;
	api4xx: number;
	api5xx: number;
	errors: number;
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let runtimeMetrics: MonitoringBucket = {
	requests: 0,
	totalMs: 0,
	api4xx: 0,
	api5xx: 0,
	errors: 0,
};

const getAdminAppOrigins = () => {
	return [
		process.env.ADMIN_APP_URL,
		process.env.CREATURE_CHESS_APP_URL,
		"http://localhost:8090",
		"http://127.0.0.1:8090",
		"http://localhost:8091",
		"http://127.0.0.1:8091",
	]
		.filter(Boolean)
		.map((item) => String(item)) as string[];
};

app.disable("etag");
app.use(
	cors({
		origin: getAdminAppOrigins(),
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);
app.use(express.json());

function getRateLimitClientIp(req: express.Request) {
	return req.ip || req.socket.remoteAddress || "unknown";
}

function getNormalizedEmail(value: unknown) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getAdminRateLimitActorKey(req: express.Request) {
	const token = parseAuthorizationToken(
		req.headers.authorization as string | undefined
	);
	if (token) {
		return `token:${token}`;
	}
	return `ip:${getRateLimitClientIp(req)}`;
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
app.use((req, res, next) => {
	const startedAt = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - startedAt;
		runtimeMetrics.requests += 1;
		runtimeMetrics.totalMs += duration;
		if (res.statusCode >= 400 && res.statusCode < 500) {
			runtimeMetrics.api4xx += 1;
		}
		if (res.statusCode >= 500) {
			runtimeMetrics.api5xx += 1;
			runtimeMetrics.errors += 1;
		}
	});
	next();
});

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

function getAdminEmailSet() {
	return new Set(
		(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean)
	);
}

function getSuperAdminEmailSet() {
	return new Set(
		(process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || "")
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean)
	);
}

function isAdminUser(user: { role?: string | null; email?: string | null }) {
	const email = user.email?.toLowerCase();
	return user.role === "admin" || Boolean(email && getAdminEmailSet().has(email));
}

function isSuperAdminUser(user: { role?: string | null; email?: string | null }) {
	const email = user.email?.toLowerCase();
	return Boolean(email && getSuperAdminEmailSet().has(email));
}

function getUserLockState(user: {
	locked_at?: Date | null;
	locked_until?: Date | null;
	locked_reason?: string | null;
}) {
	if (!user.locked_at) {
		return { locked: false, reason: null, expiresAt: null };
	}
	if (user.locked_until && user.locked_until.getTime() <= Date.now()) {
		return { locked: false, reason: null, expiresAt: user.locked_until };
	}
	return {
		locked: true,
		reason: user.locked_reason || "Account is locked",
		expiresAt: user.locked_until ?? null,
	};
}

function toCsvRow(values: (string | number | null | undefined)[]) {
	return values
		.map((value) => {
			const normalized = value === null || value === undefined ? "" : String(value);
			return `"${normalized.replace(/"/g, "\"\"")}"`;
		})
		.join(",");
}

function parseRangeWindow(req: express.Request) {
	const range = typeof req.query.range === "string" ? req.query.range : "1h";
	const now = new Date();
	if (range === "5m") {
		return { from: new Date(Date.now() - 5 * 60 * 1000), to: now, range };
	}
	if (range === "24h") {
		return { from: new Date(Date.now() - 24 * 60 * 60 * 1000), to: now, range };
	}
	if (range === "7d") {
		return { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), to: now, range };
	}
	if (
		range === "custom" &&
		typeof req.query.from === "string" &&
		typeof req.query.to === "string"
	) {
		const from = new Date(req.query.from);
		const to = new Date(req.query.to);
		if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
			return { from, to, range };
		}
	}
	return { from: new Date(Date.now() - 60 * 60 * 1000), to: now, range: "1h" };
}

async function createAuditLog(
	database: DatabaseConnection,
	payload: {
		actorUserId?: string | null;
		targetUserId?: string | null;
		action: string;
		reason?: string | null;
		metadata?: Record<string, unknown> | null;
	}
) {
	try {
		await ((database.prisma as any).audit_logs as any).create({
			data: {
				actor_user_id: payload.actorUserId ?? null,
				target_user_id: payload.targetUserId ?? null,
				action: payload.action,
				reason: payload.reason ?? null,
				metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
			},
		});
	} catch (error) {
		logger.error("Failed to write audit log", error);
	}
}

async function createUserNotification(
	database: DatabaseConnection,
	payload: {
		userId: string;
		type: string;
		title: string;
		message: string;
		data?: Record<string, unknown> | null;
	}
) {
	try {
		await ((database.prisma as any).user_notifications as any).create({
			data: {
				user_id: payload.userId,
				type: payload.type,
				title: payload.title.slice(0, 120),
				message: payload.message.slice(0, 500),
				payload: payload.data ? JSON.stringify(payload.data) : null,
			},
		});
	} catch (error) {
		logger.error("Failed to create user notification", error);
	}
}

async function queueEmailOutbox(
	database: DatabaseConnection,
	payload: {
		userId?: string | null;
		email: string;
		template: string;
		subject: string;
		data?: Record<string, unknown> | null;
	}
) {
	try {
		await ((database.prisma as any).email_outbox as any).create({
			data: {
				user_id: payload.userId ?? null,
				email: payload.email,
				template: payload.template,
				subject: payload.subject,
				payload: payload.data ? JSON.stringify(payload.data) : null,
			},
		});
	} catch (error) {
		logger.error("Failed to queue email outbox entry", error);
	}
}

async function getGrantedAdminPermissions(
	database: DatabaseConnection,
	userId: string
): Promise<string[]> {
	const rows = await ((database.prisma as any).admin_user_permissions as any).findMany({
		where: { user_id: userId },
		orderBy: { permission: "asc" },
	});
	return rows
		.map((item: any) => item.permission)
		.filter((value: string) => ADMIN_PERMISSION_VALUES.includes(value as AdminPermission));
}

async function resolveAdminPermissions(
	database: DatabaseConnection,
	user: { id: string; role?: string | null; email?: string | null }
) {
	if (!isAdminUser(user)) {
		return [];
	}
	if (isSuperAdminUser(user)) {
		return [...ADMIN_PERMISSION_VALUES];
	}
	const granted = await getGrantedAdminPermissions(database, user.id);
	if (granted.length > 0) {
		return granted;
	}
	return ADMIN_PERMISSION_VALUES.filter(
		(permission) => permission !== ADMIN_PERMISSIONS.admin_permissions
	);
}

async function authenticateAdminToken(
	database: DatabaseConnection,
	token: string
) {
	const session = await ((database.prisma as any).admin_sessions as any).findFirst({
		where: {
			token,
			expires_at: {
				gte: new Date(),
			},
		},
	});
	if (!session) {
		return null;
	}
	await ((database.prisma as any).admin_sessions as any).update({
		where: { id: session.id },
		data: {
			last_seen_at: new Date(),
		},
	});
	const user = await database.user.getById(session.user_id);
	if (!user || !isAdminUser(user)) {
		return null;
	}
	return user;
}

async function requireAdminUser(
	req: express.Request,
	res: express.Response,
	database: DatabaseConnection
) {
	const token = parseAuthorizationToken(
		req.headers.authorization as string | undefined
	);
	if (!token) {
		res.status(401).json({ message: "Admin authentication required" });
		return null;
	}
	const user = await authenticateAdminToken(database, token);
	if (!user) {
		res.status(401).json({ message: "Invalid admin session" });
		return null;
	}
	if (!isAdminUser(user)) {
		res.status(403).json({ message: "Admin access required" });
		return null;
	}
	return user;
}

async function requireAdminPermission(
	req: express.Request,
	res: express.Response,
	database: DatabaseConnection,
	permission: AdminPermission
) {
	const user = await requireAdminUser(req, res, database);
	if (!user) {
		return null;
	}
	const permissions = await resolveAdminPermissions(database, user);
	if (!permissions.includes(permission)) {
		res.status(403).json({ message: "Missing admin permission" });
		return null;
	}
	return user;
}

async function probeService(
	url: string | undefined,
	options?: { headers?: Record<string, string> }
) {
	if (!url) {
		return { status: "unknown", latencyMs: null as number | null };
	}
	try {
		const startedAt = Date.now();
		const response = await fetch(url, {
			method: "GET",
			headers: options?.headers,
		});
		return {
			status: response.ok ? "online" : "degraded",
			latencyMs: Date.now() - startedAt,
		};
	} catch (error) {
		return { status: "offline", latencyMs: null as number | null };
	}
}

function extractPromMetricValue(metricsText: string, metricName: string) {
	const expression = new RegExp(
		`^${metricName}(?:\\{[^\\n]*\\})?\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)$`,
		"gm"
	);
	let match: RegExpExecArray | null;
	let total = 0;
	let found = false;
	do {
		match = expression.exec(metricsText);
		if (match) {
			total += Number(match[1]);
			found = true;
		}
	} while (match);
	return found ? total : null;
}

async function fetchPrometheusMetrics() {
	const metricsUrl =
		process.env.GAME_SERVER_METRICS_URL || "http://localhost:3001/metrics";
	const username = process.env.GAME_METRICS_USERNAME || process.env.METRICS_USERNAME;
	const password = process.env.GAME_METRICS_PASSWORD || process.env.METRICS_PASSWORD;
	const headers: Record<string, string> = {};
	if (username && password) {
		headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
	}
	try {
		const response = await fetch(metricsUrl, { headers });
		if (!response.ok) {
			throw new Error(`Metrics returned ${response.status}`);
		}
		const text = await response.text();
		return {
			activeGames: extractPromMetricValue(text, "so_tran_dang_dien_ra"),
			activeBattles: extractPromMetricValue(text, "so_giao_tranh_dang_dien_ra"),
			gamesStarted: extractPromMetricValue(text, "tong_so_tran_da_bat_dau"),
			battlesStarted: extractPromMetricValue(text, "tong_so_giao_tranh_da_bat_dau"),
			socketInBytes: extractPromMetricValue(text, "tong_so_byte_nhan_qua_socket"),
			socketOutBytes: extractPromMetricValue(text, "tong_so_byte_gui_qua_socket"),
			activePlayers: extractPromMetricValue(text, "so_nguoi_choi_dang_hoat_dong"),
			playersInRoom: extractPromMetricValue(text, "so_nguoi_choi_trong_phong"),
			playersInGame: extractPromMetricValue(text, "so_nguoi_choi_trong_tran"),
			activeRooms: extractPromMetricValue(text, "so_phong_choi_dang_mo"),
			socketConnections: extractPromMetricValue(text, "so_ket_noi_socket_hoat_dong"),
		};
	} catch (error) {
		logger.warn("Failed to fetch Prometheus metrics", error);
		return null;
	}
}

function buildAdminCommandPublisher() {
	const redisUrl = process.env.REDIS_URL;
	if (!redisUrl) {
		return { client: null as RedisClientType | null, publish: async () => undefined };
	}
	const client = createClient({ url: redisUrl });
	client.connect().catch((error) => logger.error("Failed to connect admin redis publisher", error));
	return {
		client,
		publish: async (channel: string, payload: Record<string, unknown>) => {
			if (!client.isReady) {
				return;
			}
			try {
				await client.publish(channel, JSON.stringify(payload));
			} catch (error) {
				logger.error("Failed to publish admin command", error);
			}
		},
	};
}

async function startServer() {
	const database = await createDatabaseConnection(logger);
	const forceLogoutPublisher = buildAdminCommandPublisher();

	const publishForceLogout = async (
		userId: string,
		reason: string,
		expiresAt?: string | null
	) => {
		await forceLogoutPublisher.publish("admin:moderation", {
			type: "force_logout",
			userId,
			reason,
			expiresAt: expiresAt ?? null,
		});
	};

	const captureMonitoringSnapshot = async () => {
		const apiHealth = await probeService(
			process.env.API_INFO_HEALTH_URL || "http://localhost:3002/health"
		);
		const gameHealth = await probeService(
			process.env.GAME_SERVER_HEALTH_URL || "http://localhost:3001/health"
		);
		const ragHealth = await probeService(process.env.RAG_HEALTH_URL);

		let dbLatencyMs: number | null = null;
		let databaseStatus = "online";
		try {
			const startedAt = Date.now();
			await database.prisma.$queryRawUnsafe("SELECT 1");
			dbLatencyMs = Date.now() - startedAt;
		} catch (error) {
			databaseStatus = "offline";
		}

		const promMetrics = await fetchPrometheusMetrics();
		const [openReports, lockedUsers, recentMatches] = await Promise.all([
			(database.prisma.reports as any).count({
				where: {
					status: {
						in: ["pending", "reviewed"],
					},
				},
			}),
			(database.prisma.users as any).count({
				where: {
					locked_at: { not: null },
					OR: [{ locked_until: null }, { locked_until: { gt: new Date() } }],
				},
			}),
			(database.prisma.matches as any).findMany({
				orderBy: { ended_at: "desc" },
				take: 200,
			}),
		]);

		const avgMatchDurationSeconds =
			recentMatches.length === 0
				? null
				: recentMatches.reduce((sum: number, item: any) => {
						return sum + (item.ended_at.getTime() - item.started_at.getTime()) / 1000;
				  }, 0) / recentMatches.length;

		const snapshotMetrics = runtimeMetrics;
		runtimeMetrics = {
			requests: 0,
			totalMs: 0,
			api4xx: 0,
			api5xx: 0,
			errors: 0,
		};

		await ((database.prisma as any).monitoring_snapshots as any).create({
			data: {
				api_server_status: apiHealth.status,
				game_server_status: gameHealth.status,
				rag_service_status: ragHealth.status,
				database_status: databaseStatus,
				redis_status: process.env.REDIS_URL ? "online" : "unknown",
				cpu_percent: null,
				rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
				heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				db_latency_ms: dbLatencyMs,
				average_request_ms:
					snapshotMetrics.requests > 0
						? snapshotMetrics.totalMs / snapshotMetrics.requests
						: null,
				api_requests: snapshotMetrics.requests,
				api_4xx: snapshotMetrics.api4xx,
				api_5xx: snapshotMetrics.api5xx,
				error_count: snapshotMetrics.errors,
				socket_connections: Math.round(promMetrics?.socketConnections || 0),
				active_players: Math.round(promMetrics?.activePlayers || 0),
				players_in_room: Math.round(promMetrics?.playersInRoom || 0),
				players_in_game: Math.round(promMetrics?.playersInGame || 0),
				active_rooms: Math.round(promMetrics?.activeRooms || 0),
				active_games: Math.round(promMetrics?.activeGames || 0),
				games_started_per_hour: promMetrics?.gamesStarted ?? null,
				battles_started_per_hour: promMetrics?.battlesStarted ?? null,
				avg_match_duration_s: avgMatchDurationSeconds,
				socket_in_mb:
					promMetrics?.socketInBytes === null || promMetrics?.socketInBytes === undefined
						? null
						: promMetrics.socketInBytes / 1024 / 1024,
				socket_out_mb:
					promMetrics?.socketOutBytes === null || promMetrics?.socketOutBytes === undefined
						? null
						: promMetrics.socketOutBytes / 1024 / 1024,
				open_reports: openReports,
				locked_users: lockedUsers,
			},
		});

		await ((database.prisma as any).monitoring_snapshots as any).deleteMany({
			where: {
				captured_at: {
					lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
				},
			},
		});
	};

	const processExpiredLocks = async () => {
		const expiredUsers = await (database.prisma.users as any).findMany({
			where: {
				locked_at: { not: null },
				locked_until: { lte: new Date() },
			},
		});
		for (const user of expiredUsers) {
			await (database.prisma.users as any).update({
				where: { id: user.id },
				data: {
					locked_at: null,
					locked_until: null,
					locked_reason: null,
				},
			});
			await createAuditLog(database, {
				targetUserId: user.id,
				action: "system.user.auto_unlocked",
				reason: "Temporary ban expired",
			});
			if (user.email) {
				await queueEmailOutbox(database, {
					userId: user.id,
					email: user.email,
					template: "unlock_notice",
					subject: "Creature Chess account restored",
					data: {
						reason: "Temporary suspension expired",
					},
				});
			}
			await createUserNotification(database, {
				userId: user.id,
				type: "unlock_notice",
				title: "Account restored",
				message: "Your temporary suspension has expired.",
			});
		}
	};

	app.get("/health", (_req, res) => {
		res.status(200).json({ status: "ok", service: "admin" });
	});

	app.post(
		"/auth/login",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_LOGIN_RATE_LIMIT,
			prefix: "admin-login",
			keyBuilder: (req) => {
				const email = getNormalizedEmail(req.body?.email);
				const ip = getRateLimitClientIp(req);
				return email ? `ip:${ip}:email:${email}` : `ip:${ip}`;
			},
		}),
		async (req, res) => {
			const email =
				typeof req.body?.email === "string"
					? req.body.email.trim().toLowerCase()
					: "";
			const password =
				typeof req.body?.password === "string" ? req.body.password : "";
			if (!email || !password) {
				return res.status(400).json({ message: "Email and password are required" });
			}

			const user = await database.user.getByEmail(email);
			if (!user || !user.password_hash || !isAdminUser(user)) {
				return res.status(401).json({ message: "Invalid admin credentials" });
			}
			const lockState = getUserLockState(user as any);
			if (lockState.locked) {
				return res.status(403).json({ message: lockState.reason || "Account is locked" });
			}
			if (!verifyPassword(password, user.password_hash)) {
				return res.status(401).json({ message: "Invalid admin credentials" });
			}

			const token = `admin_${randomBytes(24).toString("hex")}`;
			const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
			await ((database.prisma as any).admin_sessions as any).create({
				data: {
					user_id: user.id,
					token,
					expires_at: expiresAt,
				},
			});
			await (database.prisma.users as any).update({
				where: { id: user.id },
				data: {
					last_login_at: new Date(),
				},
			});
			const permissions = await resolveAdminPermissions(database, user);
			await createAuditLog(database, {
				actorUserId: user.id,
				action: "admin.auth.login",
			});

			return res.status(200).json({
				accessToken: token,
				expiresAt: expiresAt.toISOString(),
				user: {
					id: user.id,
					email: user.email,
					nickname: user.nickname,
					role: "admin",
					permissions,
					canGrantAdminPermissions: permissions.includes(
						ADMIN_PERMISSIONS.admin_permissions
					),
				},
			});
		}
	);

	app.post("/auth/logout", async (req, res) => {
		const token = parseAuthorizationToken(
			req.headers.authorization as string | undefined
		);
		if (!token) {
			return res.status(204).send();
		}
		const session = await ((database.prisma as any).admin_sessions as any).findFirst({
			where: { token },
		});
		await ((database.prisma as any).admin_sessions as any).deleteMany({
			where: { token },
		});
		if (session) {
			await (database.prisma.users as any).updateMany({
				where: { id: session.user_id },
				data: { last_logout_at: new Date() },
			});
			await createAuditLog(database, {
				actorUserId: session.user_id,
				action: "admin.auth.logout",
			});
		}
		return res.status(204).send();
	});

	app.get("/auth/me", async (req, res) => {
		const admin = await requireAdminUser(req, res, database);
		if (!admin) {
			return;
		}
		const permissions = await resolveAdminPermissions(database, admin);
		return res.status(200).json({
			user: {
				id: admin.id,
				email: admin.email,
				nickname: admin.nickname,
				role: "admin",
				permissions,
				canGrantAdminPermissions: permissions.includes(
					ADMIN_PERMISSIONS.admin_permissions
				),
			},
		});
	});

	app.get("/overview", async (req, res) => {
		const admin = await requireAdminUser(req, res, database);
		if (!admin) {
			return;
		}
		const [users, lockedUsers, matches, openReports, bots, activeEvents] =
			await Promise.all([
				(database.prisma.users as any).count(),
				(database.prisma.users as any).count({
					where: {
						locked_at: { not: null },
						OR: [{ locked_until: null }, { locked_until: { gt: new Date() } }],
					},
				}),
				(database.prisma.matches as any).count(),
				(database.prisma.reports as any).count({
					where: {
						status: { in: ["pending", "reviewed"] },
					},
				}),
				(database.prisma.bots as any).count(),
				(database.prisma.game_events as any).count({
					where: { status: { in: ["scheduled", "active"] } },
				}),
			]);

		const latestSnapshot = await ((database.prisma as any).monitoring_snapshots as any).findFirst({
			orderBy: { captured_at: "desc" },
		});

		return res.status(200).json({
			users,
			lockedUsers,
			matches,
			openReports,
			bots,
			activeEvents,
			server: {
				uptimeSeconds: Math.round(process.uptime()),
				memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
				heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				nodeVersion: process.version,
				adminUserId: admin.id,
				activePlayers: latestSnapshot?.active_players ?? 0,
				playersInRoom: latestSnapshot?.players_in_room ?? 0,
				playersInGame: latestSnapshot?.players_in_game ?? 0,
			},
		});
	});

	app.get("/users", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}
		const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
		const statusFilter =
			typeof req.query.status === "string" ? req.query.status : "all";
		const limit = Math.min(
			50,
			Math.max(1, parseInt((req.query.limit as string) || "50", 10) || 50)
		);
		const cursor =
			typeof req.query.cursor === "string" ? req.query.cursor : undefined;
		const where = query
			? {
					OR: [
						{ id: { contains: query } },
						{ email: { contains: query, mode: "insensitive" } },
						{ nickname: { contains: query, mode: "insensitive" } },
					],
				}
			: {};

		const users = await (database.prisma.users as any).findMany({
			where: {
				...where,
				...(statusFilter === "locked"
					? {
							locked_at: { not: null },
							OR: [{ locked_until: null }, { locked_until: { gt: new Date() } }],
					  }
					: statusFilter === "active"
						? {
								OR: [{ locked_at: null }, { locked_until: { lte: new Date() } }],
						  }
						: {}),
			},
			orderBy: [{ role: "desc" }, { nickname: "asc" }],
			take: limit + 1,
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
		});

		const hasMore = users.length > limit;
		const page = users.slice(0, limit);

		return res.status(200).json({
			users: page.map((item: any) => {
				const lockState = getUserLockState(item);
				return {
					id: item.id,
					email: item.email,
					nickname: item.nickname,
					profilePicture: item.profile_picture ?? null,
					personalInfo: item.profile_bio ?? null,
					role: item.role === "admin" ? "admin" : "player",
					locked: lockState.locked,
					lockedReason: lockState.reason,
					lockedUntil: lockState.expiresAt?.toISOString() ?? null,
					warningCount: item.warning_count ?? 0,
					gamesPlayed: item.games_played,
					wins: item.wins,
					lastLoginAt: item.last_login_at?.toISOString() ?? null,
					lastLogoutAt: item.last_logout_at?.toISOString() ?? null,
				};
			}),
			nextCursor: hasMore ? page[page.length - 1].id : null,
		});
	});

	app.get(
		"/users/export",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_EXPORT_RATE_LIMIT,
			prefix: "admin-users-export",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}
		const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
		const users = await (database.prisma.users as any).findMany({
			where: query
				? {
						OR: [
							{ id: { contains: query } },
							{ email: { contains: query, mode: "insensitive" } },
							{ nickname: { contains: query, mode: "insensitive" } },
						],
				  }
				: undefined,
			orderBy: [{ role: "desc" }, { nickname: "asc" }],
			take: 1000,
		});
		const csv = [
			toCsvRow([
				"id",
				"email",
				"nickname",
				"role",
				"locked",
				"lockedUntil",
				"warnings",
				"gamesPlayed",
				"wins",
			]),
			...users.map((item: any) => {
				const lockState = getUserLockState(item);
				return toCsvRow([
					item.id,
					item.email ?? "",
					item.nickname ?? "",
					item.role,
					lockState.locked ? "true" : "false",
					lockState.expiresAt?.toISOString() ?? "",
					item.warning_count ?? 0,
					item.games_played,
					item.wins,
				]);
			}),
		].join("\n");
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader("Content-Disposition", 'attachment; filename="admin-users.csv"');
		return res.status(200).send(csv);
		}
	);

	app.get("/users/:id", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}

		const user = await (database.prisma.users as any).findUnique({
			where: { id: req.params.id },
		});
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}
		const activityType =
			typeof req.query.activityType === "string" ? req.query.activityType.trim() : "";

		const [reports, activities, warnings, matchRows] = await Promise.all([
			(database.prisma.reports as any).findMany({
				where: {
					target_user_id: user.id,
				},
				orderBy: { created_at: "desc" },
				take: 20,
			}),
			((database.prisma as any).audit_logs as any).findMany({
				where: {
					OR: [{ actor_user_id: user.id }, { target_user_id: user.id }],
					...(activityType ? { action: { startsWith: activityType } } : {}),
				},
				orderBy: { created_at: "desc" },
				take: 30,
			}),
			((database.prisma as any).moderation_warnings as any).findMany({
				where: { target_user_id: user.id },
				orderBy: { created_at: "desc" },
				take: 10,
			}),
			(database.prisma.match_participants as any).findMany({
				where: { user_id: user.id },
				orderBy: { created_at: "desc" },
				take: 10,
			}),
		]);

		const matchIds = matchRows.map((item: any) => item.match_id);
		const matches = await (database.prisma.matches as any).findMany({
			where: { id: { in: matchIds } },
		});
		const matchById = new Map<string, any>(
			matches.map((item: any) => [item.id, item])
		);
		const effectivePermissions =
			user.role === "admin" ? await resolveAdminPermissions(database, user) : [];
		const grantedPermissions =
			user.role === "admin" ? await getGrantedAdminPermissions(database, user.id) : [];
		const lockState = getUserLockState(user);

		return res.status(200).json({
			user: {
				id: user.id,
				email: user.email ?? null,
				nickname: user.nickname ?? null,
				profilePicture: user.profile_picture ?? null,
				personalInfo: user.profile_bio ?? null,
				role: user.role === "admin" ? "admin" : "player",
				locked: lockState.locked,
				lockedReason: lockState.reason,
				lockedUntil: lockState.expiresAt?.toISOString() ?? null,
				warningCount: user.warning_count ?? 0,
				gamesPlayed: user.games_played,
				wins: user.wins,
				lastLoginAt: user.last_login_at?.toISOString() ?? null,
				lastLogoutAt: user.last_logout_at?.toISOString() ?? null,
				effectivePermissions,
				grantedPermissions,
			},
			relatedReports: reports.map((item: any) => ({
				id: item.id,
				reason: item.reason,
				status: item.status,
				createdAt: item.created_at.toISOString(),
				actionType: item.action_type ?? null,
			})),
			activity: activities.map((item: any) => ({
				id: item.id,
				action: item.action,
				reason: item.reason ?? null,
				metadata: item.metadata ?? null,
				createdAt: item.created_at.toISOString(),
			})),
			warnings: warnings.map((item: any) => ({
				id: item.id,
				reportId: item.report_id ?? null,
				message: item.message,
				createdAt: item.created_at.toISOString(),
			})),
			recentMatches: matchRows.map((item: any) => ({
				matchId: item.match_id,
				placement: item.placement,
				endedAt: matchById.get(item.match_id)?.ended_at?.toISOString() ?? null,
			})),
		});
	});

	app.patch(
		"/users/:id",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-user-update",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}
		const user = await (database.prisma.users as any).findUnique({
			where: { id: req.params.id },
		});
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const updateData: Record<string, unknown> = {};
		if (req.body?.nickname !== undefined) {
			updateData.nickname = String(req.body.nickname || "").trim().slice(0, 20) || null;
		}
		if (req.body?.email !== undefined) {
			updateData.email = String(req.body.email || "").trim().toLowerCase() || null;
		}
		if (req.body?.picture !== undefined) {
			updateData.profile_picture =
				req.body.picture === null || req.body.picture === ""
					? null
					: Number(req.body.picture);
		}
		if (req.body?.personalInfo !== undefined) {
			updateData.profile_bio =
				req.body.personalInfo === null
					? null
					: String(req.body.personalInfo || "").trim().slice(0, 280);
		}
		if (req.body?.role !== undefined) {
			if (!USER_ROLES.has(req.body.role)) {
				return res.status(400).json({ message: "Invalid role" });
			}
			updateData.role = req.body.role;
		}

		const updated = await (database.prisma.users as any).update({
			where: { id: user.id },
			data: updateData,
		});
		await createAuditLog(database, {
			actorUserId: admin.id,
			targetUserId: user.id,
			action: "admin.user.updated",
			metadata: {
				oldValue: {
					nickname: user.nickname,
					email: user.email,
					profilePicture: user.profile_picture,
					personalInfo: user.profile_bio,
					role: user.role,
				},
				newValue: updateData,
			},
		});

		return res.status(200).json({
			user: {
				id: updated.id,
			},
		});
		}
	);

	app.put(
		"/users/:id/permissions",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-user-permissions",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.admin_permissions
		);
		if (!admin) {
			return;
		}
		const user = await (database.prisma.users as any).findUnique({
			where: { id: req.params.id },
		});
		if (!user || user.role !== "admin") {
			return res.status(404).json({ message: "Admin user not found" });
		}
		const permissions = Array.isArray(req.body?.permissions)
			? req.body.permissions
					.map((item: unknown) => String(item))
					.filter((item: string) =>
						ADMIN_PERMISSION_VALUES.includes(item as AdminPermission)
					)
			: [];
		if (
			admin.id === user.id &&
			!permissions.includes(ADMIN_PERMISSIONS.admin_permissions)
		) {
			return res.status(400).json({
				message: "You cannot remove your own admin_permissions access",
			});
		}

		await ((database.prisma as any).admin_user_permissions as any).deleteMany({
			where: { user_id: user.id },
		});
		if (permissions.length > 0) {
			await ((database.prisma as any).admin_user_permissions as any).createMany({
				data: permissions.map((permission: string) => ({
					user_id: user.id,
					permission,
					granted_by_user_id: admin.id,
				})),
			});
		}
		await createAuditLog(database, {
			actorUserId: admin.id,
			targetUserId: user.id,
			action: "admin.user.permissions_updated",
			metadata: { permissions },
		});
		return res.status(200).json({ success: true });
		}
	);

	app.post(
		"/users/:id/lock",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-user-lock",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}
		if (admin.id === req.params.id) {
			return res.status(400).json({ message: "Cannot lock your own account" });
		}
		const user = await (database.prisma.users as any).findUnique({
			where: { id: req.params.id },
		});
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}
		const reason =
			typeof req.body?.reason === "string" && req.body.reason.trim()
				? req.body.reason.trim().slice(0, 255)
				: "Locked by admin";
		const mode =
			req.body?.mode === "temporary" ? "temporary" : "permanent";
		const durationDays =
			mode === "temporary"
				? Math.max(1, Math.min(365, Number(req.body?.durationDays || 7)))
				: null;
		const lockedUntil =
			mode === "temporary"
				? new Date(Date.now() + durationDays! * 24 * 60 * 60 * 1000)
				: null;

		await (database.prisma.users as any).update({
			where: { id: user.id },
			data: {
				locked_at: new Date(),
				locked_until: lockedUntil,
				locked_reason: reason,
			},
		});
		await database.session.deleteByUserId(user.id);
		await ((database.prisma as any).admin_sessions as any).deleteMany({
			where: { user_id: user.id },
		});
		await createAuditLog(database, {
			actorUserId: admin.id,
			targetUserId: user.id,
			action: mode === "temporary" ? "admin.user.temp_locked" : "admin.user.locked",
			reason,
			metadata: {
				durationDays,
				lockedUntil: lockedUntil?.toISOString() ?? null,
			},
		});
		if (user.email) {
			await queueEmailOutbox(database, {
				userId: user.id,
				email: user.email,
				template: mode === "temporary" ? "temp_ban" : "permanent_ban",
				subject:
					mode === "temporary"
						? "Creature Chess temporary suspension"
						: "Creature Chess account suspended",
				data: {
					reason,
					lockedUntil: lockedUntil?.toISOString() ?? null,
				},
			});
		}
		await createUserNotification(database, {
			userId: user.id,
			type: mode === "temporary" ? "temporary_ban" : "permanent_ban",
			title:
				mode === "temporary" ? "Temporary suspension" : "Account suspended",
			message: reason,
			data: {
				lockedUntil: lockedUntil?.toISOString() ?? null,
			},
		});
		await publishForceLogout(user.id, reason, lockedUntil?.toISOString() ?? null);
		return res.status(200).json({ success: true });
		}
	);

	app.post(
		"/users/:id/unlock",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-user-unlock",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.user_management
		);
		if (!admin) {
			return;
		}
		const user = await (database.prisma.users as any).findUnique({
			where: { id: req.params.id },
		});
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}
		await (database.prisma.users as any).update({
			where: { id: user.id },
			data: {
				locked_at: null,
				locked_until: null,
				locked_reason: null,
			},
		});
		await createAuditLog(database, {
			actorUserId: admin.id,
			targetUserId: user.id,
			action: "admin.user.unlocked",
		});
		if (user.email) {
			await queueEmailOutbox(database, {
				userId: user.id,
				email: user.email,
				template: "unlock_notice",
				subject: "Creature Chess account restored",
			});
		}
		await createUserNotification(database, {
			userId: user.id,
			type: "unlock_notice",
			title: "Account restored",
			message: "An administrator restored access to your account.",
		});
		return res.status(200).json({ success: true });
		}
	);

	app.get("/reports", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.report_management
		);
		if (!admin) {
			return;
		}

		const status = typeof req.query.status === "string" ? req.query.status : "all";
		const reason = typeof req.query.reason === "string" ? req.query.reason : "all";
		const windowDays = Math.min(
			30,
			Math.max(1, parseInt((req.query.windowDays as string) || "30", 10) || 30)
		);
		const sortBy =
			typeof req.query.sortBy === "string" ? req.query.sortBy : "newest";
		const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

		const reports = await (database.prisma.reports as any).findMany({
			where: {
				created_at: { gte: since },
				...(status !== "all" ? { status } : {}),
				...(reason !== "all" ? { reason } : {}),
			},
			orderBy: { created_at: "desc" },
			take: 200,
		});

		const userIds = new Set<string>();
		for (const item of reports) {
			userIds.add(item.reporter_user_id);
			userIds.add(item.target_user_id);
		}
		const users = await (database.prisma.users as any).findMany({
			where: { id: { in: [...userIds] } },
		});
		const userById = new Map<string, any>(
			users.map((item: any) => [item.id, item])
		);
		const countsByTarget = reports.reduce((acc: Record<string, number>, item: any) => {
			acc[item.target_user_id] = (acc[item.target_user_id] ?? 0) + 1;
			return acc;
		}, {});

		const mappedReports = reports.map((item: any) => ({
			id: item.id,
			reason: item.reason,
			description: item.description ?? "",
			status: item.status,
			actionType: item.action_type ?? null,
			actionExpiresAt: item.action_expires_at?.toISOString() ?? null,
			priority: countsByTarget[item.target_user_id] ?? 1,
			adminNote: item.admin_note ?? null,
			matchId: item.match_id ?? null,
			createdAt: item.created_at.toISOString(),
			resolvedAt: item.resolved_at?.toISOString() ?? null,
			reporter: {
				id: item.reporter_user_id,
				nickname: userById.get(item.reporter_user_id)?.nickname || "Unknown",
			},
			target: {
				id: item.target_user_id,
				nickname: userById.get(item.target_user_id)?.nickname || "Unknown",
				locked: getUserLockState(userById.get(item.target_user_id) ?? {}).locked,
				warningCount: userById.get(item.target_user_id)?.warning_count ?? 0,
			},
		}));

		mappedReports.sort((left: any, right: any) => {
			if (sortBy === "oldest") {
				return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
			}
			if (sortBy === "priority") {
				if (right.priority !== left.priority) {
					return right.priority - left.priority;
				}
			}
			return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
		});

		return res.status(200).json({ reports: mappedReports });
	});

	app.get("/reports/:id", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.report_management
		);
		if (!admin) {
			return;
		}
		const report = await (database.prisma.reports as any).findUnique({
			where: { id: req.params.id },
		});
		if (!report) {
			return res.status(404).json({ message: "Report not found" });
		}

		const [reporter, target, targetHistory, reporterRecentReports, warnings, participants] =
			await Promise.all([
				(database.prisma.users as any).findUnique({
					where: { id: report.reporter_user_id },
				}),
				(database.prisma.users as any).findUnique({
					where: { id: report.target_user_id },
				}),
				(database.prisma.reports as any).findMany({
					where: { target_user_id: report.target_user_id },
					orderBy: { created_at: "desc" },
					take: 20,
				}),
				(database.prisma.reports as any).findMany({
					where: { reporter_user_id: report.reporter_user_id },
					orderBy: { created_at: "desc" },
					take: 10,
				}),
				((database.prisma as any).moderation_warnings as any).findMany({
					where: { target_user_id: report.target_user_id },
					orderBy: { created_at: "desc" },
					take: 10,
				}),
				report.match_id
					? (database.prisma.match_participants as any).findMany({
							where: { match_id: report.match_id },
							orderBy: { placement: "asc" },
					  })
					: Promise.resolve([]),
			]);

		const targetReasonPatterns: Record<string, number> = {};
		for (const item of targetHistory as any[]) {
			targetReasonPatterns[item.reason] =
				(targetReasonPatterns[item.reason] ?? 0) + 1;
		}

		return res.status(200).json({
			report: {
				id: report.id,
				reason: report.reason,
				description: report.description ?? "",
				status: report.status,
				matchId: report.match_id ?? null,
				createdAt: report.created_at.toISOString(),
				adminNote: report.admin_note ?? null,
				actionType: report.action_type ?? null,
				actionExpiresAt: report.action_expires_at?.toISOString() ?? null,
				reporter: reporter
					? {
							id: reporter.id,
							email: reporter.email ?? null,
							nickname: reporter.nickname ?? null,
							gamesPlayed: reporter.games_played ?? 0,
							wins: reporter.wins ?? 0,
					  }
					: null,
				target: target
					? {
							id: target.id,
							email: target.email ?? null,
							nickname: target.nickname ?? null,
							gamesPlayed: target.games_played ?? 0,
							wins: target.wins ?? 0,
							warningCount: target.warning_count ?? 0,
							locked: getUserLockState(target).locked,
							lockedUntil: target.locked_until?.toISOString() ?? null,
					  }
					: null,
			},
			targetReportHistory: targetHistory.map((item: any) => ({
				id: item.id,
				reason: item.reason,
				status: item.status,
				createdAt: item.created_at.toISOString(),
				actionType: item.action_type ?? null,
			})),
			reporterRecentReports: reporterRecentReports.map((item: any) => ({
				id: item.id,
				reason: item.reason,
				status: item.status,
				createdAt: item.created_at.toISOString(),
				targetUserId: item.target_user_id,
			})),
			targetReasonPatterns,
			warnings: warnings.map((item: any) => ({
				id: item.id,
				message: item.message,
				reportId: item.report_id ?? null,
				createdAt: item.created_at.toISOString(),
			})),
			matchParticipants: participants.map((item: any) => ({
				userId: item.user_id ?? null,
				displayName: item.display_name,
				placement: item.placement,
				isBot: item.is_bot,
			})),
		});
	});

	app.patch(
		"/reports/:id",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-report-update",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.report_management
		);
		if (!admin) {
			return;
		}
		const action = req.body?.action;
		if (!REPORT_ACTIONS.has(action)) {
			return res.status(400).json({ message: "Invalid report action" });
		}
		const adminNote =
			typeof req.body?.adminNote === "string"
				? req.body.adminNote.trim().slice(0, 500)
				: "";
		if (!adminNote) {
			return res.status(400).json({ message: "Admin note is required" });
		}
		const report = await (database.prisma.reports as any).findUnique({
			where: { id: req.params.id },
		});
		if (!report) {
			return res.status(404).json({ message: "Report not found" });
		}
		if (["dismissed", "actioned"].includes(report.status)) {
			return res.status(409).json({
				message: "This report was already handled by another admin",
			});
		}

		const reporter = await (database.prisma.users as any).findUnique({
			where: { id: report.reporter_user_id },
		});
		const target = await (database.prisma.users as any).findUnique({
			where: { id: report.target_user_id },
		});
		if (!target) {
			await (database.prisma.reports as any).update({
				where: { id: report.id },
				data: {
					status: "dismissed",
					action_type: "auto_dismissed_missing_target",
					admin_note: "Target account no longer exists",
					resolved_at: new Date(),
					resolved_by_user_id: admin.id,
				},
			});
			await createAuditLog(database, {
				actorUserId: admin.id,
				action: "admin.report.auto_dismiss_missing_target",
				metadata: { reportId: report.id },
			});
			return res.status(409).json({
				message: "Target user no longer exists. Report was auto-dismissed.",
			});
		}

		let nextStatus = "reviewed";
		let actionType: string | null = null;
		let actionExpiresAt: Date | null = null;
		let userUpdate: Record<string, unknown> | null = null;
		let targetNotificationMessage = "";
		let reporterFeedbackMessage = "Your report was reviewed by an administrator.";

		if (action === "review") {
			nextStatus = "reviewed";
			reporterFeedbackMessage = "Your report was marked as reviewed.";
		} else if (action === "dismiss") {
			nextStatus = "dismissed";
			actionType = "dismissed";
			reporterFeedbackMessage = "Your report was reviewed and dismissed.";
		} else if (action === "warning") {
			nextStatus = "actioned";
			actionType = "warning";
			userUpdate = {
				warning_count: (target.warning_count ?? 0) + 1,
			};
			targetNotificationMessage = adminNote;
			reporterFeedbackMessage =
				"Your report resulted in an official warning for the target player.";
		} else if (action === "temporary_ban") {
			const durationDays = Math.max(
				1,
				Math.min(365, parseInt(String(req.body?.durationDays || "7"), 10) || 7)
			);
			nextStatus = "actioned";
			actionType = "temporary_ban";
			actionExpiresAt = new Date(
				Date.now() + durationDays * 24 * 60 * 60 * 1000
			);
			userUpdate = {
				locked_at: new Date(),
				locked_until: actionExpiresAt,
				locked_reason: adminNote,
			};
			targetNotificationMessage = `Your account was temporarily suspended. ${adminNote}`;
			reporterFeedbackMessage =
				"Your report resulted in a temporary suspension for the target player.";
		} else if (action === "permanent_ban") {
			if (adminNote.length < 20) {
				return res.status(400).json({
					message: "Permanent bans require a detailed reason",
				});
			}
			nextStatus = "actioned";
			actionType = "permanent_ban";
			userUpdate = {
				locked_at: new Date(),
				locked_until: null,
				locked_reason: adminNote,
			};
			targetNotificationMessage = `Your account was permanently suspended. ${adminNote}`;
			reporterFeedbackMessage =
				"Your report resulted in a permanent suspension for the target player.";
		}

		if (userUpdate) {
			await (database.prisma.users as any).update({
				where: { id: target.id },
				data: userUpdate,
			});
			if (action === "temporary_ban" || action === "permanent_ban") {
				await database.session.deleteByUserId(target.id);
				await ((database.prisma as any).admin_sessions as any).deleteMany({
					where: { user_id: target.id },
				});
			}
		}
		if (action === "warning") {
			await ((database.prisma as any).moderation_warnings as any).create({
				data: {
					target_user_id: target.id,
					reporter_user_id: report.reporter_user_id,
					admin_user_id: admin.id,
					report_id: report.id,
					message: adminNote,
				},
			});
		}

		const updated = await (database.prisma.reports as any).update({
			where: { id: report.id },
			data: {
				status: nextStatus,
				action_type: actionType,
				action_expires_at: actionExpiresAt,
				admin_note: adminNote,
				resolved_at:
					nextStatus === "dismissed" || nextStatus === "actioned"
						? new Date()
						: null,
				resolved_by_user_id:
					nextStatus === "dismissed" || nextStatus === "actioned"
						? admin.id
						: null,
			},
		});

		await createAuditLog(database, {
			actorUserId: admin.id,
			targetUserId: target.id,
			action: `admin.report.${action}`,
			reason: adminNote,
			metadata: {
				reportId: updated.id,
				matchId: report.match_id ?? null,
			},
		});

		if (action === "warning" || action === "temporary_ban" || action === "permanent_ban") {
			await createUserNotification(database, {
				userId: target.id,
				type: action,
				title:
					action === "warning"
						? "Account warning"
						: action === "temporary_ban"
							? "Temporary suspension"
							: "Permanent suspension",
				message: targetNotificationMessage,
				data: {
					reportId: updated.id,
					expiresAt: actionExpiresAt?.toISOString() ?? null,
				},
			});
			if (target.email) {
				await queueEmailOutbox(database, {
					userId: target.id,
					email: target.email,
					template: action,
					subject:
						action === "warning"
							? "Creature Chess account warning"
							: action === "temporary_ban"
								? "Creature Chess temporary suspension"
								: "Creature Chess permanent suspension",
					data: {
						reason: adminNote,
						expiresAt: actionExpiresAt?.toISOString() ?? null,
					},
				});
			}
		}

		if (reporter) {
			await createUserNotification(database, {
				userId: reporter.id,
				type: "report_feedback",
				title: "Report updated",
				message: reporterFeedbackMessage,
				data: {
					reportId: updated.id,
					status: nextStatus,
					actionType,
				},
			});
			if (reporter.email) {
				await queueEmailOutbox(database, {
					userId: reporter.id,
					email: reporter.email,
					template: "report_feedback",
					subject: "Creature Chess report update",
					data: {
						reportId: updated.id,
						status: nextStatus,
						actionType,
					},
				});
			}
		} else {
			await createAuditLog(database, {
				actorUserId: admin.id,
				action: "admin.report.reporter_missing",
				metadata: { reportId: updated.id },
			});
		}

		if (action === "temporary_ban" || action === "permanent_ban") {
			await publishForceLogout(target.id, adminNote, actionExpiresAt?.toISOString() ?? null);
		}

		return res.status(200).json({
			report: {
				id: updated.id,
				status: updated.status,
				actionType: updated.action_type ?? null,
				adminNote: updated.admin_note ?? null,
				actionExpiresAt: updated.action_expires_at?.toISOString() ?? null,
				resolvedAt: updated.resolved_at?.toISOString() ?? null,
			},
		});
		}
	);

	app.get("/bots", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.bot_management
		);
		if (!admin) {
			return;
		}
		const bots = await (database.prisma.bots as any).findMany({
			orderBy: { nickname: "asc" },
		});
		return res.status(200).json({ bots });
	});

	app.patch(
		"/bots/:id",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-bot-update",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.bot_management
		);
		if (!admin) {
			return;
		}
		const current = await (database.prisma.bots as any).findUnique({
			where: { id: req.params.id },
		});
		if (!current) {
			return res.status(404).json({ message: "Bot not found" });
		}
		const nextValue = (value: unknown, fallback: number) =>
			Math.max(1, Math.min(200, Number.isFinite(Number(value)) ? Number(value) : fallback));
		const bot = await (database.prisma.bots as any).update({
			where: { id: current.id },
			data: {
				ambition: nextValue(req.body?.ambition, current.ambition),
				composure: nextValue(req.body?.composure, current.composure),
				vision: nextValue(req.body?.vision, current.vision),
			},
		});
		return res.status(200).json({ bot });
		}
	);


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

	function generateSlug(name: string) {
		return name
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) + "-" + randomBytes(4).toString("hex");
	}

	app.get("/events", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.event_management
		);
		if (!admin) {
			return;
		}
		const events = await (database.prisma.game_events as any).findMany({
			orderBy: [{ status: "asc" }, { starts_at: "desc" }],
			take: 80,
		});
		return res.status(200).json({
			events: events.map(serializeEvent),
		});
	});

	app.post(
		"/events",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-event-create",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.event_management
		);
		if (!admin) {
			return;
		}
		const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
		const status = req.body?.status || "draft";
		if (!name) {
			return res.status(400).json({ message: "Event name is required" });
		}
		if (!EVENT_STATUSES.has(status)) {
			return res.status(400).json({ message: "Invalid event status" });
		}
		const slug = generateSlug(name);
		const event = await (database.prisma.game_events as any).create({
			data: {
				name: name.slice(0, 80),
				description: typeof req.body?.description === "string"
					? req.body.description.trim().slice(0, 2000)
					: null,
				status,
				event_type: req.body?.eventType ? String(req.body.eventType).slice(0, 40) : "generic",
				starts_at: req.body?.startsAt ? new Date(req.body.startsAt) : null,
				ends_at: req.body?.endsAt ? new Date(req.body.endsAt) : null,
				banner_url: req.body?.bannerUrl ? String(req.body.bannerUrl).slice(0, 500) : null,
				theme_color: req.body?.themeColor ? String(req.body.themeColor).slice(0, 20) : null,
				page_slug: slug,
				tasks: req.body?.tasks ? JSON.stringify(req.body.tasks) : null,
				rewards: req.body?.rewards ? JSON.stringify(req.body.rewards) : null,
				config: req.body?.config ? JSON.stringify(req.body.config) : null,
				page_content: req.body?.pageContent ? JSON.stringify(req.body.pageContent) : JSON.stringify([
					{ id: "banner", type: "banner", order: 0, visible: true },
					{ id: "countdown", type: "countdown", order: 1, visible: true },
					{ id: "description", type: "description", order: 2, visible: true },
					{ id: "tasks", type: "tasks", order: 3, visible: true },
					{ id: "rewards", type: "rewards", order: 4, visible: true },
				]),
			},
		});
		await createAuditLog(database, {
			actorUserId: admin.id,
			action: "admin.event.created",
			metadata: { eventId: event.id, name: event.name, status: event.status },
		});
		return res.status(201).json({ event: serializeEvent(event) });
		}
	);

	app.patch(
		"/events/:id",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_MUTATION_RATE_LIMIT,
			prefix: "admin-event-update",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.event_management
		);
		if (!admin) {
			return;
		}
		const data: Record<string, unknown> = {};
		if (req.body?.name !== undefined) {
			const name = String(req.body.name).trim();
			if (!name) {
				return res.status(400).json({ message: "Event name is required" });
			}
			data.name = name.slice(0, 80);
		}
		if (req.body?.description !== undefined) {
			data.description = String(req.body.description).trim().slice(0, 2000);
		}
		if (req.body?.status !== undefined) {
			if (!EVENT_STATUSES.has(req.body.status)) {
				return res.status(400).json({ message: "Invalid event status" });
			}
			data.status = req.body.status;
		}
		if (req.body?.startsAt !== undefined) {
			data.starts_at = req.body.startsAt ? new Date(req.body.startsAt) : null;
		}
		if (req.body?.endsAt !== undefined) {
			data.ends_at = req.body.endsAt ? new Date(req.body.endsAt) : null;
		}
		if (req.body?.bannerUrl !== undefined) {
			data.banner_url = req.body.bannerUrl ? String(req.body.bannerUrl).slice(0, 500) : null;
		}
		if (req.body?.themeColor !== undefined) {
			data.theme_color = req.body.themeColor ? String(req.body.themeColor).slice(0, 20) : null;
		}
		if (req.body?.eventType !== undefined) {
			data.event_type = req.body.eventType ? String(req.body.eventType).slice(0, 40) : "generic";
		}
		if (req.body?.config !== undefined) {
			data.config = req.body.config ? JSON.stringify(req.body.config) : null;
		}
		if (req.body?.tasks !== undefined) {
			data.tasks = JSON.stringify(req.body.tasks);
		}
		if (req.body?.rewards !== undefined) {
			data.rewards = JSON.stringify(req.body.rewards);
		}
		if (req.body?.pageContent !== undefined) {
			data.page_content = JSON.stringify(req.body.pageContent);
		}
		const event = await (database.prisma.game_events as any).update({
			where: { id: req.params.id },
			data,
		});
		await createAuditLog(database, {
			actorUserId: admin.id,
			action: "admin.event.updated",
			metadata: { eventId: event.id, fields: Object.keys(data) },
		});
		return res.status(200).json({ event: serializeEvent(event) });
		}
	);

	// DELETE /events/:id — remove event
	app.delete(
		"/events/:id",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 30, prefix: "admin-event-delete", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.event_management);
			if (!admin) return;
			await (database.prisma.game_events as any).delete({ where: { id: req.params.id } });
			await createAuditLog(database, { actorUserId: admin.id, action: "admin.event.deleted", metadata: { eventId: req.params.id } });
			return res.status(200).json({ success: true });
		}
	);

	// POST /events/:id/broadcast — send notification to all users about this event
	app.post(
		"/events/:id/broadcast",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 10, prefix: "admin-event-broadcast", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.event_management);
			if (!admin) return;
			const event = await (database.prisma.game_events as any).findFirst({ where: { id: req.params.id } });
			if (!event) return res.status(404).json({ message: "Event not found" });

			// get all users
			const users = await (database.prisma.users as any).findMany({
				where: { locked_at: null },
				select: { id: true },
				take: 5000,
			});

			let sent = 0;
			const batchSize = 100;
			for (let i = 0; i < users.length; i += batchSize) {
				const batch = users.slice(i, i + batchSize);
				await Promise.all(batch.map((u: any) =>
					createUserNotification(database, {
						userId: u.id,
						type: "game_event",
						title: `🎉 Sự kiện mới: ${event.name}`,
						message: event.description ? event.description.slice(0, 200) : "Một sự kiện mới đã bắt đầu! Tham gia ngay.",
						data: { eventId: event.id, pageSlug: event.page_slug, type: "game_event" },
					}).catch(() => undefined)
				));
				sent += batch.length;
			}

			await forceLogoutPublisher.publish("admin:moderation", {
				type: "system_notification",
				payload: {
					id: `event-${event.id}`,
					message: event.description ? event.description.slice(0, 200) : "Một sự kiện mới đã bắt đầu! Tham gia ngay.",
					data: { eventId: event.id, pageSlug: event.page_slug, type: "game_event" }
				}
			});

			await createAuditLog(database, {
				actorUserId: admin.id,
				action: "admin.event.broadcast",
				metadata: { eventId: event.id, sent },
			});
			return res.status(200).json({ success: true, sent });
		}
	);


	// GET /currencies — admin list user currencies
	app.get(
		"/currencies",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 60, prefix: "admin-currencies", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;
			const currencies = await (database.prisma as any).user_currencies?.findMany?.({
				take: 200,
				orderBy: { updated_at: "desc" },
			}) ?? [];
			return res.status(200).json({
				currencies: currencies.map((c: any) => ({
					userId: c.user_id,
					gold: c.gold,
					gems: c.gems,
					tickets: c.tickets,
				})),
			});
		}
	);

	// PATCH /currencies/:userId — admin adjust user currency
	app.patch(
		"/currencies/:userId",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 120, prefix: "admin-currency-update", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;
			const { userId } = req.params;
			const { gold, gems, tickets } = req.body || {};
			const data: Record<string, number> = {};
			if (typeof gold === "number") data.gold = Math.max(0, gold);
			if (typeof gems === "number") data.gems = Math.max(0, gems);
			if (typeof tickets === "number") data.tickets = Math.max(0, tickets);
			const currency = await (database.prisma as any).user_currencies?.upsert?.({
				where: { user_id: userId },
				create: { user_id: userId, ...data },
				update: data,
			}) ?? { user_id: userId, gold: data.gold ?? 0, gems: data.gems ?? 0, tickets: data.tickets ?? 0 };
			await createAuditLog(database, {
				actorUserId: admin.id,
				targetUserId: userId,
				action: "admin.currency.updated",
				metadata: data,
			});
			return res.status(200).json({ currency: { userId: currency.user_id, gold: currency.gold, gems: currency.gems, tickets: currency.tickets } });
		}
	);



	app.get("/monitoring", async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.server_monitoring
		);
		if (!admin) {
			return;
		}
		const { from, to, range } = parseRangeWindow(req);
		const snapshots = await ((database.prisma as any).monitoring_snapshots as any).findMany({
			where: {
				captured_at: {
					gte: from,
					lte: to,
				},
			},
			orderBy: { captured_at: "asc" },
			take: 500,
		});
		const latest = snapshots[snapshots.length - 1] ?? null;
		const alerts = latest
			? [
					latest.cpu_percent !== null && latest.cpu_percent > 80
						? { level: latest.cpu_percent > 95 ? "critical" : "warning", metric: "cpu", message: `CPU usage ${latest.cpu_percent}%` }
						: null,
					latest.heap_used_mb > 1536
						? {
								level: latest.heap_used_mb > 2048 ? "critical" : "warning",
								metric: "memory",
								message: `Heap usage ${latest.heap_used_mb} MB`,
						  }
						: null,
					latest.api_5xx > 10
						? {
								level: latest.api_5xx > 50 ? "critical" : "warning",
								metric: "errors",
								message: `5xx errors ${latest.api_5xx} in latest interval`,
						  }
						: null,
			  ].filter(Boolean)
			: [];

		return res.status(200).json({
			status: "online",
			databaseStatus: latest?.database_status ?? "unknown",
			range,
			uptimeSeconds: Math.round(process.uptime()),
			nodeVersion: process.version,
			checkedAt: new Date().toISOString(),
			services: latest
				? {
						api: latest.api_server_status,
						game: latest.game_server_status,
						rag: latest.rag_service_status,
						database: latest.database_status,
						redis: latest.redis_status,
				  }
				: {
						api: "unknown",
						game: "unknown",
						rag: "unknown",
						database: "unknown",
						redis: "unknown",
				  },
			summary: latest
				? {
						cpuPercent: latest.cpu_percent ?? null,
						rssMb: latest.rss_mb,
						heapUsedMb: latest.heap_used_mb,
						dbLatencyMs: latest.db_latency_ms ?? null,
						averageRequestMs: latest.average_request_ms ?? null,
						apiRequests: latest.api_requests,
						api4xx: latest.api_4xx,
						api5xx: latest.api_5xx,
						errorCount: latest.error_count,
						socketConnections: latest.socket_connections,
				  }
				: null,
			game: latest
				? {
						activePlayers: latest.active_players,
						playersOnline: Math.max(
							0,
							latest.active_players - latest.players_in_room - latest.players_in_game
						),
						playersInRoom: latest.players_in_room,
						playersInGame: latest.players_in_game,
						activeRooms: latest.active_rooms,
						activeGames: latest.active_games,
				  }
				: null,
			moderation: latest
				? {
						openReports: latest.open_reports,
						lockedUsers: latest.locked_users,
				  }
				: null,
			history: snapshots.map((item: any) => ({
				capturedAt: item.captured_at.toISOString(),
				cpuPercent: item.cpu_percent ?? null,
				rssMb: item.rss_mb,
				heapUsedMb: item.heap_used_mb,
				dbLatencyMs: item.db_latency_ms ?? null,
				averageRequestMs: item.average_request_ms ?? null,
				apiRequests: item.api_requests,
				api4xx: item.api_4xx,
				api5xx: item.api_5xx,
				errorCount: item.error_count,
				socketConnections: item.socket_connections,
				activePlayers: item.active_players,
				playersInRoom: item.players_in_room,
				playersInGame: item.players_in_game,
				activeRooms: item.active_rooms,
				activeGames: item.active_games,
				openReports: item.open_reports,
				lockedUsers: item.locked_users,
			})),
			alerts,
			logs: getRecentLogEntries({
				limit: 100,
				level:
					typeof req.query.logLevel === "string"
						? (req.query.logLevel as "all" | "info" | "warn" | "error")
						: "all",
			}),
		});
	});

	app.get(
		"/monitoring/export",
		rateLimit({
			windowMs: RATE_LIMIT_WINDOW_MS,
			max: ADMIN_EXPORT_RATE_LIMIT,
			prefix: "admin-monitoring-export",
			keyBuilder: getAdminRateLimitActorKey,
		}),
		async (req, res) => {
		const admin = await requireAdminPermission(
			req,
			res,
			database,
			ADMIN_PERMISSIONS.server_monitoring
		);
		if (!admin) {
			return;
		}
		const { from, to } = parseRangeWindow(req);
		const format = req.query.format === "json" ? "json" : "csv";
		const snapshots = await ((database.prisma as any).monitoring_snapshots as any).findMany({
			where: {
				captured_at: {
					gte: from,
					lte: to,
				},
			},
			orderBy: { captured_at: "asc" },
			take: 2000,
		});

		if (format === "json") {
			return res.status(200).json({
				items: snapshots.map((item: any) => ({
					capturedAt: item.captured_at.toISOString(),
					cpuPercent: item.cpu_percent ?? null,
					rssMb: item.rss_mb,
					heapUsedMb: item.heap_used_mb,
					dbLatencyMs: item.db_latency_ms ?? null,
					averageRequestMs: item.average_request_ms ?? null,
					apiRequests: item.api_requests,
					api4xx: item.api_4xx,
					api5xx: item.api_5xx,
					errorCount: item.error_count,
					socketConnections: item.socket_connections,
					activePlayers: item.active_players,
					playersInRoom: item.players_in_room,
					playersInGame: item.players_in_game,
					activeRooms: item.active_rooms,
					activeGames: item.active_games,
					openReports: item.open_reports,
					lockedUsers: item.locked_users,
				})),
			});
		}

		const csv = [
			toCsvRow([
				"capturedAt",
				"cpuPercent",
				"rssMb",
				"heapUsedMb",
				"dbLatencyMs",
				"averageRequestMs",
				"apiRequests",
				"api4xx",
				"api5xx",
				"errorCount",
				"socketConnections",
				"activePlayers",
				"playersInRoom",
				"playersInGame",
				"activeRooms",
				"activeGames",
				"openReports",
				"lockedUsers",
			]),
			...snapshots.map((item: any) =>
				toCsvRow([
					item.captured_at.toISOString(),
					item.cpu_percent ?? null,
					item.rss_mb,
					item.heap_used_mb,
					item.db_latency_ms ?? null,
					item.average_request_ms ?? null,
					item.api_requests,
					item.api_4xx,
					item.api_5xx,
					item.error_count,
					item.socket_connections,
					item.active_players,
					item.players_in_room,
					item.players_in_game,
					item.active_rooms,
					item.active_games,
					item.open_reports,
					item.locked_users,
				])
			),
		].join("\n");

		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader(
			"Content-Disposition",
			'attachment; filename="admin-monitoring.csv"'
		);
		return res.status(200).send(csv);
		}
	);

	// ======================================================
	// AI Coach Subscription / Payment Admin Routes
	// ======================================================

	const AI_COACH_PLAN_DEFS: Record<string, { name: string; queries: number; positioning: number; build: number; battleAnalysis: number }> = {
		free: { name: "Free", queries: 5, positioning: 3, build: 2, battleAnalysis: 1 },
		basic: { name: "Basic", queries: 30, positioning: 20, build: 15, battleAnalysis: 10 },
		pro: { name: "Pro", queries: 100, positioning: 60, build: 50, battleAnalysis: 30 },
		unlimited: { name: "Unlimited", queries: 999999, positioning: 999999, build: 999999, battleAnalysis: 999999 },
	};

	// GET /subscriptions — list all subscriptions with user info
	app.get(
		"/subscriptions",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 120, prefix: "admin-sub-list", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;

			const plan = typeof req.query.plan === "string" ? req.query.plan : undefined;
			const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

			const where: any = {};
			if (plan && plan !== "all") {
				where.plan = plan;
			}

			const subscriptions = await (database.prisma as any).ai_coach_subscriptions.findMany({
				where,
				orderBy: { updated_at: "desc" },
				take: 200,
			});

			// Enrich with user info
			const userIds = subscriptions.map((s: any) => s.user_id);
			const users = userIds.length > 0 ? await (database.prisma.users as any).findMany({
				where: { id: { in: userIds } },
				select: { id: true, nickname: true, email: true },
			}) : [];
			const userMap = new Map(users.map((u: any) => [u.id, u]));

			let enriched = subscriptions.map((s: any) => {
				const user: any = userMap.get(s.user_id);
				return {
					id: s.id,
					userId: s.user_id,
					userNickname: user?.nickname || null,
					userEmail: user?.email || null,
					plan: s.plan,
					planName: AI_COACH_PLAN_DEFS[s.plan]?.name || s.plan,
					queriesUsed: s.queries_used,
					queriesLimit: s.queries_limit,
					positioningUsed: s.positioning_used,
					positioningLimit: s.positioning_limit,
					buildUsed: s.build_used,
					buildLimit: s.build_limit,
					battleAnalysisUsed: s.battle_analysis_used,
					battleAnalysisLimit: s.battle_analysis_limit,
					periodStart: s.period_start,
					periodEnd: s.period_end,
					activatedAt: s.activated_at,
					updatedAt: s.updated_at,
				};
			});

			if (q) {
				const lower = q.toLowerCase();
				enriched = enriched.filter((item: any) =>
					(item.userNickname || "").toLowerCase().includes(lower) ||
					(item.userEmail || "").toLowerCase().includes(lower) ||
					item.userId.toLowerCase().includes(lower)
				);
			}

			// Stats
			const totalByPlan: Record<string, number> = {};
			for (const s of subscriptions) {
				totalByPlan[s.plan] = (totalByPlan[s.plan] || 0) + 1;
			}

			return res.status(200).json({
				subscriptions: enriched,
				stats: { totalByPlan, total: subscriptions.length },
			});
		}
	);

	// GET /payments — list all payments
	app.get(
		"/payments",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 120, prefix: "admin-pay-list", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;

			const status = typeof req.query.status === "string" ? req.query.status : undefined;
			const plan = typeof req.query.plan === "string" ? req.query.plan : undefined;
			const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

			const where: any = {};
			if (status && status !== "all") {
				where.status = status;
			}
			if (plan && plan !== "all") {
				where.plan = plan;
			}

			const payments = await (database.prisma as any).ai_coach_payments.findMany({
				where,
				orderBy: { created_at: "desc" },
				take: 200,
			});

			const userIds = [...new Set(payments.map((p: any) => p.user_id))];
			const users = userIds.length > 0 ? await (database.prisma.users as any).findMany({
				where: { id: { in: userIds } },
				select: { id: true, nickname: true, email: true },
			}) : [];
			const userMap = new Map(users.map((u: any) => [u.id, u]));

			let enriched = payments.map((p: any) => {
				const user: any = userMap.get(p.user_id);
				return {
					id: p.id,
					userId: p.user_id,
					userNickname: user?.nickname || null,
					userEmail: user?.email || null,
					paypalOrderId: p.paypal_order_id,
					plan: p.plan,
					planName: AI_COACH_PLAN_DEFS[p.plan]?.name || p.plan,
					amountUsd: p.amount_usd,
					amountVnd: p.amount_vnd,
					currency: p.currency,
					status: p.status,
					payerEmail: p.payer_email,
					payerName: p.payer_name,
					paypalCaptureId: p.paypal_capture_id,
					errorMessage: p.error_message,
					createdAt: p.created_at,
					updatedAt: p.updated_at,
				};
			});

			if (q) {
				const lower = q.toLowerCase();
				enriched = enriched.filter((item: any) =>
					(item.userNickname || "").toLowerCase().includes(lower) ||
					(item.userEmail || "").toLowerCase().includes(lower) ||
					(item.payerEmail || "").toLowerCase().includes(lower) ||
					item.userId.toLowerCase().includes(lower) ||
					item.paypalOrderId.toLowerCase().includes(lower)
				);
			}

			// Revenue stats
			const completedPayments = payments.filter((p: any) => p.status === "completed");
			const totalRevenue = completedPayments.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0);

			return res.status(200).json({
				payments: enriched,
				stats: {
					total: payments.length,
					completed: completedPayments.length,
					pending: payments.filter((p: any) => p.status === "pending").length,
					failed: payments.filter((p: any) => p.status === "failed").length,
					totalRevenueUsd: Math.round(totalRevenue * 100) / 100,
				},
			});
		}
	);

	// PATCH /subscriptions/:userId — admin manually change a user's plan
	app.patch(
		"/subscriptions/:userId",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: ADMIN_MUTATION_RATE_LIMIT, prefix: "admin-sub-update", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;

			const { userId } = req.params;
			const { plan } = req.body as { plan?: string };

			if (!plan || !AI_COACH_PLAN_DEFS[plan]) {
				return res.status(400).json({ message: "Invalid plan" });
			}

			const planDef = AI_COACH_PLAN_DEFS[plan];
			const now = new Date();
			const periodEnd = plan === "free" ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

			await (database.prisma as any).ai_coach_subscriptions.upsert({
				where: { user_id: userId },
				update: {
					plan,
					queries_used: 0,
					queries_limit: planDef.queries,
					positioning_used: 0,
					positioning_limit: planDef.positioning,
					build_used: 0,
					build_limit: planDef.build,
					battle_analysis_used: 0,
					battle_analysis_limit: planDef.battleAnalysis,
					period_start: now,
					period_end: periodEnd,
					activated_at: now,
				},
				create: {
					user_id: userId,
					plan,
					queries_limit: planDef.queries,
					positioning_limit: planDef.positioning,
					build_limit: planDef.build,
					battle_analysis_limit: planDef.battleAnalysis,
					period_start: now,
					period_end: periodEnd,
					activated_at: now,
				},
			});

			await createAuditLog(database, {
				actorUserId: admin.id,
				targetUserId: userId,
				action: "admin.subscription.changed",
				metadata: { plan },
			});

			await createUserNotification(database, {
				userId,
				type: "subscription_changed",
				title: "AI Coach plan changed",
				message: `An admin changed your AI Coach plan to ${planDef.name}.`,
			});

			return res.status(200).json({ success: true, plan, planName: planDef.name });
		}
	);

	// POST /payments/:paymentId/refund — mark a payment as refunded
	app.post(
		"/payments/:paymentId/refund",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: ADMIN_MUTATION_RATE_LIMIT, prefix: "admin-pay-refund", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;

			const { paymentId } = req.params;
			const payment = await (database.prisma as any).ai_coach_payments.findUnique({ where: { id: paymentId } });
			if (!payment) {
				return res.status(404).json({ message: "Payment not found" });
			}

			await (database.prisma as any).ai_coach_payments.update({
				where: { id: paymentId },
				data: { status: "refunded" },
			});

			// Downgrade user to free
			const freeDef = AI_COACH_PLAN_DEFS.free;
			await (database.prisma as any).ai_coach_subscriptions.updateMany({
				where: { user_id: payment.user_id },
				data: {
					plan: "free",
					queries_limit: freeDef.queries,
					positioning_limit: freeDef.positioning,
					build_limit: freeDef.build,
					battle_analysis_limit: freeDef.battleAnalysis,
					period_end: null,
				},
			});

			await createAuditLog(database, {
				actorUserId: admin.id,
				targetUserId: payment.user_id,
				action: "admin.payment.refunded",
				metadata: { paymentId, plan: payment.plan, amountUsd: payment.amount_usd },
			});

			await createUserNotification(database, {
				userId: payment.user_id,
				type: "payment_refunded",
				title: "Payment Refunded",
				message: `Your payment of $${payment.amount_usd} for ${AI_COACH_PLAN_DEFS[payment.plan]?.name || payment.plan} plan has been refunded.`,
			});

			return res.status(200).json({ success: true });
		}
	);

	await processExpiredLocks();

	// GET /revenue/report — aggregate revenue by day/month/year
	app.get(
		"/revenue/report",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: 120, prefix: "admin-rev-report", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const admin = await requireAdminPermission(req, res, database, ADMIN_PERMISSIONS.user_management);
			if (!admin) return;

			const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : "day";
			const from = typeof req.query.from === "string" ? req.query.from : undefined;
			const to = typeof req.query.to === "string" ? req.query.to : undefined;

			const where: any = { status: "completed" };
			if (from || to) {
				where.created_at = {};
				if (from) where.created_at.gte = new Date(from);
				if (to) where.created_at.lte = new Date(to + "T23:59:59.999Z");
			}

			const payments = await (database.prisma as any).ai_coach_payments.findMany({
				where,
				orderBy: { created_at: "asc" },
			});

			const buckets = new Map<string, { period: string; count: number; totalUsd: number; totalVnd: number; plans: Record<string, number> }>();

			for (const p of payments) {
				const d = new Date(p.created_at);
				let key: string;
				if (groupBy === "month") {
					key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				} else if (groupBy === "year") {
					key = `${d.getFullYear()}`;
				} else {
					key = d.toISOString().slice(0, 10);
				}

				let bucket = buckets.get(key);
				if (!bucket) {
					bucket = { period: key, count: 0, totalUsd: 0, totalVnd: 0, plans: {} };
					buckets.set(key, bucket);
				}
				bucket.count += 1;
				bucket.totalUsd += p.amount_usd || 0;
				bucket.totalVnd += p.amount_vnd || 0;
				bucket.plans[p.plan] = (bucket.plans[p.plan] || 0) + 1;
			}

			const rows = Array.from(buckets.values()).map(b => ({
				...b,
				totalUsd: Math.round(b.totalUsd * 100) / 100,
				totalVnd: Math.round(b.totalVnd),
			}));

			const grandTotalUsd = Math.round(payments.reduce((s: number, p: any) => s + (p.amount_usd || 0), 0) * 100) / 100;
			const grandTotalVnd = Math.round(payments.reduce((s: number, p: any) => s + (p.amount_vnd || 0), 0));

			return res.status(200).json({
				groupBy,
				from: from || null,
				to: to || null,
				rows,
				summary: {
					totalPayments: payments.length,
					totalUsd: grandTotalUsd,
					totalVnd: grandTotalVnd,
				},
			});
		}
	);

	// GET /revenue/export — export revenue report as CSV
	app.get(
		"/revenue/export",
		rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: ADMIN_MUTATION_RATE_LIMIT, prefix: "admin-rev-export", keyBuilder: getAdminRateLimitActorKey }),
		async (req, res) => {
			const token = typeof req.query.token === "string" ? req.query.token : parseAuthorizationToken(req.headers.authorization as string | undefined);
			if (!token) {
				return res.status(401).json({ message: "Admin authentication required" });
			}
			const user = await authenticateAdminToken(database, token);
			if (!user || !isAdminUser(user)) {
				return res.status(403).json({ message: "Admin access required" });
			}

			const groupBy = typeof req.query.groupBy === "string" ? req.query.groupBy : "day";
			const from = typeof req.query.from === "string" ? req.query.from : undefined;
			const to = typeof req.query.to === "string" ? req.query.to : undefined;

			const where: any = { status: "completed" };
			if (from || to) {
				where.created_at = {};
				if (from) where.created_at.gte = new Date(from);
				if (to) where.created_at.lte = new Date(to + "T23:59:59.999Z");
			}

			const payments = await (database.prisma as any).ai_coach_payments.findMany({
				where,
				orderBy: { created_at: "asc" },
			});

			const buckets = new Map<string, { period: string; count: number; totalUsd: number; totalVnd: number }>();
			for (const p of payments) {
				const d = new Date(p.created_at);
				let key: string;
				if (groupBy === "month") {
					key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
				} else if (groupBy === "year") {
					key = `${d.getFullYear()}`;
				} else {
					key = d.toISOString().slice(0, 10);
				}
				let bucket = buckets.get(key);
				if (!bucket) {
					bucket = { period: key, count: 0, totalUsd: 0, totalVnd: 0 };
					buckets.set(key, bucket);
				}
				bucket.count += 1;
				bucket.totalUsd += p.amount_usd || 0;
				bucket.totalVnd += p.amount_vnd || 0;
			}

			const rows = Array.from(buckets.values());
			const csv = [
				toCsvRow(["Period", "Transactions", "Revenue (USD)", "Revenue (VND)"]),
				...rows.map(r =>
					toCsvRow([r.period, r.count, Math.round(r.totalUsd * 100) / 100, Math.round(r.totalVnd)])
				),
			].join("\n");

			res.setHeader("Content-Type", "text/csv; charset=utf-8");
			res.setHeader("Content-Disposition", `attachment; filename="revenue-report-${groupBy}.csv"`);
			return res.status(200).send(csv);
		}
	);

	await captureMonitoringSnapshot();
	setInterval(() => {
		processExpiredLocks().catch((error) =>
			logger.error("Failed to process expired locks", error)
		);
	}, 5 * 60 * 1000);
	setInterval(() => {
		captureMonitoringSnapshot().catch((error) =>
			logger.error("Failed to capture monitoring snapshot", error)
		);
	}, 60 * 1000);

	app.listen(PORT, "0.0.0.0", () => {
		logger.info(`Admin server listening on port ${PORT}`);
	});
}

startServer().catch((error) => {
	logger.error("Failed to start admin server", error);
	process.exit(1);
});
