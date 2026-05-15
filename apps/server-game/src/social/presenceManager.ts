import { AuthenticatedSocket } from "../player/socket";
import { SocialPresence } from "./types";

const OFFLINE_GRACE_MS = 10_000;

export class PresenceManager {
	private socketsByUserId = new Map<string, Set<AuthenticatedSocket>>();
	private stateByUserId = new Map<string, SocialPresence>();
	private disconnectTimers = new Map<string, NodeJS.Timeout>();

	public connect(socket: AuthenticatedSocket) {
		if (socket.data.type !== "player") {
			return;
		}

		const userId = socket.data.id;
		const existing = this.socketsByUserId.get(userId) ?? new Set<AuthenticatedSocket>();
		existing.add(socket);
		this.socketsByUserId.set(userId, existing);

		const timer = this.disconnectTimers.get(userId);
		if (timer) {
			clearTimeout(timer);
			this.disconnectTimers.delete(userId);
		}

		if (!this.stateByUserId.has(userId) || this.stateByUserId.get(userId) === "offline") {
			this.stateByUserId.set(userId, "online");
		}
	}

	public disconnect(socket: AuthenticatedSocket, onOffline: (userId: string) => void) {
		if (socket.data.type !== "player") {
			return;
		}

		const userId = socket.data.id;
		const set = this.socketsByUserId.get(userId);
		if (!set) {
			return;
		}

		set.delete(socket);
		if (set.size > 0) {
			return;
		}

		this.socketsByUserId.delete(userId);
		const timer = setTimeout(() => {
			this.stateByUserId.set(userId, "offline");
			this.disconnectTimers.delete(userId);
			onOffline(userId);
		}, OFFLINE_GRACE_MS);
		this.disconnectTimers.set(userId, timer);
	}

	public setState(userId: string, state: SocialPresence) {
		this.stateByUserId.set(userId, state);
	}

	public getState(userId: string): SocialPresence {
		return this.stateByUserId.get(userId) ?? "offline";
	}

	public getPrimarySocket(userId: string) {
		const set = this.socketsByUserId.get(userId);
		if (!set || set.size === 0) {
			return null;
		}
		return [...set][0];
	}

	public getSockets(userId: string) {
		return [...(this.socketsByUserId.get(userId) ?? new Set<AuthenticatedSocket>())];
	}

	public hasConnectedSocket(userId: string) {
		return this.getSockets(userId).length > 0;
	}
}
