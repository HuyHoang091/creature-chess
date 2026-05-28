export type AdminPermission =
	| "user_management"
	| "report_management"
	| "server_monitoring"
	| "bot_management"
	| "event_management"
	| "admin_permissions";

export type AdminSessionUser = {
	id: string;
	email: string | null;
	nickname: string | null;
	role: "admin";
	permissions: AdminPermission[];
	canGrantAdminPermissions: boolean;
};

export type AdminOverview = {
	users: number;
	lockedUsers: number;
	matches: number;
	openReports: number;
	bots: number;
	activeEvents: number;
	server: {
		uptimeSeconds: number;
		memoryMb: number;
		heapUsedMb: number;
		nodeVersion: string;
		adminUserId: string;
		activePlayers: number;
		playersInRoom: number;
		playersInGame: number;
	};
};

export type AdminUserListItem = {
	id: string;
	email: string | null;
	nickname: string | null;
	profilePicture: number | null;
	personalInfo: string | null;
	role: "player" | "admin";
	locked: boolean;
	lockedReason: string | null;
	lockedUntil: string | null;
	warningCount: number;
	gamesPlayed: number;
	wins: number;
	lastLoginAt: string | null;
	lastLogoutAt: string | null;
};

export type AdminUserDetail = {
	user: AdminUserListItem & {
		effectivePermissions: AdminPermission[];
		grantedPermissions: AdminPermission[];
	};
	relatedReports: {
		id: string;
		reason: string;
		status: string;
		createdAt: string;
		actionType: string | null;
	}[];
	activity: {
		id: string;
		action: string;
		reason: string | null;
		metadata: string | null;
		createdAt: string;
	}[];
	warnings: {
		id: string;
		reportId: string | null;
		message: string;
		createdAt: string;
	}[];
	recentMatches: {
		matchId: string;
		placement: number;
		endedAt: string | null;
	}[];
};

export type AdminReportListItem = {
	id: string;
	reason: string;
	description: string;
	status: "pending" | "reviewed" | "dismissed" | "actioned";
	actionType: string | null;
	actionExpiresAt: string | null;
	priority: number;
	adminNote: string | null;
	matchId: string | null;
	createdAt: string;
	resolvedAt: string | null;
	reporter: {
		id: string;
		nickname: string;
	};
	target: {
		id: string;
		nickname: string;
		locked: boolean;
		warningCount: number;
	};
};

export type AdminReportDetail = {
	report: {
		id: string;
		reason: string;
		description: string;
		status: string;
		matchId: string | null;
		createdAt: string;
		adminNote: string | null;
		actionType: string | null;
		actionExpiresAt: string | null;
		reporter: {
			id: string;
			email: string | null;
			nickname: string | null;
			gamesPlayed: number;
			wins: number;
		} | null;
		target: {
			id: string;
			email: string | null;
			nickname: string | null;
			gamesPlayed: number;
			wins: number;
			warningCount: number;
			locked: boolean;
			lockedUntil: string | null;
		} | null;
	};
	targetReportHistory: {
		id: string;
		reason: string;
		status: string;
		createdAt: string;
		actionType: string | null;
	}[];
	reporterRecentReports: {
		id: string;
		reason: string;
		status: string;
		createdAt: string;
		targetUserId: string;
	}[];
	targetReasonPatterns: Record<string, number>;
	warnings: {
		id: string;
		message: string;
		reportId: string | null;
		createdAt: string;
	}[];
	matchParticipants: {
		userId: string | null;
		displayName: string;
		placement: number;
		isBot: boolean;
	}[];
};

export type AdminBot = {
	id: string;
	nickname: string;
	games_played: number;
	wins: number;
	ambition: number;
	composure: number;
	vision: number;
};

export type AdminEvent = {
	id: string;
	name: string;
	description: string;
	status: "draft" | "scheduled" | "active" | "ended";
	startsAt: string | null;
	endsAt: string | null;
};

export type MonitoringResponse = {
	status: string;
	databaseStatus: string;
	range: string;
	uptimeSeconds: number;
	nodeVersion: string;
	checkedAt: string;
	services: Record<string, string>;
	summary: {
		cpuPercent: number | null;
		rssMb: number;
		heapUsedMb: number;
		dbLatencyMs: number | null;
		averageRequestMs: number | null;
		apiRequests: number;
		api4xx: number;
		api5xx: number;
		errorCount: number;
		socketConnections: number;
	} | null;
	game: {
		activePlayers: number;
		playersOnline: number;
		playersInRoom: number;
		playersInGame: number;
		activeRooms: number;
		activeGames: number;
	} | null;
	moderation: {
		openReports: number;
		lockedUsers: number;
	} | null;
	history: {
		capturedAt: string;
		cpuPercent: number | null;
		rssMb: number;
		heapUsedMb: number;
		dbLatencyMs: number | null;
		averageRequestMs: number | null;
		apiRequests: number;
		api4xx: number;
		api5xx: number;
		errorCount: number;
		socketConnections: number;
		activePlayers: number;
		playersInRoom: number;
		playersInGame: number;
		activeRooms: number;
		activeGames: number;
		openReports: number;
		lockedUsers: number;
	}[];
	alerts: {
		level: "warning" | "critical";
		metric: string;
		message: string;
	}[];
	logs: {
		timestamp: string;
		level: string;
		message: string;
	}[];
};

