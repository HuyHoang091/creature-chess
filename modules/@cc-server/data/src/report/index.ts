import { PrismaClient, reports } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseReport = reports;

export type ReportDatabaseFunctions = {
	create: (
		reporterId: string,
		targetId: string,
		reason: string,
		matchId?: string | null
	) => Promise<DatabaseReport | null>;
	countForReporterTargetSince: (
		reporterId: string,
		targetId: string,
		since: Date
	) => Promise<number>;
};

export const reportDatabase = (
	logger: Logger,
	client: PrismaClient
): ReportDatabaseFunctions => ({
	create: async (reporterId, targetId, reason, matchId) => {
		try {
			return await client.reports.create({
				data: {
					reporter_user_id: reporterId,
					target_user_id: targetId,
					reason,
					match_id: matchId ?? null,
				},
			});
		} catch (error) {
			logger.error("Failed to create report", error);
			return null;
		}
	},
	countForReporterTargetSince: async (reporterId, targetId, since) =>
		client.reports.count({
			where: {
				reporter_user_id: reporterId,
				target_user_id: targetId,
				created_at: {
					gte: since,
				},
			},
		}),
});
