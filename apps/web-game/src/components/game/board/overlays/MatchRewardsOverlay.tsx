import * as React from "react";
import { createPortal } from "react-dom";

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

let dismissedMatchRewardsKey: string | null = null;

export function MatchRewardsOverlay() {
	const round = useSelector<AppState, number>((state) => state.game.roundInfo.round);
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
	const [, forceUpdate] = React.useReducer((value) => value + 1, 0);

	if (!matchRewards || victoryOverlayShowing || spectatingPlayer) {
		return null;
	}

	const { damage, justDied } = matchRewards;
	const dismissKey = `${round}:${justDied ? "death" : "summary"}`;

	if (dismissedMatchRewardsKey === dismissKey) {
		return null;
	}

	const title = justDied
		? "Your Run Ends Here"
		: damage > 0
			? "Round Lost"
			: "Round Won";
	const resultLabel = justDied ? "Eliminated" : damage > 0 ? "Defeat" : "Victory";
	const resultTone = justDied
		? styles.resultKo
		: damage > 0
			? styles.resultLoss
			: styles.resultWin;
	const subtitle = justDied
		? "You have been knocked out of the lobby."
		: opponent
			? `Against ${opponent.name}`
			: "Round result";
	const dismissOverlay = () => {
		dismissedMatchRewardsKey = dismissKey;
		forceUpdate();
	};
	const onSpectate = () => dismissOverlay();
	const onMainMenu = () => {
		window.location.href = APP_URL;
	};

	const overlay = (
		<div
			className={`${overlayStyles.overlayContainer} ${styles.matchRewardsContainer}`}
		>
			<div className={styles.root}>
				<div className={styles.panel}>
					<button
						type="button"
						className={styles.closeButton}
						onClick={dismissOverlay}
						aria-label="Close round report"
					>
						x
					</button>
					<div className={styles.header}>
						<div className={`${styles.resultPill} ${resultTone}`}>
							{resultLabel}
						</div>
						<div className={styles.title}>{title}</div>
						<div className={styles.subtitle}>{subtitle}</div>
					</div>

					{!justDied && opponent && opponentPosition && (
						<div className={styles.opponentCard}>
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
					)}

					<div className={styles.outcomes}>
						{!justDied ? (
							<>
								<div
									className={`${styles.damageBanner} ${
										damage > 0 ? styles.damageLoss : styles.damageWin
									}`}
								>
									{damage > 0 ? `-${damage} health` : "No damage taken"}
								</div>

								<div className={styles.incomeCard}>
									<div className={styles.sectionTitle}>Income Breakdown</div>
									<MatchIncomeReport
										rewards={matchRewards}
										className={styles.income}
									/>
								</div>
							</>
						) : (
							<div className={styles.deathCard}>
								<p>You have been knocked out of this game.</p>
								<p>
									I hope you enjoyed yourself.{" "}
									<span className={styles.jkm}>JKM</span>
								</p>
								<p className={styles.spectateReminder}>
									Open the player list and click a name to continue spectating.
								</p>
								<div className={styles.deathActions}>
									<button
										type="button"
										className={`${styles.actionButton} ${styles.actionButtonSpectate}`}
										onClick={onSpectate}
									>
										Spectate
									</button>
									<button
										type="button"
										className={`${styles.actionButton} ${styles.actionButtonExit}`}
										onClick={onMainMenu}
									>
										Main Menu
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{!justDied ? (
					<div className={styles.quickChatWrap}>
						<QuickChatButtonArray />
					</div>
				) : null}
			</div>
		</div>
	);

	if (typeof document === "undefined") {
		return null;
	}

	return createPortal(overlay, document.body);
}
