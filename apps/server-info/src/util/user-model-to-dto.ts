import { UserDTO } from "@creature-chess/models/dto/user";

import { UserModel } from "@cc-server/auth";

export const userModelToDto = (user: UserModel): UserDTO => {
	const { id, nickname, stats, registered, profile, socialEligible } = user;

	return {
		id: id.toString(),
		nickname,
		stats,
		registered,
		profile: profile
			? {
					picture: profile.picture ?? null,
					title: null,
			  }
			: null,
		socialEligible,
	};
};
