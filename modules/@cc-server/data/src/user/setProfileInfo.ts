import { PrismaClient, Prisma } from "@prisma/client";
import { Logger } from "winston";

export const setProfileInfo =
	(logger: Logger, client: PrismaClient) =>
	async (
		id: string,
		nickname: string | null,
		picture: number | null,
		personalInfo?: string | null
	) => {
		try {
			logger.info(`setProfileInfo for user ${id}`);
			logger.info(`nickname: ${nickname}`);
			logger.info(`picture: ${picture}`);

			let userUpdate: Prisma.usersUpdateInput & {
				profile_bio?: string | null;
			} = {};

			if (nickname) {
				userUpdate = {
					...userUpdate,
					nickname,
				};
			}

			if (picture) {
				userUpdate = {
					...userUpdate,
					profile_picture: picture,
				};
			}

			if (personalInfo !== undefined) {
				userUpdate = {
					...userUpdate,
					profile_bio: personalInfo,
				};
			}

			logger.info(`userUpdate: ${JSON.stringify(userUpdate)}`);

			return await client.users.update({
				where: {
					id,
				},
				data: {
					...userUpdate,
				},
			});
		} catch (e) {
			logger.error("Error in @cc/data user.setProfileInfo", e);
			return null;
		}
	};