export type AdminSubscriptionItem = {
	id: string;
	userId: string;
	userNickname: string | null;
	userEmail: string | null;
	plan: string;
	planName: string;
	queriesUsed: number;
	queriesLimit: number;
	positioningUsed: number;
	positioningLimit: number;
	buildUsed: number;
	buildLimit: number;
	battleAnalysisUsed: number;
	battleAnalysisLimit: number;
	periodStart: string;
	periodEnd: string | null;
	activatedAt: string;
	updatedAt: string;
};

export type AdminPaymentItem = {
	id: string;
	userId: string;
	userNickname: string | null;
	userEmail: string | null;
	paypalOrderId: string;
	plan: string;
	planName: string;
	amountUsd: number;
	amountVnd: number | null;
	currency: string;
	status: string;
	payerEmail: string | null;
	payerName: string | null;
	paypalCaptureId: string | null;
	errorMessage: string | null;
	createdAt: string;
	updatedAt: string;
};

export type AdminSubscriptionStats = {
	totalByPlan: Record<string, number>;
	total: number;
};

export type AdminPaymentStats = {
	total: number;
	completed: number;
	pending: number;
	failed: number;
	totalRevenueUsd: number;
};

const ADMIN_TOKEN_STORAGE_KEY = "cc-admin-token";

export const getStoredAdminToken = () => {
	try {
		return localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
	} catch (_error) {
		return null;
	}
};

export const setStoredAdminToken = (token: string | null) => {
	try {
		if (!token) {
			localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
			return;
		}
		localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
	} catch (_error) {
		// ignore storage failures
	}
};

