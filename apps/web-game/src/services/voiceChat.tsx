import * as React from "react";

import { useSelector } from "react-redux";
import { Socket } from "socket.io-client";
import { AppState } from "~/store/state";

import { getCurrentSocket } from "./socket";

const ICE_SERVERS: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun1.l.google.com:19302" },
];

const SESSION_KEY = "voiceChat:channelId";

export type VoiceChatContextValue = {
	isAvailable: boolean;
	isJoined: boolean;
	micEnabled: boolean;
	speakerEnabled: boolean;
	activePeerCount: number;
	toggleMic: () => Promise<void>;
	toggleSpeaker: () => void;
};

const defaultCtx: VoiceChatContextValue = {
	isAvailable: false,
	isJoined: false,
	micEnabled: false,
	speakerEnabled: true,
	activePeerCount: 0,
	toggleMic: async () => {
		/* noop default */
	},
	toggleSpeaker: () => {
		/* noop default */
	},
};

export const VoiceChatContext =
	React.createContext<VoiceChatContextValue>(defaultCtx);

export const useVoiceChat = () => React.useContext(VoiceChatContext);

export const VoiceChatProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const room = useSelector((state: AppState) => state.privateLobby.room);

	// Refs – stable across renders, no stale closure issues
	const channelIdRef = React.useRef<string | null>(null);
	const socketRef = React.useRef<Socket | null>(null);
	const peerConnectionsRef = React.useRef(new Map<string, RTCPeerConnection>());
	const localStreamRef = React.useRef<MediaStream | null>(null);
	const remoteAudiosRef = React.useRef(new Map<string, HTMLAudioElement>());
	const isJoinedRef = React.useRef(false);
	const micEnabledRef = React.useRef(false);
	const speakerEnabledRef = React.useRef(true);

	// UI state
	const [isAvailable, setIsAvailable] = React.useState(false);
	const [isJoined, setIsJoined] = React.useState(false);
	const [micEnabled, setMicEnabled] = React.useState(false);
	const [speakerEnabled, setSpeakerEnabled] = React.useState(true);
	const [activePeerCount, setActivePeerCount] = React.useState(0);

	// ── internal join ────────────────────────────────────────────────────────

	const doAutoJoin = React.useCallback((socket: Socket) => {
		if (isJoinedRef.current) {
			return;
		}
		const chId = channelIdRef.current ?? sessionStorage.getItem(SESSION_KEY);
		if (!chId) {
			return;
		}
		socket.emit("voiceChat:join", { channelId: chId });
	}, []);

	// ── peer connection helper ───────────────────────────────────────────────

	const getOrCreatePeerConnection = React.useCallback(
		(peerId: string): RTCPeerConnection => {
			const existing = peerConnectionsRef.current.get(peerId);
			if (existing && existing.signalingState !== "closed") {
				return existing;
			}

			const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

			// Add local tracks if we already have a stream
			if (localStreamRef.current) {
				for (const track of localStreamRef.current.getTracks()) {
					pc.addTrack(track, localStreamRef.current);
				}
			}

			// Receive remote audio – create/update element immediately and honour speaker state
			pc.ontrack = (event) => {
				let audio = remoteAudiosRef.current.get(peerId);
				if (!audio) {
					audio = document.createElement("audio");
					audio.autoplay = true;
					document.body.appendChild(audio);
					remoteAudiosRef.current.set(peerId, audio);
				}
				audio.srcObject = event.streams[0] ?? null;
				// Apply current speaker state immediately – this was the core bug
				audio.muted = !speakerEnabledRef.current;
				// Browsers block autoplay without user gesture; play() after user interaction
				audio.play().catch(() => {
					/* ignored – autoplay policy */
				});
			};

			pc.onicecandidate = (event) => {
				if (event.candidate) {
					socketRef.current?.emit("voiceChat:ice", {
						targetUserId: peerId,
						candidate: event.candidate.toJSON(),
					});
				}
			};

			pc.onconnectionstatechange = () => {
				if (
					pc.connectionState === "failed" ||
					pc.connectionState === "closed"
				) {
					peerConnectionsRef.current.delete(peerId);
					setActivePeerCount(peerConnectionsRef.current.size);
				}
			};

			peerConnectionsRef.current.set(peerId, pc);
			return pc;
		},
		[]
	);

	// ── socket event handlers ────────────────────────────────────────────────

	const handleMembers = React.useCallback(
		async ({ channelId, peers }: { channelId: string; peers: string[] }) => {
			channelIdRef.current = channelId;
			sessionStorage.setItem(SESSION_KEY, channelId);

			isJoinedRef.current = true;
			setIsJoined(true);
			setActivePeerCount(peers.length);

			// New joiner creates offers to all existing peers
			for (const peerId of peers) {
				const pc = getOrCreatePeerConnection(peerId);
				try {
					const offer = await pc.createOffer({ offerToReceiveAudio: true });
					await pc.setLocalDescription(offer);
					socketRef.current?.emit("voiceChat:offer", {
						targetUserId: peerId,
						sdp: pc.localDescription,
					});
				} catch (err) {
					console.error("[VoiceChat] Failed to create offer to", peerId, err);
				}
			}
		},
		[getOrCreatePeerConnection]
	);

	const handlePeerJoined = React.useCallback((_payload: { peerId: string }) => {
		// Existing member: the new peer will initiate, just update count
		setActivePeerCount((prev) => prev + 1);
	}, []);

	const handlePeerLeft = React.useCallback(({ peerId }: { peerId: string }) => {
		const pc = peerConnectionsRef.current.get(peerId);
		if (pc) {
			pc.close();
			peerConnectionsRef.current.delete(peerId);
		}
		const audio = remoteAudiosRef.current.get(peerId);
		if (audio) {
			audio.srcObject = null;
			audio.remove();
			remoteAudiosRef.current.delete(peerId);
		}
		setActivePeerCount(peerConnectionsRef.current.size);
	}, []);

	const handleOffer = React.useCallback(
		async ({
			fromId,
			sdp,
		}: {
			fromId: string;
			sdp: RTCSessionDescriptionInit;
		}) => {
			const pc = getOrCreatePeerConnection(fromId);
			try {
				await pc.setRemoteDescription(new RTCSessionDescription(sdp));
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				socketRef.current?.emit("voiceChat:answer", {
					targetUserId: fromId,
					sdp: pc.localDescription,
				});
			} catch (err) {
				console.error("[VoiceChat] Failed to handle offer from", fromId, err);
			}
		},
		[getOrCreatePeerConnection]
	);

	const handleAnswer = React.useCallback(
		async ({
			fromId,
			sdp,
		}: {
			fromId: string;
			sdp: RTCSessionDescriptionInit;
		}) => {
			const pc = peerConnectionsRef.current.get(fromId);
			if (!pc) {
				return;
			}
			try {
				await pc.setRemoteDescription(new RTCSessionDescription(sdp));
			} catch (err) {
				console.error("[VoiceChat] Failed to handle answer from", fromId, err);
			}
		},
		[]
	);

	const handleIce = React.useCallback(
		async ({
			fromId,
			candidate,
		}: {
			fromId: string;
			candidate: RTCIceCandidateInit;
		}) => {
			const pc = peerConnectionsRef.current.get(fromId);
			if (!pc) {
				return;
			}
			try {
				await pc.addIceCandidate(new RTCIceCandidate(candidate));
			} catch (err) {
				console.error(
					"[VoiceChat] Failed to add ICE candidate from",
					fromId,
					err
				);
			}
		},
		[]
	);

	const handleChannelReady = React.useCallback(
		({ channelId }: { channelId: string }) => {
			channelIdRef.current = channelId;
			sessionStorage.setItem(SESSION_KEY, channelId);
			setIsAvailable(true);
		},
		[]
	);

	// ── socket polling – attaches handlers and auto-joins ───────────────────

	React.useEffect(() => {
		let activeSocket: Socket | null = null;

		const attach = (s: Socket) => {
			s.on("voiceChat:members", handleMembers);
			s.on("voiceChat:peer-joined", handlePeerJoined);
			s.on("voiceChat:peer-left", handlePeerLeft);
			s.on("voiceChat:offer", handleOffer);
			s.on("voiceChat:answer", handleAnswer);
			s.on("voiceChat:ice", handleIce);
			s.on("voiceChat:channelReady", handleChannelReady);
		};

		const detach = (s: Socket) => {
			s.off("voiceChat:members", handleMembers);
			s.off("voiceChat:peer-joined", handlePeerJoined);
			s.off("voiceChat:peer-left", handlePeerLeft);
			s.off("voiceChat:offer", handleOffer);
			s.off("voiceChat:answer", handleAnswer);
			s.off("voiceChat:ice", handleIce);
			s.off("voiceChat:channelReady", handleChannelReady);
		};

		const poll = () => {
			const s = getCurrentSocket();
			if (s !== activeSocket) {
				if (activeSocket) {
					detach(activeSocket);
				}
				activeSocket = s;
				socketRef.current = s;
				if (s) {
					attach(s);
					// Auto-join whenever a (new) socket connects and we have a channel
					doAutoJoin(s);
				}
			}
		};

		poll();
		const id = setInterval(poll, 1000);
		return () => {
			clearInterval(id);
			if (activeSocket) {
				detach(activeSocket);
			}
		};
	}, [
		handleMembers,
		handlePeerJoined,
		handlePeerLeft,
		handleOffer,
		handleAnswer,
		handleIce,
		handleChannelReady,
		doAutoJoin,
	]);

	// ── availability + auto-join when room becomes known ─────────────────────

	React.useEffect(() => {
		if (room?.id) {
			channelIdRef.current = room.id;
			setIsAvailable(true);
			// Auto-join if socket is already connected
			if (socketRef.current) {
				doAutoJoin(socketRef.current);
			}
		}
		// Note: intentionally NOT clearing when room becomes null (channel persists into game)
	}, [room?.id, doAutoJoin]);

	// Restore channelId from sessionStorage on mount (reconnect after page reload)
	React.useEffect(() => {
		const stored = sessionStorage.getItem(SESSION_KEY);
		if (stored) {
			channelIdRef.current = stored;
			setIsAvailable(true);
			// Socket likely not ready yet – the polling interval will call doAutoJoin
		}
	}, []);

	// ── public actions ───────────────────────────────────────────────────────

	/**
	 * Toggle microphone.
	 * On first enable, requests getUserMedia and adds the track to all peer connections.
	 * Subsequent calls simply enable/disable the audio track.
	 */
	const toggleMic = React.useCallback(async () => {
		// Acquire mic stream on first use
		if (!localStreamRef.current) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: false,
				});
				for (const track of stream.getAudioTracks()) {
					track.enabled = false; // off by default
				}
				localStreamRef.current = stream;

				// Add track to all existing peer connections and renegotiate
				for (const [peerId, pc] of peerConnectionsRef.current) {
					for (const track of stream.getTracks()) {
						try {
							pc.addTrack(track, stream);
						} catch {
							/* already added */
						}
					}
					if (pc.signalingState === "stable") {
						try {
							const offer = await pc.createOffer();
							await pc.setLocalDescription(offer);
							socketRef.current?.emit("voiceChat:offer", {
								targetUserId: peerId,
								sdp: pc.localDescription,
							});
						} catch {
							/* ignore renegotiation errors */
						}
					}
				}
			} catch (err) {
				console.warn("[VoiceChat] Mic access denied:", err);
				return; // Can't enable mic without stream
			}
		}

		const newVal = !micEnabledRef.current;
		micEnabledRef.current = newVal;
		setMicEnabled(newVal);
		if (localStreamRef.current) {
			for (const track of localStreamRef.current.getAudioTracks()) {
				track.enabled = newVal;
			}
		}
	}, []);

	/**
	 * Toggle speaker (mute/unmute all remote audio).
	 * Simple toggle – no join logic needed since joining is now automatic.
	 */
	const toggleSpeaker = React.useCallback(() => {
		const newVal = !speakerEnabledRef.current;
		speakerEnabledRef.current = newVal;
		setSpeakerEnabled(newVal);
		for (const [, audio] of remoteAudiosRef.current) {
			audio.muted = !newVal;
		}
	}, []);

	// ── cleanup ──────────────────────────────────────────────────────────────

	React.useEffect(
		() => () => {
			// eslint-disable-next-line react-hooks/exhaustive-deps
			const pcs = peerConnectionsRef.current;
			// eslint-disable-next-line react-hooks/exhaustive-deps
			const audios = remoteAudiosRef.current;

			for (const [, pc] of pcs) {
				pc.close();
			}
			pcs.clear();

			for (const [, audio] of audios) {
				audio.srcObject = null;
				audio.remove();
			}
			audios.clear();

			if (localStreamRef.current) {
				for (const track of localStreamRef.current.getTracks()) {
					track.stop();
				}
			}

			socketRef.current?.emit("voiceChat:leave");
		},
		[]
	);

	const value: VoiceChatContextValue = {
		isAvailable,
		isJoined,
		micEnabled,
		speakerEnabled,
		activePeerCount,
		toggleMic,
		toggleSpeaker,
	};

	return (
		<VoiceChatContext.Provider value={value}>
			{children}
		</VoiceChatContext.Provider>
	);
};
