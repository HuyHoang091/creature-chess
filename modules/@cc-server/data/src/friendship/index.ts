import { friendships, PrismaClient } from "@prisma/client";
import { Logger } from "winston";

import { sortUserIds } from "../social/sortUserIds";

export type DatabaseFriendship = friendships;

export type FriendshipDatabaseFunctions = {
	listForUser: (userId: string) => Promise<DatabaseFriendship[]>;
	createPair: (
		userA: string,
		userB: string
	) => Promise<DatabaseFriendship | null>;
	deletePair: (userA: string, userB: string) => Promise<boolean>;
	exists: (userA: string, userB: string) => Promise<boolean>;
};

export const friendshipDatabase = (
	logger: Logger,
	client: PrismaClient
): FriendshipDatabaseFunctions => ({
	listForUser: (userId) =>
		client.friendships.findMany({
			where: {
				OR: [{ user_low_id: userId }, { user_high_id: userId }],
			},
			orderBy: { created_at: "desc" },
		}),
	createPair: async (userA, userB) => {
		const [userLowId, userHighId] = sortUserIds(userA, userB);
		try {
			return await client.friendships.create({
				data: {
					user_low_id: userLowId,
					user_high_id: userHighId,
				},
			});
		} catch (error) {
			logger.error("Failed to create friendship", error);
			return null;
		}
	},
	deletePair: async (userA, userB) => {
		const [userLowId, userHighId] = sortUserIds(userA, userB);
		try {
			const result = await client.friendships.deleteMany({
				where: {
					user_low_id: userLowId,
					user_high_id: userHighId,
				},
			});
			return result.count > 0;
		} catch (error) {
			logger.error("Failed to delete friendship", error);
			return false;
		}
	},
	exists: async (userA, userB) => {
		const [userLowId, userHighId] = sortUserIds(userA, userB);
		const row = await client.friendships.findFirst({
			where: {
				user_low_id: userLowId,
				user_high_id: userHighId,
			},
		});
		return Boolean(row);
	},
});
