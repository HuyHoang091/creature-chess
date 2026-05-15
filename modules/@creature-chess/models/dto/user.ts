export interface UserDTO {
	id: string;
	nickname: string | null;
	stats: {
		gamesPlayed: number;
		wins: number;
	};
	registered: boolean;
	profile?: {
		picture: number | null;
		title: number | null;
	} | null;
	socialEligible?: boolean;
}
