import type { MatchHistoryResponseDto } from "@creature-chess/models";

import { apiFetch } from "./api";

export const fetchHistory = (
	token: string,
	cursor?: string | null,
	limit = 20
) => {
	const query = new URLSearchParams();
	query.set("limit", limit.toString());
	if (cursor) {
		query.set("cursor", cursor);
	}

	return apiFetch<MatchHistoryResponseDto>(
		`/matches/history?${query.toString()}`,
		{ method: "GET" },
		token
	);
};
