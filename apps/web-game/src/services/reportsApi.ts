import { apiFetch } from "./api";

export type ReportReason =
	| "abuse"
	| "spam"
	| "offensive_name"
	| "cheating"
	| "other";

export const reportPlayer = (
	token: string,
	targetUserId: string,
	reason: ReportReason,
	matchId?: string
) =>
	apiFetch(
		"/reports",
		{
			method: "POST",
			body: JSON.stringify({ targetUserId, reason, matchId }),
		},
		token
	);
