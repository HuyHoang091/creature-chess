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

export type MatchHistoryDatabaseFunctions = {
	createMatchSummary: (
		payload: CreateMatchSummaryPayload
	) => Promise<DatabaseMatch | null>;
	listForUser: (
		userId: string,
		cursor?: string,
		limit?: number
	) => Promise<
		{
			match: DatabaseMatch;
			participant: DatabaseMatchParticipant;
		}[]
	>;
};

export const matchHistoryDatabase = (
	logger: Logger,
	client: PrismaClient
): MatchHistoryDatabaseFunctions => ({
	createMatchSummary: async (payload) => {
		try {
			return await client.matches.create({
				data: {
					mode: payload.mode,
					started_at: payload.startedAt,
					ended_at: payload.endedAt,
					player_count: payload.playerCount,
					winner_user_id: payload.winnerUserId ?? null,
					persisted: payload.persisted ?? true,
				},
			}).then(async (match) => {
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
	listForUser: async (userId, cursor, limit = 20) => {
		const rows = await client.match_participants.findMany({
			where: {
				user_id: userId,
			},
			orderBy: {
				created_at: "desc",
			},
			take: limit + 1,
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
		});

		const targetRows = rows.slice(0, limit);
		const matchIds = targetRows.map((row) => row.match_id);

		if (matchIds.length === 0) {
			return [];
		}

		const matchesById = new Map(
			(
				await client.matches.findMany({
					where: {
						id: { in: matchIds },
						mode: "public_casual",
						persisted: true,
					},
				})
			).map((match) => [match.id, match])
		);

		return targetRows
			.map((participant) => {
				const match = matchesById.get(participant.match_id);
				return match ? { match, participant } : null;
			})
			.filter((row): row is { match: DatabaseMatch; participant: DatabaseMatchParticipant } => Boolean(row));
	},
});
