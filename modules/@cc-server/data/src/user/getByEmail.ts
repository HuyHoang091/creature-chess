import { PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export const getByEmail =
	(logger: Logger, client: PrismaClient) => async (email: string) => {
		try {
			return await (client.users as any).findFirst({
				where: {
					email: email.toLowerCase(),
				},
			});
		} catch (e) {
			logger.error("Error in @cc/data user.getByEmail", e);
			return null;
		}
	};
