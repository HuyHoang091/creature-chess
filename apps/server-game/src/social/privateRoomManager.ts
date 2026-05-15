import { randomUUID } from "crypto";

import type { RoomInviteDto, RoomJoinRequestDto } from "@creature-chess/models";

import { SocialRoom, SocialUser } from "./types";

export class PrivateRoomManager {
	private roomsById = new Map<string, SocialRoom>();
	private roomIdByUserId = new Map<string, string>();
	private invitesByUserId = new Map<string, RoomInviteDto[]>();

	public getRoomForUser(userId: string) {
		const roomId = this.roomIdByUserId.get(userId);
		return roomId ? this.roomsById.get(roomId) ?? null : null;
	}

	public getInvitesForUser(userId: string) {
		return this.invitesByUserId.get(userId) ?? [];
	}

	public createRoom(owner: SocialUser) {
		const existing = this.getRoomForUser(owner.userId);
		if (existing) {
			return existing;
		}

		const room: SocialRoom = {
			id: randomUUID(),
			code: this.createCode(),
			ownerUserId: owner.userId,
			ownerNickname: owner.nickname,
			members: [{ ...owner, ready: false }],
			pendingJoinRequests: [],
			status: "waiting",
			createdAt: Date.now(),
		};

		this.roomsById.set(room.id, room);
		this.roomIdByUserId.set(owner.userId, room.id);
		return room;
	}

	public leaveRoom(userId: string) {
		const room = this.getRoomForUser(userId);
		if (!room) {
			return null;
		}

		room.members = room.members.filter((member) => member.userId !== userId);
		this.roomIdByUserId.delete(userId);

		if (room.members.length === 0) {
			this.roomsById.delete(room.id);
			return null;
		}

		if (room.ownerUserId === userId) {
			room.ownerUserId = room.members[0].userId;
			room.ownerNickname = room.members[0].nickname;
		}

		room.pendingJoinRequests = room.pendingJoinRequests.filter(
			(request) => request.requesterUserId !== userId
		);
		room.status = "waiting";
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
			return { ok: false as const, reason: "MEMBER_NOT_FOUND" };
		}
		member.ready = !member.ready;
		return { ok: true as const, room };
	}

	public markInGame(roomId: string) {
		const room = this.roomsById.get(roomId);
		if (!room) {
			return null;
		}
		room.status = "in_game";
		return room;
	}

	public markWaiting(roomId: string) {
		const room = this.roomsById.get(roomId);
		if (!room) {
			return null;
		}
		room.status = "waiting";
		for (const member of room.members) {
			member.ready = false;
		}
		return room;
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
		if (room.members.some((member) => member.userId !== ownerUserId && !member.ready)) {
			return { ok: false as const, reason: "MEMBERS_NOT_READY" };
		}
		room.status = "starting";
		return { ok: true as const, room };
	}

	public createInvite(fromUser: SocialUser, targetUserId: string) {
		const room = this.getRoomForUser(fromUser.userId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		const existing = this.getInvitesForUser(targetUserId).find(
			(invite) => invite.roomId === room.id
		);
		if (existing) {
			return { ok: true as const, invite: existing };
		}
		const invite: RoomInviteDto = {
			id: randomUUID(),
			roomId: room.id,
			roomCode: room.code,
			fromUserId: fromUser.userId,
			fromNickname: fromUser.nickname,
			createdAt: Date.now(),
		};
		this.invitesByUserId.set(targetUserId, [...this.getInvitesForUser(targetUserId), invite]);
		return { ok: true as const, invite, room };
	}

	public acceptInvite(targetUser: SocialUser, inviteId: string) {
		const invites = this.getInvitesForUser(targetUser.userId);
		const invite = invites.find((item) => item.id === inviteId);
		if (!invite) {
			return { ok: false as const, reason: "INVITE_NOT_FOUND" };
		}
		this.invitesByUserId.set(
			targetUser.userId,
			invites.filter((item) => item.id !== inviteId)
		);
		return this.joinRoomByCode(targetUser, invite.roomCode);
	}

	public declineInvite(userId: string, inviteId: string) {
		const invites = this.getInvitesForUser(userId);
		const next = invites.filter((item) => item.id !== inviteId);
		this.invitesByUserId.set(userId, next);
		return invites.length !== next.length;
	}

	public joinRoomByCode(user: SocialUser, code: string) {
		const room =
			[...this.roomsById.values()].find((item) => item.code === code.toUpperCase()) ?? null;
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		if (room.members.some((member) => member.userId === user.userId)) {
			return { ok: true as const, room };
		}
		if (room.members.length >= 8) {
			return { ok: false as const, reason: "ROOM_FULL" };
		}
		const existingRoom = this.getRoomForUser(user.userId);
		if (existingRoom && existingRoom.id !== room.id) {
			this.leaveRoom(user.userId);
		}
		room.members.push({ ...user, ready: false });
		this.roomIdByUserId.set(user.userId, room.id);
		room.status = "waiting";
		return { ok: true as const, room };
	}

	public requestJoin(targetUserId: string, requester: SocialUser) {
		const room = this.getRoomForUser(targetUserId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_AVAILABLE" };
		}
		const existing = room.pendingJoinRequests.find(
			(request) => request.requesterUserId === requester.userId
		);
		if (existing) {
			return { ok: true as const, room, request: existing };
		}
		const request: RoomJoinRequestDto = {
			id: randomUUID(),
			requesterUserId: requester.userId,
			requesterNickname: requester.nickname,
			createdAt: Date.now(),
		};
		room.pendingJoinRequests.push(request);
		return { ok: true as const, room, request };
	}

	public acceptJoinRequest(ownerUserId: string, requestId: string, requester: SocialUser) {
		const room = this.getRoomForUser(ownerUserId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		if (room.ownerUserId !== ownerUserId) {
			return { ok: false as const, reason: "NOT_OWNER" };
		}
		const request = room.pendingJoinRequests.find((item) => item.id === requestId);
		if (!request) {
			return { ok: false as const, reason: "REQUEST_NOT_FOUND" };
		}
		room.pendingJoinRequests = room.pendingJoinRequests.filter((item) => item.id !== requestId);
		return this.joinRoomByCode(requester, room.code);
	}

	public declineJoinRequest(ownerUserId: string, requestId: string) {
		const room = this.getRoomForUser(ownerUserId);
		if (!room) {
			return { ok: false as const, reason: "ROOM_NOT_FOUND" };
		}
		if (room.ownerUserId !== ownerUserId) {
			return { ok: false as const, reason: "NOT_OWNER" };
		}
		const request = room.pendingJoinRequests.find((item) => item.id === requestId);
		if (!request) {
			return { ok: false as const, reason: "REQUEST_NOT_FOUND" };
		}
		room.pendingJoinRequests = room.pendingJoinRequests.filter((item) => item.id !== requestId);
		return { ok: true as const, room, request };
	}

	private createCode() {
		let code = "";
		do {
			code = Math.random().toString(36).slice(2, 8).toUpperCase();
		} while ([...this.roomsById.values()].some((room) => room.code === code));
		return code;
	}
}