async function adminFetch<T>(
	path: string,
	options: RequestInit = {},
	token?: string | null
) {
	const response = await fetch(`${APP_ADMIN_API_URL}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers || {}),
		},
	});
	if (!response.ok) {
		if (response.status === 204) {
			return undefined as T;
		}
		const payload = (await response.json().catch(() => null)) as
			| { message?: string }
			| null;
		throw new Error(payload?.message || `Request failed: ${response.status}`);
	}
	if (response.status === 204) {
		return undefined as T;
	}
	return (await response.json()) as T;
}

export const adminApi = {
	login: (email: string, password: string) =>
		adminFetch<{ accessToken: string; expiresAt: string; user: AdminSessionUser }>(
			"/auth/login",
			{
				method: "POST",
				body: JSON.stringify({ email, password }),
			}
		),
	logout: (token: string) =>
		adminFetch<void>("/auth/logout", { method: "POST" }, token),
	me: (token: string) =>
		adminFetch<{ user: AdminSessionUser }>("/auth/me", { method: "GET" }, token),
	overview: (token: string) =>
		adminFetch<AdminOverview>("/overview", { method: "GET" }, token),
	users: (
		token: string,
		params: { q?: string; status?: string; cursor?: string | null; limit?: number }
	) => {
		const query = new URLSearchParams();
		if (params.q) {
			query.set("q", params.q);
		}
		if (params.status) {
			query.set("status", params.status);
		}
		if (params.cursor) {
			query.set("cursor", params.cursor);
		}
		query.set("limit", String(params.limit || 50));
		return adminFetch<{ users: AdminUserListItem[]; nextCursor: string | null }>(
			`/users?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	exportUsersUrl: (token: string, q?: string) => {
		const query = new URLSearchParams();
		if (q) {
			query.set("q", q);
		}
		query.set("token", token);
		return `${APP_ADMIN_API_URL}/users/export?${query.toString()}`;
	},
	userDetail: (token: string, userId: string, activityType = "") =>
		adminFetch<AdminUserDetail>(
			`/users/${userId}${activityType ? `?activityType=${encodeURIComponent(activityType)}` : ""}`,
			{ method: "GET" },
			token
		),
	updateUser: (
		token: string,
		userId: string,
		payload: {
			nickname?: string | null;
			email?: string | null;
			picture?: number | null;
			personalInfo?: string | null;
			role?: "player" | "admin";
		}
	) =>
		adminFetch<{ user: { id: string } }>(
			`/users/${userId}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
			token
		),
	updatePermissions: (
		token: string,
		userId: string,
		permissions: AdminPermission[]
	) =>
		adminFetch<{ success: true }>(
			`/users/${userId}/permissions`,
			{
				method: "PUT",
				body: JSON.stringify({ permissions }),
			},
			token
		),
	lockUser: (
		token: string,
		userId: string,
		payload: { reason: string; mode: "temporary" | "permanent"; durationDays?: number }
	) =>
		adminFetch<{ success: true }>(
			`/users/${userId}/lock`,
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
			token
		),
	unlockUser: (token: string, userId: string) =>
		adminFetch<{ success: true }>(`/users/${userId}/unlock`, { method: "POST" }, token),
	reports: (
		token: string,
		params: {
			status?: string;
			reason?: string;
			windowDays?: number;
			sortBy?: string;
		}
	) => {
		const query = new URLSearchParams();
		if (params.status) {
			query.set("status", params.status);
		}
		if (params.reason) {
			query.set("reason", params.reason);
		}
		if (params.windowDays) {
			query.set("windowDays", String(params.windowDays));
		}
		if (params.sortBy) {
			query.set("sortBy", params.sortBy);
		}
		return adminFetch<{ reports: AdminReportListItem[] }>(
			`/reports?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	reportDetail: (token: string, reportId: string) =>
		adminFetch<AdminReportDetail>(`/reports/${reportId}`, { method: "GET" }, token),
	handleReport: (
		token: string,
		reportId: string,
		payload: { action: string; adminNote: string; durationDays?: number }
	) =>
		adminFetch<{ report: Record<string, unknown> }>(
			`/reports/${reportId}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
			token
		),
	bots: (token: string) =>
		adminFetch<{ bots: AdminBot[] }>("/bots", { method: "GET" }, token),
	updateBot: (
		token: string,
		botId: string,
		payload: Pick<AdminBot, "ambition" | "composure" | "vision">
	) =>
		adminFetch<{ bot: AdminBot }>(
			`/bots/${botId}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
			token
		),
	events: (token: string) =>
		adminFetch<{ events: AdminEvent[] }>("/events", { method: "GET" }, token),
	createEvent: (token: string, payload: Omit<AdminEvent, "id">) =>
		adminFetch<{ event: AdminEvent }>(
			"/events",
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
			token
		),
	updateEvent: (
		token: string,
		eventId: string,
		payload: Partial<Omit<AdminEvent, "id">>
	) =>
		adminFetch<{ event: AdminEvent }>(
			`/events/${eventId}`,
			{
				method: "PATCH",
				body: JSON.stringify(payload),
			},
			token
		),
	monitoring: (token: string, params: { range: string; logLevel?: string }) => {
		const query = new URLSearchParams();
		query.set("range", params.range);
		if (params.logLevel) {
			query.set("logLevel", params.logLevel);
		}
		return adminFetch<MonitoringResponse>(
			`/monitoring?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	monitoringExportUrl: (
		token: string,
		params: { range: string; format: "csv" | "json" }
	) => {
		const query = new URLSearchParams();
		query.set("range", params.range);
		query.set("format", params.format);
		query.set("token", token);
		return `${APP_ADMIN_API_URL}/monitoring/export?${query.toString()}`;
	},
	subscriptions: (token: string, params: { plan?: string; q?: string }) => {
		const query = new URLSearchParams();
		if (params.plan) query.set("plan", params.plan);
		if (params.q) query.set("q", params.q);
		return adminFetch<{ subscriptions: AdminSubscriptionItem[]; stats: AdminSubscriptionStats }>(
			`/subscriptions?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	payments: (token: string, params: { status?: string; plan?: string; q?: string }) => {
		const query = new URLSearchParams();
		if (params.status) query.set("status", params.status);
		if (params.plan) query.set("plan", params.plan);
		if (params.q) query.set("q", params.q);
		return adminFetch<{ payments: AdminPaymentItem[]; stats: AdminPaymentStats }>(
			`/payments?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	updateSubscription: (token: string, userId: string, plan: string) =>
		adminFetch<{ success: boolean; plan: string; planName: string }>(
			`/subscriptions/${userId}`,
			{ method: "PATCH", body: JSON.stringify({ plan }) },
			token
		),
	refundPayment: (token: string, paymentId: string) =>
		adminFetch<{ success: boolean }>(
			`/payments/${paymentId}/refund`,
			{ method: "POST" },
			token
		),
	revenueReport: (token: string, params: { groupBy?: string; from?: string; to?: string }) => {
		const query = new URLSearchParams();
		if (params.groupBy) query.set("groupBy", params.groupBy);
		if (params.from) query.set("from", params.from);
		if (params.to) query.set("to", params.to);
		return adminFetch<{
			groupBy: string;
			from: string | null;
			to: string | null;
			rows: { period: string; count: number; totalUsd: number; totalVnd: number; plans: Record<string, number> }[];
			summary: { totalPayments: number; totalUsd: number; totalVnd: number };
		}>(
			`/revenue/report?${query.toString()}`,
			{ method: "GET" },
			token
		);
	},
	revenueExportUrl: (token: string, params: { groupBy: string; from?: string; to?: string }) => {
		const query = new URLSearchParams();
		query.set("groupBy", params.groupBy);
		if (params.from) query.set("from", params.from);
		if (params.to) query.set("to", params.to);
		query.set("token", token);
		return `${APP_ADMIN_API_URL}/revenue/export?${query.toString()}`;
	},
};
