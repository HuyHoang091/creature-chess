import { PrismaClient } from "@prisma/client";
import { Logger } from "winston";

import { blockDatabase, BlockDatabaseFunctions } from "./block";
import { botDatabase, BotDatabaseFunctions } from "./bot";
import {
	friendRequestDatabase,
	FriendRequestDatabaseFunctions,
} from "./friendRequest";
import { friendshipDatabase, FriendshipDatabaseFunctions } from "./friendship";
import {
	matchHistoryDatabase,
	MatchHistoryDatabaseFunctions,
} from "./matchHistory";
import { reportDatabase, ReportDatabaseFunctions } from "./report";
import { sessionDatabase, SessionDatabaseFunctions } from "./session";
import { setup } from "./setup";
import { userDatabase, UserDatabaseFunctions } from "./user";

export type DatabaseConnection = {
	prisma: PrismaClient;
	user: UserDatabaseFunctions;
	bot: BotDatabaseFunctions;
	friendRequest: FriendRequestDatabaseFunctions;
	friendship: FriendshipDatabaseFunctions;
	block: BlockDatabaseFunctions;
	matchHistory: MatchHistoryDatabaseFunctions;
	report: ReportDatabaseFunctions;
	session: SessionDatabaseFunctions;
};

export const prisma = new PrismaClient();

export const createDatabaseConnection = async (
	logger: Logger
): Promise<DatabaseConnection> => {
	try {
		await setup(logger, prisma);

		return {
			prisma,
			user: userDatabase(logger, prisma),
			bot: botDatabase(logger, prisma),
			friendRequest: friendRequestDatabase(logger, prisma),
			friendship: friendshipDatabase(logger, prisma),
			block: blockDatabase(logger, prisma),
			matchHistory: matchHistoryDatabase(logger, prisma),
			report: reportDatabase(logger, prisma),
			session: sessionDatabase(logger, prisma),
		};
	} catch (e) {
		logger.error("Error in @cc/data setting up database", e);
		throw e;
	}
};
