import { PrismaClient, reports } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseReport = reports;

export type ReportDatabaseFunctions = {
	create: (
		reporterId: string,
		targetId: string,
		reason: string,
		options?: {
			matchId?: string | null;
			description?: string | null;
			reporterIp?: string | null;
		}
	) => Promise<DatabaseReport | null>;
	countForReporterTargetSince: (
		reporterId: string,
		targetId: string,
		since: Date
	) => Promise<number>;
	countPendingForReporter: (reporterId: string) => Promise<number>;
};

export const reportDatabase = (
	logger: Logger,
	client: PrismaClient
): ReportDatabaseFunctions => ({
	create: async (reporterId, targetId, reason, options) => {
		try {
			return await (client.reports as any).create({
				data: {
					reporter_user_id: reporterId,
					target_user_id: targetId,
					reason,
					match_id: options?.matchId ?? null,
					description: options?.description ?? null,
					reporter_ip: options?.reporterIp ?? null,
					status: "pending",
				},
			});
		} catch (error) {
			logger.error("Failed to create report", error);
			return null;
		}
	},
	countForReporterTargetSince: async (reporterId, targetId, since) =>
		(client.reports as any).count({
			where: {
				reporter_user_id: reporterId,
				target_user_id: targetId,
				created_at: {
					gte: since,
				},
			},
		}),
	countPendingForReporter: async (reporterId) =>
		(client.reports as any).count({
			where: {
				reporter_user_id: reporterId,
				status: "pending",
			},
		}),
});
