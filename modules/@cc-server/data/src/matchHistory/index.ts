import { match_participants, matches, PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseMatch = matches;
export type DatabaseMatchParticipant = match_participants;

export type CreateMatchSummaryPayload = {
	mode: "public_casual" | "private_custom";
	startedAt: Date;
	endedAt: Date;
	playerCount: number;
	winnerUserId?: string | null;
	persisted?: boolean;
	participants: {
		userId?: string | null;
		guestId?: string | null;
		displayName: string;
		placement: number;
		isBot?: boolean;
		result: "win" | "top4" | "loss" | "custom";
	}[];
};

export type MatchHistoryListOptions = {
	cursor?: string;
	limit?: number;
	timeFilter?: "7d" | "30d" | "all";
	sortBy?: "time_desc" | "time_asc" | "placement_best" | "placement_worst";
	resultFilter?: "all" | "win" | "top4" | "loss";
};

export type MatchHistoryDatabaseFunctions = {
	createMatchSummary: (
		payload: CreateMatchSummaryPayload
	) => Promise<DatabaseMatch | null>;
	listForUser: (
		userId: string,
		options?: MatchHistoryListOptions
	) => Promise<
		{
			match: DatabaseMatch;
			participant: DatabaseMatchParticipant;
		}[]
	>;
	getDetailForUser: (
		userId: string,
		matchId: string
	) => Promise<{
		match: DatabaseMatch;
		participant: DatabaseMatchParticipant;
		participants: DatabaseMatchParticipant[];
	} | null>;
	hasSharedMatch: (
		reporterUserId: string,
		targetUserId: string,
		matchId?: string | null
	) => Promise<boolean>;
};

const getSinceDate = (timeFilter?: MatchHistoryListOptions["timeFilter"]) => {
	if (timeFilter === "7d") {
		return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	}
	if (timeFilter === "30d") {
		return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	}
	return null;
};

export const matchHistoryDatabase = (
	logger: Logger,
	client: PrismaClient
): MatchHistoryDatabaseFunctions => ({
	createMatchSummary: async (payload) => {
		try {
			return await client.matches
				.create({
					data: {
						mode: payload.mode,
						started_at: payload.startedAt,
						ended_at: payload.endedAt,
						player_count: payload.playerCount,
						winner_user_id: payload.winnerUserId ?? null,
						persisted: payload.persisted ?? true,
					},
				})
				.then(async (match) => {
					await client.match_participants.createMany({
						data: payload.participants.map((participant) => ({
							match_id: match.id,
							user_id: participant.userId ?? null,
							guest_id: participant.guestId ?? null,
							display_name: participant.displayName,
							placement: participant.placement,
							is_bot: participant.isBot ?? false,
							result: participant.result,
						})),
					});
					return match;
				});
		} catch (error) {
			logger.error("Failed to create match summary", error);
			return null;
		}
	},
	listForUser: async (userId, options = {}) => {
		const limit = options.limit ?? 20;
		const since = getSinceDate(options.timeFilter);
		const orderBy =
			options.sortBy === "time_asc"
				? [{ created_at: "asc" as const }]
				: options.sortBy === "placement_best"
					? [{ placement: "asc" as const }, { created_at: "desc" as const }]
					: options.sortBy === "placement_worst"
						? [{ placement: "desc" as const }, { created_at: "desc" as const }]
						: [{ created_at: "desc" as const }];

		const rows = await client.match_participants.findMany({
			where: {
				user_id: userId,
				...(options.resultFilter && options.resultFilter !== "all"
					? { result: options.resultFilter }
					: {}),
				match_id: {
					in: (
						await client.matches.findMany({
							where: {
								mode: "public_casual",
								persisted: true,
								...(since ? { ended_at: { gte: since } } : {}),
							},
							select: { id: true },
						})
					).map((item) => item.id),
				},
			},
			orderBy,
			take: limit,
			...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
		});

		if (rows.length === 0) {
			return [];
		}

		const matchesById = new Map(
			(
				await client.matches.findMany({
					where: { id: { in: rows.map((row) => row.match_id) } },
				})
			).map((match) => [match.id, match])
		);

		return rows
			.map((participant) => {
				const match = matchesById.get(participant.match_id);
				return match ? { match, participant } : null;
			})
			.filter(
				(
					row
				): row is { match: DatabaseMatch; participant: DatabaseMatchParticipant } =>
					Boolean(row)
			);
	},
	getDetailForUser: async (userId, matchId) => {
		const participant = await client.match_participants.findFirst({
			where: {
				match_id: matchId,
				user_id: userId,
			},
		});
		if (!participant) {
			return null;
		}
		const match = await client.matches.findFirst({
			where: {
				id: matchId,
				mode: "public_casual",
				persisted: true,
			},
		});
		if (!match) {
			return null;
		}
		const participants = await client.match_participants.findMany({
			where: { match_id: matchId },
			orderBy: { placement: "asc" },
		});
		return { match, participant, participants };
	},
	hasSharedMatch: async (reporterUserId, targetUserId, matchId) => {
		if (matchId) {
			const participants = await client.match_participants.findMany({
				where: { match_id: matchId },
				select: { user_id: true },
			});
			const userIds = new Set(
				participants
					.map((item) => item.user_id)
					.filter((value): value is string => Boolean(value))
			);
			return userIds.has(reporterUserId) && userIds.has(targetUserId);
		}

		const matches = await client.match_participants.findMany({
			where: {
				user_id: reporterUserId,
			},
			select: { match_id: true },
			take: 100,
		});
		if (matches.length === 0) {
			return false;
		}
		const targetCount = await client.match_participants.count({
			where: {
				user_id: targetUserId,
				match_id: {
					in: matches.map((item) => item.match_id),
				},
			},
		});
		return targetCount > 0;
	},
});
