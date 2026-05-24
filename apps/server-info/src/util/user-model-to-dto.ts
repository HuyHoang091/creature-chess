import { UserDTO } from "@creature-chess/models/dto/user";

import { UserModel } from "@cc-server/auth";

const getAdminEmailSet = () =>
	new Set(
		(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
			.split(",")
			.map((item) => item.trim().toLowerCase())
			.filter(Boolean)
	);

export const userModelToDto = (user: UserModel): UserDTO => {
	const {
		id,
		email,
		nickname,
		stats,
		registered,
		profile,
		socialEligible,
		locked,
		lockedReason,
	} = user;
	const adminEmails = getAdminEmailSet();
	const role =
		user.role === "admin" || (email && adminEmails.has(email.toLowerCase()))
			? "admin"
			: "player";

	return {
		id: id.toString(),
		email,
		nickname,
		stats,
		registered,
		role,
		locked,
		lockedReason,
		profile: profile
			? {
					picture: profile.picture ?? null,
					title: null,
					personalInfo: profile.personalInfo ?? null,
				}
			: null,
		socialEligible,
	};
};
