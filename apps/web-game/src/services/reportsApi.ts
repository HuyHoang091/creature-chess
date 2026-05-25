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
	options?: {
		matchId?: string;
		description?: string;
	}
) =>
	apiFetch(
		"/reports",
		{
			method: "POST",
			body: JSON.stringify({
				targetUserId,
				reason,
				matchId: options?.matchId,
				description: options?.description,
			}),
		},
		token
	);
