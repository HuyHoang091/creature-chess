import * as React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { PlayerMatchRewards } from "@creature-chess/gamemode";

import { PlayerAvatar, Title, PlayerHealthbar } from "~/components/ui/player";
import { PositionChip } from "~/components/ui/player/PositionChip";
import { BalanceIcon } from "~/components/ui/icon/BalanceIcon";
import { LevelIcon } from "~/components/ui/icon/LevelIcon";

import { MatchIncomeReport } from "../../MatchIncomeReport";
import { StreakIndicator } from "../../playerList";
import { QuickChatBox } from "./quickChat/quickChatBox";
import { QuickChatButtonArray } from "./quickChat/quickChatButtonArray";

import overlayStyles from "./Overlays.module.css";
import styles from "./MatchRewardsOverlay.module.css";

export function MatchRewardsOverlay() {
	const opponent = useSelector((state: AppState) => {
		const id = state.game.playerInfo.opponentId;
		return state.game.playerList.find((p) => p.id === id);
	});

	const matchRewards = useSelector<AppState, PlayerMatchRewards | null>(
		(state) => state.game.playerInfo.matchRewards
	);
	const victoryOverlayShowing = useSelector<AppState, boolean>(
		(state) => state.game.ui.winnerId !== null
	);
	const spectatingPlayer = useSelector<AppState, boolean>(
		(state) => state.game.spectating.id !== null
	);

	const opponentPosition = useSelector((state: AppState) =>
		opponent ? state.game.playerList.indexOf(opponent) + 1 : null
	);

	if (!matchRewards || victoryOverlayShowing || spectatingPlayer) {
		return null;
	}

	const { damage, justDied } = matchRewards;

	const title = justDied
		? "Game Over!"
		: damage > 0
			? "Match Lost!"
			: "Match Won!";

	return (
		<div className={overlayStyles.overlayContainer}>
			<div className={overlayStyles.overlayContent} style={{ maxWidth: 'min(500px, 90vw)', width: '100%', padding: '0', background: '#333c57', border: 'none', height: 'min(80vh, 600px)', display: 'flex', flexDirection: 'column' }}>
				<div className={styles.root}>
					<div className={styles.wrapper}>
						<div className={styles.title}>
							{title} <div className={styles.desktopOnly}>vs</div>
						</div>
						{!justDied && opponent && opponentPosition && (
							<>
								<div className={styles.vsHeader}>vs.</div>
								<div className={styles.opponent}>
									<div className={styles.playerAvatar}>
										<PlayerAvatar player={opponent} />
										<QuickChatBox sendingPlayerId={opponent.id} />
									</div>
									<div className={styles.playerDetails}>
										<div className={styles.nameWrapper}>
											<span className={styles.playerName}>{opponent.name}</span>
											<div className={styles.tags}>
												<PositionChip position={opponentPosition} />
											</div>
										</div>
										<Title title={opponent.profile?.title || null} />
										<PlayerHealthbar health={opponent.health} />
										<div className={styles.badges}>
											<StreakIndicator
												type={opponent.streakType}
												amount={opponent.streakAmount}
											/>
											<BalanceIcon amount={opponent.money} />
											<LevelIcon amount={opponent.level} />
										</div>
									</div>
								</div>
							</>
						)}
						<div className={styles.outcomes}>
							{!justDied && (
								<>
									{damage > 0 && (
										<div className={styles.damage}>
											<span>{damage} health lost!</span>
										</div>
									)}
									<MatchIncomeReport
										rewards={matchRewards}
										className={styles.income}
									/>
								</>
							)}
							{justDied && (
								<div className={styles.deathMessage}>
									<p>You have been knocked out of this game.</p>
									<p>
										I hope you enjoyed yourself! -{" "}
										<span className={styles.jkm}>JKM</span>
									</p>
									<p className={styles.spectateReminder}>
										Open the Player List and click a name to continue spectating.
									</p>
								</div>
							)}
						</div>
					</div>
					{!justDied &&<QuickChatButtonArray />}
				</div>
			</div>
		</div>
	);
}
