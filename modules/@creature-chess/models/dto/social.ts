export type PresenceState = "offline" | "online" | "in_room" | "in_game";

export interface FriendDto {
	userId: string;
	nickname: string;
	profilePicture: number | null;
	title: number | null;
	presence: PresenceState;
}

export interface FriendRequestDto {
	id: string;
	senderUserId: string;
	senderNickname: string;
	receiverUserId: string;
	receiverNickname: string;
	createdAt: string;
	status: "pending";
}

export interface BlockedUserDto {
	userId: string;
	nickname: string;
	profilePicture: number | null;
	title: number | null;
}

export interface FriendsResponseDto {
	friends: FriendDto[];
	incomingRequests: FriendRequestDto[];
	outgoingRequests: FriendRequestDto[];
	blockedUsers: BlockedUserDto[];
}

export interface RoomInviteDto {
	id: string;
	roomId: string;
	roomCode: string;
	fromUserId: string;
	fromNickname: string;
	createdAt: number;
}

export interface RoomJoinRequestDto {
	id: string;
	requesterUserId: string;
	requesterNickname: string;
	createdAt: number;
}

export interface PrivateRoomDto {
	id: string;
	code: string;
	ownerUserId: string;
	ownerNickname: string;
	members: {
		userId: string;
		nickname: string;
		profilePicture: number | null;
		ready: boolean;
	}[];
	pendingJoinRequests: RoomJoinRequestDto[];
	status: "waiting" | "starting" | "in_game";
	createdAt: number;
}

export interface RoomSnapshotDto {
	room: PrivateRoomDto | null;
	invites: RoomInviteDto[];
}

export interface MatchHistoryItemDto {
	matchId: string;
	mode: "public_casual";
	endedAt: string;
	placement: number;
	playerCount: number;
	durationSeconds: number;
	result: "win" | "top4" | "loss";
}

export interface MatchHistoryResponseDto {
	items: MatchHistoryItemDto[];
	nextCursor: string | null;
}
