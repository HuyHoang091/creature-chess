export class VoiceChatManager {
    // userId -> channelId (users currently active in voice chat)
    private userToChannel = new Map<string, string>();
    // channelId -> Set<userId> (users active in each channel)
    private channelToUsers = new Map<string, Set<string>>();
    // channelId -> Set<userId> (users authorized to join – survives room dissolution)
    private authorizedByChannel = new Map<string, Set<string>>();

    /** Authorize a set of users for a channel (call before dissolving the room). */
    public authorizeChannel(channelId: string, userIds: string[]): void {
        if (!this.authorizedByChannel.has(channelId)) {
            this.authorizedByChannel.set(channelId, new Set());
        }
        for (const userId of userIds) {
            this.authorizedByChannel.get(channelId)!.add(userId);
        }
    }

    /** Check if a user is authorized for a channel. */
    public isAuthorized(userId: string, channelId: string): boolean {
        return this.authorizedByChannel.get(channelId)?.has(userId) ?? false;
    }

    /**
     * Join a voice channel.
     * @returns list of existing active peers (before this user joined)
     */
    public join(userId: string, channelId: string): string[] {
        // Leave any current channel first
        this.leave(userId);

        let peers = this.channelToUsers.get(channelId);
        if (!peers) {
            peers = new Set<string>();
            this.channelToUsers.set(channelId, peers);
        }

        const existingPeers = [...peers];
        peers.add(userId);
        this.userToChannel.set(userId, channelId);

        return existingPeers;
    }

    /** Leave voice channel. Returns the channel ID and remaining active peers. */
    public leave(userId: string): { channelId: string | null; remainingPeers: string[] } {
        const channelId = this.userToChannel.get(userId);
        if (!channelId) {
            return { channelId: null, remainingPeers: [] };
        }

        const peers = this.channelToUsers.get(channelId);
        if (peers) {
            peers.delete(userId);
            if (peers.size === 0) {
                this.channelToUsers.delete(channelId);
            }
        }
        this.userToChannel.delete(userId);

        return {
            channelId,
            remainingPeers: peers ? [...peers] : [],
        };
    }

    /** Get the channel a user is currently active in. */
    public getChannelForUser(userId: string): string | null {
        return this.userToChannel.get(userId) ?? null;
    }

    /**
     * Check if two users can signal each other.
     * They must be active in the same channel.
     */
    public canSignal(fromUserId: string, toUserId: string): boolean {
        const ch1 = this.userToChannel.get(fromUserId);
        const ch2 = this.userToChannel.get(toUserId);
        return !!ch1 && ch1 === ch2;
    }

    /** Remove a user's authorization and active state (e.g., permanent disconnect). */
    public cleanupUser(userId: string): void {
        this.leave(userId);
        for (const [channelId, authorized] of this.authorizedByChannel) {
            authorized.delete(userId);
            if (authorized.size === 0) {
                this.authorizedByChannel.delete(channelId);
            }
        }
    }
}
