import { HandshakeRequest } from "@creature-chess/networking/handshake";

import { authenticate } from "@cc-server/auth";

import { logger } from "../log";
import { AuthenticatedSocket } from "../player/socket";
import { handshakeListener } from "./listener";
import { failHandshake, successHandshake } from "./response";
import { HandshakeListenerDependencies } from "./types";

/**
 * Listen for incoming connections, process the handshake, and raise any connections that pass.
 *
 * @param onReceive The callback for sockets that pass handshake.
 */
export const onHandshakeSuccess = (
	deps: HandshakeListenerDependencies,
	onReceive: (socket: AuthenticatedSocket, request: HandshakeRequest) => void
) => {
	const { authClient, database } = deps;

	handshakeListener(deps, async (socket, request) => {
		try {
			const isLockedUser = (user: {
				locked_at?: Date | null;
				locked_until?: Date | null;
			}) => {
				if (!user.locked_at) {
					return false;
				}
				return !user.locked_until || user.locked_until.getTime() > Date.now();
			};

			if (request.type === "guest") {
				const guest = await database.prisma.guests.findFirst({
					where: {
						token: request.data.accessToken,
						expires_at: {
							gte: new Date(),
						},
					},
				});

				if (!guest) {
					failHandshake(socket, { error: { type: "authentication" } });
					return;
				}

				logger.info(`[socket ${socket.id}] Handshake successful for guest`);

				successHandshake(socket);

				const guestSocket = socket as AuthenticatedSocket;

				guestSocket.data = {
					type: "guest",
					id: guest.id,
					nickname: `Guest ${guest.id}`,
					profile: {
						picture: guest.profile_picture,
						title: null,
					},
				};

				onReceive(guestSocket, request);

				return;
			}

			if (request.type === "local") {
				const session = await database.session.getByToken(
					request.data.accessToken
				);

				if (!session) {
					failHandshake(socket, { error: { type: "authentication" } });
					return;
				}

				const databaseUser = await database.user.getById(session.user_id);

				if (!databaseUser || isLockedUser(databaseUser as any)) {
					failHandshake(socket, { error: { type: "authentication" } });
					return;
				}

				const localUser = {
					id: databaseUser.id,
					nickname: databaseUser.nickname,
					profile: {
						title: null,
						picture: databaseUser.profile_picture,
					},
					registered: Boolean(
						databaseUser.nickname && databaseUser.profile_picture
					),
				};

				if (!localUser.registered) {
					failHandshake(socket, { error: { type: "not_registered" } });
					return;
				}

				successHandshake(socket);

				const localAuthenticatedSocket = socket as AuthenticatedSocket;
				localAuthenticatedSocket.data = {
					type: "player",
					id: localUser.id,
					nickname: localUser.nickname,
					profile: localUser.profile,
				};

				onReceive(localAuthenticatedSocket, request);
				return;
			}

			const user = await authenticate(
				authClient,
				database,
				request.data.accessToken
			);

			if (user.locked) {
				failHandshake(socket, { error: { type: "authentication" } });
				return;
			}

			if (!user.registered) {
				failHandshake(socket, { error: { type: "not_registered" } });

				return;
			}

			logger.info(
				`[socket ${socket.id}] Handshake successful for '${user.nickname}'`
			);

			successHandshake(socket);

			const authenticatedSocket = socket as AuthenticatedSocket;

			authenticatedSocket.data = {
				type: "player",
				id: user.id,
				nickname: user.nickname,
				profile: user.profile,
			};

			onReceive(authenticatedSocket, request);
		} catch (e) {
			logger.error(`[socket ${socket.id}] Handshake failed`, { error: e });
			failHandshake(socket, { error: { type: "authentication" } });
		}
	});
};
