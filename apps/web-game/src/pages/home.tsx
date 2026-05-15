import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Sword, Users, Clock, Trophy } from "lucide-react";

import { openConnection } from "~/services";
import { AppShellCommands } from "~/store/appShell/state";
import { AppState } from "~/store/state";

import styles from "./HomePage.module.css";

export const HomePage = () => {
	const dispatch = useDispatch();
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const profile = useSelector((state: AppState) => state.profile.currentUser);
	const history = useSelector((state: AppState) => state.history.items);

	return (
		<div className={styles.root}>
			{/* Ambient decoration */}
			<div className={styles.glow} />

			{/* Center Cinematic Area */}
			<div className={styles.center}>
				<img
					src={`${APP_IMAGE_ROOT}/ui/logo.png`}
					alt="Creature Chess"
					className={styles.bigLogo}
					onError={(e) => {
						(e.target as HTMLImageElement).style.display = "none";
					}}
				/>

				<button
					className={styles.playBtn}
					onClick={() => dispatch(openConnection())}
				>
					<Sword size={28} />
					<span>{authMode === "guest" ? "QUICK MATCH" : "FIND MATCH"}</span>
				</button>

				<div className={styles.subActions}>
					<button
						className={styles.subBtn}
						onClick={() =>
							authMode === "account"
								? dispatch(AppShellCommands.setScreen("private-lobby"))
								: dispatch(AppShellCommands.setModal("signin-required"))
						}
					>
						<Users size={16} />
						Custom Room
					</button>
				</div>
			</div>

			{/* Bottom Stats Bar */}
			<div className={styles.statsBar}>
				<div className={styles.stat}>
					<Trophy size={16} />
					<span className={styles.statValue}>{profile?.stats?.wins || 0}</span>
					<span className={styles.statLabel}>Wins</span>
				</div>
				<div className={styles.statDivider} />
				<div className={styles.stat}>
					<Sword size={16} />
					<span className={styles.statValue}>{profile?.stats?.gamesPlayed || 0}</span>
					<span className={styles.statLabel}>Games</span>
				</div>
				<div className={styles.statDivider} />
				<div className={styles.stat}>
					<Clock size={16} />
					<span className={styles.statValue}>
						{history.length > 0
							? new Date(history[0].endedAt).toLocaleDateString()
							: "—"}
					</span>
					<span className={styles.statLabel}>Last Match</span>
				</div>
			</div>
		</div>
	);
};
