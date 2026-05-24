export interface UserDTO {
	id: string;
	email?: string | null;
	nickname: string | null;
	stats: {
		gamesPlayed: number;
		wins: number;
	};
	registered: boolean;
	role?: "player" | "admin";
	locked?: boolean;
	lockedReason?: string | null;
	profile?: {
		picture: number | null;
		title: number | null;
		personalInfo?: string | null;
	} | null;
	socialEligible?: boolean;
}
