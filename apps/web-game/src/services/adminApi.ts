import { apiFetch } from "./api";

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
	};
};

export type AdminUser = {
	id: string;
	email: string | null;
	nickname: string | null;
	profilePicture: number | null;
	personalInfo: string | null;
	role: "player" | "admin";
	locked: boolean;
	lockedReason: string | null;
	gamesPlayed: number;
	wins: number;
};

export type AdminReport = {
	id: string;
	reason: string;
	status: "open" | "reviewing" | "resolved" | "dismissed";
	adminNote: string | null;
	matchId: string | null;
	createdAt: string;
	resolvedAt: string | null;
	reporter: { id: string; nickname: string };
	target: { id: string; nickname: string; locked: boolean };
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

export type AdminServerStatus = {
	status: string;
	databaseStatus: "ok" | "error";
	uptimeSeconds: number;
	memory: {
		rssMb: number;
		heapTotalMb: number;
		heapUsedMb: number;
	};
	cpu: {
		user: number;
		system: number;
	};
	nodeVersion: string;
	checkedAt: string;
};

export type AdminEvent = {
	id: string;
	name: string;
	description: string;
	status: "draft" | "scheduled" | "active" | "ended";
	startsAt: string | null;
	endsAt: string | null;
};

export const fetchAdminOverview = (token: string) =>
	apiFetch<AdminOverview>("/admin/overview", { method: "GET" }, token);

export const fetchAdminServerStatus = (token: string) =>
	apiFetch<AdminServerStatus>("/admin/server", { method: "GET" }, token);

export const fetchAdminUsers = (token: string, query = "") =>
	apiFetch<{ users: AdminUser[] }>(
		`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`,
		{ method: "GET" },
		token
	);

export const updateAdminUser = (
	token: string,
	userId: string,
	payload: {
		nickname?: string;
		picture?: number;
		personalInfo?: string | null;
		role?: "player" | "admin";
	}
) =>
	apiFetch(
		`/admin/users/${userId}`,
		{
			method: "PATCH",
			body: JSON.stringify(payload),
		},
		token
	);

export const lockAdminUser = (token: string, userId: string, reason: string) =>
	apiFetch(
		`/admin/users/${userId}/lock`,
		{
			method: "POST",
			body: JSON.stringify({ reason }),
		},
		token
	);

export const unlockAdminUser = (token: string, userId: string) =>
	apiFetch(`/admin/users/${userId}/unlock`, { method: "POST" }, token);

export const fetchAdminReports = (token: string, status?: string) =>
	apiFetch<{ reports: AdminReport[] }>(
		`/admin/reports${status ? `?status=${encodeURIComponent(status)}` : ""}`,
		{ method: "GET" },
		token
	);

export const updateAdminReport = (
	token: string,
	reportId: string,
	payload: {
		status: AdminReport["status"];
		adminNote?: string;
	}
) =>
	apiFetch(
		`/admin/reports/${reportId}`,
		{
			method: "PATCH",
			body: JSON.stringify(payload),
		},
		token
	);

export const fetchAdminBots = (token: string) =>
	apiFetch<{ bots: AdminBot[] }>("/admin/bots", { method: "GET" }, token);

export const updateAdminBot = (
	token: string,
	botId: string,
	payload: Pick<AdminBot, "ambition" | "composure" | "vision">
) =>
	apiFetch(
		`/admin/bots/${botId}`,
		{
			method: "PATCH",
			body: JSON.stringify(payload),
		},
		token
	);

export const fetchAdminEvents = (token: string) =>
	apiFetch<{ events: AdminEvent[] }>("/admin/events", { method: "GET" }, token);

export const createAdminEvent = (
	token: string,
	payload: Omit<AdminEvent, "id">
) =>
	apiFetch(
		"/admin/events",
		{
			method: "POST",
			body: JSON.stringify(payload),
		},
		token
	);

export const updateAdminEvent = (
	token: string,
	eventId: string,
	payload: Partial<Omit<AdminEvent, "id">>
) =>
	apiFetch(
		`/admin/events/${eventId}`,
		{
			method: "PATCH",
			body: JSON.stringify(payload),
		},
		token
	);
