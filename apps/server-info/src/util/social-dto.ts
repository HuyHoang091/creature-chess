import {
	type BlockedUserDto,
	type FriendDto,
	type FriendRequestDto,
	type MatchHistoryDetailDto,
	type MatchHistoryItemDto,
	type MatchHistoryParticipantDto,
	type PresenceState,
} from "@creature-chess/models";

import {
	type DatabaseBlock,
	type DatabaseFriendRequest,
	type DatabaseMatch,
	type DatabaseMatchParticipant,
	type DatabaseUser,
} from "@cc-server/data";

const getNickname = (user: DatabaseUser | null) => user?.nickname || "Unknown";

export const toFriendDto = (
	user: DatabaseUser,
	presence: PresenceState = "offline"
): FriendDto => ({
	userId: user.id,
	nickname: getNickname(user),
	profilePicture: user.profile_picture ?? null,
	title: null,
	presence,
});

export const toFriendRequestDto = (
	request: DatabaseFriendRequest,
	sender: DatabaseUser | null,
	receiver: DatabaseUser | null
): FriendRequestDto => ({
	id: request.id,
	senderUserId: request.sender_id,
	senderNickname: getNickname(sender),
	receiverUserId: request.receiver_id,
	receiverNickname: getNickname(receiver),
	createdAt: request.created_at.toISOString(),
	status: "pending",
});

export const toBlockedUserDto = (
	block: DatabaseBlock,
	user: DatabaseUser | null
): BlockedUserDto => ({
	userId: block.blocked_user_id,
	nickname: getNickname(user),
	profilePicture: user?.profile_picture ?? null,
	title: null,
});

export const toMatchHistoryItemDto = (
	match: DatabaseMatch,
	participant: DatabaseMatchParticipant
): MatchHistoryItemDto => ({
	matchId: match.id,
	mode: "public_casual",
	startedAt: match.started_at.toISOString(),
	endedAt: match.ended_at.toISOString(),
	placement: participant.placement,
	playerCount: match.player_count,
	durationSeconds: Math.max(
		0,
		Math.round((match.ended_at.getTime() - match.started_at.getTime()) / 1000)
	),
	result:
		participant.result === "win" ||
		participant.result === "top4" ||
		participant.result === "loss"
			? participant.result
			: participant.placement === 1
				? "win"
				: participant.placement <= 4
					? "top4"
					: "loss",
});

export const toMatchHistoryParticipantDto = (
	participant: DatabaseMatchParticipant
): MatchHistoryParticipantDto => ({
	userId: participant.user_id ?? null,
	displayName: participant.display_name,
	placement: participant.placement,
	isBot: participant.is_bot,
	result:
		participant.result === "win" ||
		participant.result === "top4" ||
		participant.result === "loss"
			? participant.result
			: "custom",
});

export const toMatchHistoryDetailDto = (
	match: DatabaseMatch,
	participant: DatabaseMatchParticipant,
	participants: DatabaseMatchParticipant[]
): MatchHistoryDetailDto => ({
	...toMatchHistoryItemDto(match, participant),
	winnerUserId: match.winner_user_id ?? null,
	participants: participants
		.slice()
		.sort((left, right) => left.placement - right.placement)
		.map(toMatchHistoryParticipantDto),
	finalBoard: null,
	stats: {
		totalParticipants: participants.length,
		durationSeconds: Math.max(
			0,
			Math.round((match.ended_at.getTime() - match.started_at.getTime()) / 1000)
		),
	},
});
