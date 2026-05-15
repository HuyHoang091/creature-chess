import type {
	FriendsResponseDto,
	PresenceState,
	PrivateRoomDto,
	RoomInviteDto,
	RoomJoinRequestDto,
	RoomSnapshotDto,
} from "@creature-chess/models";

export type SocialUser = {
	userId: string;
	nickname: string;
	profilePicture: number | null;
};

export type SocialRoomMember = SocialUser & {
	ready: boolean;
};

export type SocialRoom = {
	id: string;
	code: string;
	ownerUserId: string;
	ownerNickname: string;
	members: SocialRoomMember[];
	pendingJoinRequests: RoomJoinRequestDto[];
	status: "waiting" | "starting" | "in_game";
	createdAt: number;
};

export type SocialFriendsSnapshot = FriendsResponseDto;
export type SocialRoomSnapshot = RoomSnapshotDto;
export type SocialPresence = PresenceState;

export const toPrivateRoomDto = (room: SocialRoom): PrivateRoomDto => ({
	id: room.id,
	code: room.code,
	ownerUserId: room.ownerUserId,
	ownerNickname: room.ownerNickname,
	members: room.members.map((member) => ({
		userId: member.userId,
		nickname: member.nickname,
		profilePicture: member.profilePicture,
		ready: member.ready,
	})),
	pendingJoinRequests: room.pendingJoinRequests,
	status: room.status,
	createdAt: room.createdAt,
});

export const createRoomInviteDto = (invite: RoomInviteDto): RoomInviteDto => ({
	...invite,
});
