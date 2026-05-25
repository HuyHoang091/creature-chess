import type {
	MatchHistoryDetailDto,
	MatchHistoryResponseDto,
} from "@creature-chess/models";

import { apiFetch } from "./api";

export const fetchHistory = (
	token: string,
	options?: {
		cursor?: string | null;
		limit?: number;
		timeFilter?: "7d" | "30d" | "all";
		sortBy?: "time_desc" | "time_asc" | "placement_best" | "placement_worst";
		resultFilter?: "all" | "win" | "top4" | "loss";
	}
) => {
	const query = new URLSearchParams();
	query.set("limit", String(options?.limit ?? 20));
	if (options?.cursor) {
		query.set("cursor", options.cursor);
	}
	if (options?.timeFilter) {
		query.set("timeFilter", options.timeFilter);
	}
	if (options?.sortBy) {
		query.set("sortBy", options.sortBy);
	}
	if (options?.resultFilter) {
		query.set("resultFilter", options.resultFilter);
	}

	return apiFetch<MatchHistoryResponseDto>(
		`/matches/history?${query.toString()}`,
		{ method: "GET" },
		token
	);
};

export const fetchHistoryDetail = (token: string, matchId: string) =>
	apiFetch<MatchHistoryDetailDto>(
		`/matches/history/${encodeURIComponent(matchId)}`,
		{ method: "GET" },
		token
	);
