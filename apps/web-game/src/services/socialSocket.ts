import { getCurrentSocket } from "./socket";

export const getSocialSocket = () => getCurrentSocket();

export const socialEmit = <T = unknown>(
	event: string,
	payload: unknown = {}
) =>
	new Promise<T>((resolve, reject) => {
		const socket = getCurrentSocket();
		if (!socket) {
			reject(new Error("Socket not connected"));
			return;
		}
		socket.emit(
			event,
			payload,
			(response: { ok: boolean; error?: { message: string } } & T) => {
				if (!response?.ok) {
					reject(new Error(response?.error?.message ?? "Socket action failed"));
					return;
				}
				resolve(response);
			}
		);
	});
