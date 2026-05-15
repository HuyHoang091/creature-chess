import {
	type BlockedUserDto,
	type FriendDto,
	type FriendRequestDto,
	type FriendsResponseDto,
} from "@creature-chess/models";

import {
	type DatabaseConnection,
	type DatabaseUser,
} from "@cc-server/data";

import { PresenceManager } from "./presenceManager";

const nicknameOf = (user: DatabaseUser | null) => user?.nickname || "Unknown";

const toFriendDto = (
	user: DatabaseUser,
	presence: FriendDto["presence"]
): FriendDto => ({
	userId: user.id,
	nickname: nicknameOf(user),
	profilePicture: user.profile_picture ?? null,
	title: null,
	presence,
});

const toFriendRequestDto = (
	request: {
		id: string;
		sender_id: string;
		receiver_id: string;
		created_at: Date;
	},
	sender: DatabaseUser | null,
	receiver: DatabaseUser | null
): FriendRequestDto => ({
	id: request.id,
	senderUserId: request.sender_id,
	senderNickname: nicknameOf(sender),
	receiverUserId: request.receiver_id,
	receiverNickname: nicknameOf(receiver),
	createdAt: request.created_at.toISOString(),
	status: "pending",
});

const toBlockedUserDto = (
	userId: string,
	user: DatabaseUser | null
): BlockedUserDto => ({
	userId,
	nickname: nicknameOf(user),
	profilePicture: user?.profile_picture ?? null,
	title: null,
});

export class FriendManager {
	public constructor(
		private database: DatabaseConnection,
		private presenceManager: PresenceManager,
		private emitToUser: (userId: string, event: string, payload: unknown) => void
	) {}

	public async buildSnapshot(userId: string): Promise<FriendsResponseDto> {
		const [friendships, incomingRequests, outgoingRequests, blockedUsers] =
			await Promise.all([
				this.database.friendship.listForUser(userId),
				this.database.friendRequest.getIncomingForUser(userId),
				this.database.friendRequest.getOutgoingForUser(userId),
				this.database.block.listForUser(userId),
			]);

		const ids = new Set<string>();
		for (const friendship of friendships) {
			ids.add(friendship.user_low_id === userId ? friendship.user_high_id : friendship.user_low_id);
		}
		for (const request of incomingRequests) {
			ids.add(request.sender_id);
		}
		for (const request of outgoingRequests) {
			ids.add(request.receiver_id);
		}
		for (const block of blockedUsers) {
			ids.add(block.blocked_user_id);
		}

		const users = await this.database.prisma.users.findMany({
			where: { id: { in: [...ids] } },
		});
		const usersById = new Map(users.map((user) => [user.id, user]));

		return {
			friends: friendships
				.map((friendship) =>
					usersById.get(
						friendship.user_low_id === userId ? friendship.user_high_id : friendship.user_low_id
					)
				)
				.filter(Boolean)
				.map((user) =>
					toFriendDto(user!, this.presenceManager.getState(user!.id))
				),
			incomingRequests: incomingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			outgoingRequests: outgoingRequests.map((request) =>
				toFriendRequestDto(
					request,
					usersById.get(request.sender_id) ?? null,
					usersById.get(request.receiver_id) ?? null
				)
			),
			blockedUsers: blockedUsers.map((block) =>
				toBlockedUserDto(block.blocked_user_id, usersById.get(block.blocked_user_id) ?? null)
			),
		};
	}

	public async emitSnapshot(userId: string) {
		const snapshot = await this.buildSnapshot(userId);
		this.emitToUser(userId, "friendsSnapshot", snapshot);
	}

	public async emitSnapshotToFriendsOf(userId: string) {
		await this.emitSnapshot(userId);
		const friendships = await this.database.friendship.listForUser(userId);
		for (const friendship of friendships) {
			const friendId =
				friendship.user_low_id === userId ? friendship.user_high_id : friendship.user_low_id;
			await this.emitSnapshot(friendId);
		}
	}
}
