import { randomUUID } from "crypto";

import { PresenceState } from "@creature-chess/models";

type PresenceEntry = {
	userId: string;
	state: PresenceState;
	lastSeenAt: number;
};

type RoomMember = {
	userId: string;
	nickname: string;
	profilePicture: number | null;
	joinedAt: number;
	ready: boolean;
};

type RoomInvite = {
	id: string;
	roomId: string;
	roomCode: string;
	fromUserId: string;
	fromNickname: string;
	targetUserId: string;
	createdAt: number;
};

type PrivateRoom = {
	id: string;
	code: string;
	ownerUserId: string;
	ownerNickname: string;
	members: RoomMember[];
	createdAt: number;
	status: "waiting" | "starting";
};

const PRESENCE_TTL_MS = 30_000;
const INVITE_TTL_MS = 5 * 60_000;

class RuntimeSocialState {
	private presence = new Map<string, PresenceEntry>();
	private rooms = new Map<string, PrivateRoom>();
	private roomByUser = new Map<string, string>();
	private invites = new Map<string, RoomInvite>();
	private roomStartTickets = new Map<string, { roomId: string; createdAt: number }>();

	public updatePresence(userId: string, state: PresenceState) {
		this.presence.set(userId, {
			userId,
			state,
			lastSeenAt: Date.now(),
		});
	}

	public getPresence(userId: string): PresenceState {
		const item = this.presence.get(userId);

		if (!item) {
			return "offline";
		}

		if (Date.now() - item.lastSeenAt > PRESENCE_TTL_MS) {
			this.presence.delete(userId);
			return "offline";
		}

		return item.state;
	}

	public createRoom(owner: {
		userId: string;
		nickname: string;
		profilePicture: number | null;
	}) {
		const existingRoom = this.getRoomForUser(owner.userId);
		if (existingRoom) {
			return existingRoom;
		}

		const room: PrivateRoom = {
			id: randomUUID(),
			code: Math.random().toString(36).slice(2, 8).toUpperCase(),
			ownerUserId: owner.userId,
			ownerNickname: owner.nickname,
			members: [
				{
					userId: owner.userId,
					nickname: owner.nickname,
					profilePicture: owner.profilePicture,
					joinedAt: Date.now(),
					ready: false,
				},
			],
			createdAt: Date.now(),
			status: "waiting",
		};

		this.rooms.set(room.id, room);
		this.roomByUser.set(owner.userId, room.id);
		return room;
	}

	public getRoomForUser(userId: string) {
		const roomId = this.roomByUser.get(userId);
		return roomId ? this.rooms.get(roomId) ?? null : null;
	}

	public getRoomByCode(code: string) {
		return (
			[...this.rooms.values()].find(
				(room) => room.code.toUpperCase() === code.toUpperCase()
			) ?? null
		);
	}

	public joinRoom(
		code: string,
		user: { userId: string; nickname: string; profilePicture: number | null }
	) {
		const room = this.getRoomByCode(code);

		if (!room) {
			return null;
		}

		if (room.members.some((member) => member.userId === user.userId)) {
			this.roomByUser.set(user.userId, room.id);
			return room;
		}

		if (room.members.length >= 8) {
			return "full" as const;
		}

		room.members.push({
			userId: user.userId,
			nickname: user.nickname,
			profilePicture: user.profilePicture,
			joinedAt: Date.now(),
			ready: false,
		});
		room.status = "waiting";
		this.roomByUser.set(user.userId, room.id);
		return room;
	}

	public leaveRoom(userId: string) {
		const room = this.getRoomForUser(userId);
		if (!room) {
			return null;
		}

		room.members = room.members.filter((member) => member.userId !== userId);
		this.roomByUser.delete(userId);
		room.status = "waiting";

		if (room.members.length === 0) {
			this.rooms.delete(room.id);
			return null;
		}

		if (room.ownerUserId === userId) {
			room.ownerUserId = room.members[0].userId;
			room.ownerNickname = room.members[0].nickname;
			room.members[0].ready = false;
		}

		return room;
	}

	public toggleReady(userId: string) {
		const room = this.getRoomForUser(userId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		if (room.ownerUserId === userId) {
			return { ok: false as const, reason: "OWNER_CANNOT_READY" };
		}
		const member = room.members.find((item) => item.userId === userId);
		if (!member) {
			return { ok: false as const, reason: "MEMBER_NOT_IN_ROOM" };
		}
		member.ready = !member.ready;
		room.status = "waiting";
		return { ok: true as const, room };
	}

	public startRoom(ownerUserId: string) {
		const room = this.getRoomForUser(ownerUserId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		if (room.ownerUserId !== ownerUserId) {
			return { ok: false as const, reason: "NOT_OWNER" };
		}
		if (room.members.length < 2) {
			return { ok: false as const, reason: "NOT_ENOUGH_PLAYERS" };
		}
		const unready = room.members.some(
			(member) => member.userId !== ownerUserId && !member.ready
		);
		if (unready) {
			return { ok: false as const, reason: "MEMBERS_NOT_READY" };
		}

		room.status = "starting";
		for (const member of room.members) {
			member.ready = false;
		}
		const matchTicket = randomUUID();
		this.roomStartTickets.set(matchTicket, { roomId: room.id, createdAt: Date.now() });
		return { ok: true as const, room, matchTicket };
	}

	public createInvite(input: {
		roomId: string;
		roomCode: string;
		fromUserId: string;
		fromNickname: string;
		targetUserId: string;
	}) {
		const invite: RoomInvite = {
			id: randomUUID(),
			roomId: input.roomId,
			roomCode: input.roomCode,
			fromUserId: input.fromUserId,
			fromNickname: input.fromNickname,
			targetUserId: input.targetUserId,
			createdAt: Date.now(),
		};

		this.invites.set(invite.id, invite);
		return invite;
	}

	public getInvitesForUser(userId: string) {
		this.cleanupInvites();
		return [...this.invites.values()].filter((invite) => invite.targetUserId === userId);
	}

	public takeInvite(inviteId: string, userId: string) {
		this.cleanupInvites();
		const invite = this.invites.get(inviteId);

		if (!invite || invite.targetUserId !== userId) {
			return null;
		}

		this.invites.delete(inviteId);
		return invite;
	}

	public declineInvite(inviteId: string, userId: string) {
		const invite = this.invites.get(inviteId);
		if (!invite || invite.targetUserId !== userId) {
			return false;
		}

		this.invites.delete(inviteId);
		return true;
	}

	private cleanupInvites() {
		const now = Date.now();
		for (const [id, invite] of this.invites.entries()) {
			if (now - invite.createdAt > INVITE_TTL_MS) {
				this.invites.delete(id);
			}
		}
	}
}

export const runtimeSocialState = new RuntimeSocialState();
