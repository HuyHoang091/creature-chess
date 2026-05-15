import { friend_requests, PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export type DatabaseFriendRequest = friend_requests;

export type FriendRequestDatabaseFunctions = {
	create: (
		senderId: string,
		receiverId: string
	) => Promise<
		| { ok: true; value: DatabaseFriendRequest }
		| { ok: false; reason: "conflict" | "error" }
	>;
	getIncomingForUser: (userId: string) => Promise<DatabaseFriendRequest[]>;
	getOutgoingForUser: (userId: string) => Promise<DatabaseFriendRequest[]>;
	accept: (
		requestId: string,
		receiverId: string
	) => Promise<DatabaseFriendRequest | null>;
	decline: (
		requestId: string,
		receiverId: string
	) => Promise<DatabaseFriendRequest | null>;
	cancel: (
		requestId: string,
		senderId: string
	) => Promise<DatabaseFriendRequest | null>;
	findBetweenUsers: (
		userA: string,
		userB: string
	) => Promise<DatabaseFriendRequest | null>;
};

export const friendRequestDatabase = (
	logger: Logger,
	client: PrismaClient
): FriendRequestDatabaseFunctions => ({
	create: async (senderId, receiverId) => {
		try {
			const value = await client.friend_requests.create({
				data: {
					sender_id: senderId,
					receiver_id: receiverId,
				},
			});
			return { ok: true, value };
		} catch (error) {
			const code = (error as { code?: string })?.code;
			if (code === "P2002") {
				return { ok: false, reason: "conflict" };
			}
			logger.error("Failed to create friend request", error);
			return { ok: false, reason: "error" };
		}
	},
	getIncomingForUser: (userId) =>
		client.friend_requests.findMany({
			where: { receiver_id: userId, status: "pending" },
			orderBy: { created_at: "desc" },
		}),
	getOutgoingForUser: (userId) =>
		client.friend_requests.findMany({
			where: { sender_id: userId, status: "pending" },
			orderBy: { created_at: "desc" },
		}),
	accept: async (requestId, receiverId) => {
		try {
			return await client.friend_requests.updateMany({
				where: { id: requestId, receiver_id: receiverId, status: "pending" },
				data: { status: "accepted" },
			}).then(async (result) =>
				result.count > 0
					? client.friend_requests.findUnique({ where: { id: requestId } })
					: null
			);
		} catch (error) {
			logger.error("Failed to accept friend request", error);
			return null;
		}
	},
	decline: async (requestId, receiverId) => {
		try {
			return await client.friend_requests.updateMany({
				where: { id: requestId, receiver_id: receiverId, status: "pending" },
				data: { status: "declined" },
			}).then(async (result) =>
				result.count > 0
					? client.friend_requests.findUnique({ where: { id: requestId } })
					: null
			);
		} catch (error) {
			logger.error("Failed to decline friend request", error);
			return null;
		}
	},
	cancel: async (requestId, senderId) => {
		try {
			return await client.friend_requests.updateMany({
				where: { id: requestId, sender_id: senderId, status: "pending" },
				data: { status: "cancelled" },
			}).then(async (result) =>
				result.count > 0
					? client.friend_requests.findUnique({ where: { id: requestId } })
					: null
			);
		} catch (error) {
			logger.error("Failed to cancel friend request", error);
			return null;
		}
	},
	findBetweenUsers: (userA, userB) =>
		client.friend_requests.findFirst({
			where: {
				OR: [
					{ sender_id: userA, receiver_id: userB },
					{ sender_id: userB, receiver_id: userA },
				],
				status: "pending",
			},
		}),
});
