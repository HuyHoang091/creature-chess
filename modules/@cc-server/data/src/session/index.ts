import { PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseUserSession = {
	id: string;
	user_id: string;
	token: string;
	expires_at: Date;
	created_at: Date;
	updated_at: Date;
};

export type SessionDatabaseFunctions = {
	create: (
		userId: string,
		token: string,
		expiresAt: Date
	) => Promise<DatabaseUserSession | null>;
	getByToken: (token: string) => Promise<DatabaseUserSession | null>;
	deleteByToken: (token: string) => Promise<boolean>;
	deleteExpired: (now: Date) => Promise<number>;
};

export const sessionDatabase = (
	logger: Logger,
	client: PrismaClient
): SessionDatabaseFunctions => ({
	create: async (userId, token, expiresAt) => {
		try {
			return await (client as any).user_sessions.create({
				data: {
					user_id: userId,
					token,
					expires_at: expiresAt,
				},
			});
		} catch (e) {
			logger.error("Error in @cc/data session.create", e);
			return null;
		}
	},
	getByToken: async (token) => {
		try {
			return await (client as any).user_sessions.findFirst({
				where: {
					token,
					expires_at: {
						gte: new Date(),
					},
				},
			});
		} catch (e) {
			logger.error("Error in @cc/data session.getByToken", e);
			return null;
		}
	},
	deleteByToken: async (token) => {
		try {
			const result = await (client as any).user_sessions.deleteMany({
				where: { token },
			});
			return result.count > 0;
		} catch (e) {
			logger.error("Error in @cc/data session.deleteByToken", e);
			return false;
		}
	},
	deleteExpired: async (now) => {
		try {
			const result = await (client as any).user_sessions.deleteMany({
				where: {
					expires_at: {
						lte: now,
					},
				},
			});
			return result.count;
		} catch (e) {
			logger.error("Error in @cc/data session.deleteExpired", e);
			return 0;
		}
	},
});
