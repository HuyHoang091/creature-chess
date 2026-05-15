import { blocks, PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseBlock = blocks;

export type BlockDatabaseFunctions = {
	create: (blockerId: string, blockedId: string) => Promise<DatabaseBlock | null>;
	delete: (blockerId: string, blockedId: string) => Promise<boolean>;
	listForUser: (blockerId: string) => Promise<DatabaseBlock[]>;
	existsEitherDirection: (userA: string, userB: string) => Promise<boolean>;
};

export const blockDatabase = (
	logger: Logger,
	client: PrismaClient
): BlockDatabaseFunctions => ({
	create: async (blockerId, blockedId) => {
		try {
			return await client.blocks.create({
				data: {
					blocker_user_id: blockerId,
					blocked_user_id: blockedId,
				},
			});
		} catch (error) {
			logger.error("Failed to create block", error);
			return null;
		}
	},
	delete: async (blockerId, blockedId) => {
		try {
			const result = await client.blocks.deleteMany({
				where: {
					blocker_user_id: blockerId,
					blocked_user_id: blockedId,
				},
			});
			return result.count > 0;
		} catch (error) {
			logger.error("Failed to delete block", error);
			return false;
		}
	},
	listForUser: (blockerId) =>
		client.blocks.findMany({
			where: { blocker_user_id: blockerId },
			orderBy: { created_at: "desc" },
		}),
	existsEitherDirection: async (userA, userB) => {
		const row = await client.blocks.findFirst({
			where: {
				OR: [
					{ blocker_user_id: userA, blocked_user_id: userB },
					{ blocker_user_id: userB, blocked_user_id: userA },
				],
			},
		});
		return Boolean(row);
	},
});
