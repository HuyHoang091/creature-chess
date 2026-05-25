import { PlayerProfile } from "@creature-chess/models/player";

import { DatabaseUser } from "@cc-server/data";

export interface UserModel {
	id: string;
	authId: string;
	email: string | null;
	role: "player" | "admin";
	locked: boolean;
	lockedReason: string | null;
	stats: { gamesPlayed: number; wins: number };
	nickname: string | null;
	registered: boolean;
	profile: PlayerProfile | null;
	socialEligible: boolean;
}

export const convertDatabaseUserToUserModel = (
	user: DatabaseUser
): UserModel => {
	const lockedUntil = (user as any).locked_until as Date | null | undefined;
	const locked =
		Boolean((user as any).locked_at) &&
		(!lockedUntil || lockedUntil.getTime() > Date.now());
	const nickname = user.nickname || null;

	// TODO reimplement Title (load from DB)
	const profile = {
		title: null, // user.profile_title || null,
		picture: user.profile_picture || null,
		personalInfo: (user as any).profile_bio || null,
	};

	const stats = {
		gamesPlayed: user.games_played,
		wins: user.wins,
	};

	return {
		id: user.id,
		authId: user.auth_id,
		email: (user as any).email || null,
		role: ((user as any).role === "admin" ? "admin" : "player") as
			| "player"
			| "admin",
		locked,
		lockedReason: (user as any).locked_reason || null,
		stats,
		nickname,
		profile,
		registered: Boolean(nickname && profile.picture),
		socialEligible: Boolean(nickname && profile.picture),
	};
};
