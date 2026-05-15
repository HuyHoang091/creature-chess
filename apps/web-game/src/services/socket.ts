import { io, Socket } from "socket.io-client";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const customParser = require("socket.io-msgpack-parser");

import { GameServerToClient } from "@creature-chess/networking";
import { HandshakeRequest } from "@creature-chess/networking/handshake";

let currentSocket: Socket | null = null;
export const getCurrentSocket = (): Socket | null => currentSocket;
export const clearCurrentSocket = () => {
	if (currentSocket) {
		currentSocket.disconnect();
		currentSocket = null;
	}
};

export const getSocket = (request: HandshakeRequest) => {
	if (currentSocket?.connected) {
		return Promise.resolve(currentSocket);
	}

	const socket = (io as any)(
		{
			path: "/game/socket.io",
			transports: ["websocket"],
			parser: customParser,
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
		}
	);

	return new Promise<Socket>((resolve, reject) => {
		socket.on("connect", () => {
			socket.emit("authenticate", request);
		});

		const onAuthenticated = ({
			error,
		}: GameServerToClient.AuthenticateResponse) => {
			if (!error) {
				currentSocket = socket;
				resolve(socket);
				return;
			}

			socket.disconnect();
			reject(error);
		};

		socket.on("authenticate_response", onAuthenticated);

		socket.on("disconnect", () => {
			if (currentSocket === socket) {
				currentSocket = null;
			}
		});
	});
};
