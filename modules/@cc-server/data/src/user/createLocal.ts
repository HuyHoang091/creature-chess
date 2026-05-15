import { PrismaClient } from "@prisma/client";
import { Logger } from "winston";

export const createLocal =
	(logger: Logger, client: PrismaClient) =>
	async (email: string, passwordHash: string) => {
		try {
			return await (client.users as any).create({
				data: {
					auth_id: `local:${email.toLowerCase()}`,
					email: email.toLowerCase(),
					password_hash: passwordHash,
				},
			});
		} catch (e) {
			logger.error("Error in @cc/data user.createLocal", e);
			return null;
		}
	};
