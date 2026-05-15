import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, X, Loader2 } from "lucide-react";

import { socialEmit } from "~/services/socialSocket";
import { AppShellCommands } from "~/store/appShell/state";
import { PrivateLobbyCommands } from "~/store/privateLobby/state";
import { RoomInviteCommands } from "~/store/roomInvites/state";
import { AppState } from "~/store/state";

import styles from "./RoomInviteToast.module.css";

export const RoomInviteToast = ({
	id,
	inviteId,
	fromNickname,
	createdAt,
	durationMs,
}: {
	id: string;
	inviteId: string;
	fromNickname: string;
	createdAt: number;
	durationMs: number;
}) => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const [progress, setProgress] = useState(100);
	const [busy, setBusy] = useState<"idle" | "accept" | "decline">("idle");
	const rafRef = useRef<number | null>(null);
	const activeRef = useRef(true);

	const dismiss = useCallback(() => {
		activeRef.current = false;
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		dispatch(RoomInviteCommands.removeInviteToast(id));
	}, [dispatch, id]);

	const stopTimer = useCallback(() => {
		activeRef.current = false;
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	}, []);

	const startTimer = useCallback(() => {
		activeRef.current = true;
		const tick = () => {
			if (!activeRef.current) return;
			const elapsed = Date.now() - createdAt;
			const remaining = Math.max(0, durationMs - elapsed);
			const pct = (remaining / durationMs) * 100;
			setProgress(pct);

			if (remaining <= 0) {
				dismiss();
				return;
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
	}, [createdAt, durationMs, dismiss]);

	useEffect(() => {
		startTimer();
		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [startTimer]);

	const onAccept = async () => {
		if (!token || busy !== "idle") return;
		setBusy("accept");
		stopTimer();
		try {
			const result = await socialEmit<{ room: AppState["privateLobby"]["room"] }>("roomInviteAccept", {
				inviteId,
			});
			dispatch(
				PrivateLobbyCommands.setSnapshot({
					room: result.room,
					invites: [],
				})
			);
			dispatch(AppShellCommands.setScreen("private-lobby"));
			dismiss();
		} catch {
			setBusy("idle");
			startTimer();
		}
	};

	const onDecline = async () => {
		if (!token || busy !== "idle") return;
		setBusy("decline");
		stopTimer();
		try {
			await socialEmit("roomInviteDecline", { inviteId });
			dispatch(PrivateLobbyCommands.removeInvite(inviteId));
			dismiss();
		} catch {
			setBusy("idle");
			startTimer();
		}
	};

	const radius = 18;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - progress / 100);

	return (
		<div className={styles.toast}>
			<div className={styles.ring}>
				<svg className={styles.ringSvg} viewBox="0 0 40 40">
					<circle
						cx="20"
						cy="20"
						r={radius}
						fill="none"
						stroke="rgba(200,170,110,0.15)"
						strokeWidth="2"
					/>
					<circle
						cx="20"
						cy="20"
						r={radius}
						fill="none"
						stroke="#c8aa6e"
						strokeWidth="2"
						strokeLinecap="round"
						strokeDasharray={circumference}
						strokeDashoffset={dashOffset}
						style={{ transition: "stroke-dashoffset 0.1s linear" }}
						transform="rotate(-90 20 20)"
					/>
				</svg>
				<div className={styles.avatarFallback}>
					{fromNickname[0]?.toUpperCase() ?? "?"}
				</div>
			</div>

			<div className={styles.body}>
				<div className={styles.title}>{fromNickname}</div>
				<div className={styles.sub}>invited you to a room</div>
			</div>

			<div className={styles.actions}>
				<button
					className={`${styles.actionBtn} ${styles.accept} ${busy === "accept" ? styles.busy : ""}`}
					onClick={onAccept}
					title="Accept"
					disabled={busy !== "idle"}
				>
					{busy === "accept" ? <Loader2 size={16} className={styles.spin} /> : <Check size={16} />}
				</button>
				<button
					className={`${styles.actionBtn} ${styles.decline} ${busy === "decline" ? styles.busy : ""}`}
					onClick={onDecline}
					title="Decline"
					disabled={busy !== "idle"}
				>
					{busy === "decline" ? <Loader2 size={16} className={styles.spin} /> : <X size={16} />}
				</button>
			</div>
		</div>
	);
};
