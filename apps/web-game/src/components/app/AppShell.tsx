import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Settings, Bell } from "lucide-react";

import { Page } from "~/components/Page";
import { AppShellCommands } from "~/store/appShell/state";
import { RoomInviteCommands } from "~/store/roomInvites/state";
import { JoinRequestToastCommands } from "~/store/joinRequestToasts/state";
import { AppState } from "~/store/state";

import { DockBar } from "./DockBar";
import { Panel } from "./Panel";
import { RoomInviteToast } from "./RoomInviteToast";
import { JoinRequestToast } from "./JoinRequestToast";
import { NotificationPanel } from "./NotificationPanel";
import styles from "./AppShell.module.css";

export const AppShell = ({
	children,
	panel,
}: {
	children: React.ReactNode;
	panel?: React.ReactNode;
}) => {
	const dispatch = useDispatch();
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const currentUser = useSelector((state: AppState) => state.profile.currentUser);
	const notifications = useSelector((state: AppState) => state.notifications.items);
	const inviteToasts = useSelector((state: AppState) => state.roomInvites.items);
	const joinRequestToasts = useSelector((state: AppState) => state.joinRequestToasts.items);
	const room = useSelector((state: AppState) => state.privateLobby.room);
	const [panelOpen, setPanelOpen] = React.useState(false);

	useEffect(() => {
		if (room) {
			dispatch(RoomInviteCommands.clearAllInviteToasts());
			dispatch(JoinRequestToastCommands.clearAllJoinRequestToasts());
		}
	}, [room?.id]);

	return (
		<Page hasBackground>
			<div className={styles.shell}>
				{/* Top HUD */}
				<div className={styles.topbar}>
					<div className={styles.identity}>
						<div className={styles.avatar}>
							{(currentUser as any)?.picture ? (
								<img src={(currentUser as any).picture} alt="avatar" />
							) : (
								<div className={styles.avatarFallback}>
									{(currentUser?.nickname?.[0] ?? "G").toUpperCase()}
								</div>
							)}
						</div>
						<div className={styles.identityText}>
							<div className={styles.nickname}>
								{currentUser?.nickname || (authMode === "guest" ? "Guest" : "Player")}
							</div>
							<div className={styles.rank}>Unranked</div>
						</div>
					</div>

					<div className={styles.logoArea}>
						<img
							src={`${APP_IMAGE_ROOT}/ui/logo.png`}
							alt="Creature Chess"
							className={styles.logo}
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = "none";
							}}
						/>
					</div>

					<div className={styles.hudActions}>
						<button
							className={styles.hudIcon}
							title="Notifications"
							onClick={() => setPanelOpen((prev) => !prev)}
						>
							<Bell size={20} />
							{notifications.filter((n) => !n.read).length > 0 && (
								<span className={styles.badge}>
									{notifications.filter((n) => !n.read).length}
								</span>
							)}
						</button>
						<button className={styles.hudIcon} title="Settings">
							<Settings size={20} />
						</button>
					</div>
				</div>

				{/* Main Content */}
				<div className={styles.content}>{children}</div>

				{/* Bottom Dock */}
				<DockBar />

				{/* Room Invite Toasts */}
				{inviteToasts.length > 0 && (
					<div className={styles.inviteToastArea}>
						{inviteToasts.map((item) => (
							<RoomInviteToast
								key={item.id}
								id={item.id}
								inviteId={item.inviteId}
								fromNickname={item.fromNickname}
								createdAt={item.createdAt}
								durationMs={item.durationMs}
							/>
						))}
					</div>
				)}

				{/* Join Request Toasts */}
				{joinRequestToasts.length > 0 && (
					<div className={styles.inviteToastArea} style={{ top: `${76 + inviteToasts.length * 64}px` }}>
						{joinRequestToasts.map((item) => (
							<JoinRequestToast
								key={item.id}
								id={item.id}
								requestId={item.requestId}
								requesterNickname={item.requesterNickname}
								createdAt={item.createdAt}
								durationMs={item.durationMs}
							/>
						))}
					</div>
				)}

				{/* Notification Panel */}
				{panelOpen && <NotificationPanel onClose={() => setPanelOpen(false)} />}

				{/* Panel Overlay */}
				{panel}
			</div>
		</Page>
	);
};
