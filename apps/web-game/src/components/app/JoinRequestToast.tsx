import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, X, Loader2 } from "lucide-react";

import { socialEmit } from "~/services/socialSocket";
import { NotificationCommands } from "~/store/notifications/state";
import { PrivateLobbyCommands } from "~/store/privateLobby/state";
import { JoinRequestToastCommands } from "~/store/joinRequestToasts/state";
import { AppState } from "~/store/state";

import styles from "./JoinRequestToast.module.css";

export const JoinRequestToast = ({
	id,
	requestId,
	requesterNickname,
	createdAt,
	durationMs,
}: {
	id: string;
	requestId: string;
	requesterNickname: string;
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
		dispatch(JoinRequestToastCommands.removeJoinRequestToast(id));
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
				dispatch(
					NotificationCommands.pushNotification({
						id,
						message: `${requesterNickname} is requesting to join your room`,
					})
				);
				dismiss();
				return;
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
	}, [createdAt, durationMs, dismiss, dispatch, id, requesterNickname]);

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
			await socialEmit("roomJoinRequestAccept", {
				requestId,
			});
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
			await socialEmit("roomJoinRequestDecline", { requestId });
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
					{requesterNickname[0]?.toUpperCase() ?? "?"}
				</div>
			</div>

			<div className={styles.body}>
				<div className={styles.title}>{requesterNickname}</div>
				<div className={styles.sub}>is requesting to join</div>
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
