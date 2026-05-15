import * as React from "react";

import { useSelector } from "react-redux";
import { Page } from "~/components/Page";
import { LobbyPlayerBanner } from "~/components/lobby/LobbyPlayerBanner";
import { SettingsMenu } from "~/components/lobby/SettingsMenu";
import { useOpenSettingsMenu } from "~/components/lobby/hooks/useOpenSettingsMenu";
import { Footer } from "~/components/ui/Footer";
import { Countdown } from "~/components/ui/countdown";
import { AppState } from "~/store";

import styles from "./LobbyPage.module.css";

const padNumberToTwo = (val: number) => (val < 10 ? `0${val}` : val.toString());

const countdownRender =
	() => (totalSecondsRemaining: number) => {
		const minutesRemaining = Math.floor(totalSecondsRemaining / 60);
		const secondsRemaining = Math.ceil(totalSecondsRemaining % 60);

		const time = `${minutesRemaining}:${padNumberToTwo(secondsRemaining)}`;

		return (
			<div className={styles.timeRemaining}>
				Game starting in{" "}
				<span className={styles.timeRemainingHighlight}>{time}</span>
			</div>
		);
	};

export function LobbyPage() {
	const lobbyInfo = useSelector((state: AppState) => state.lobby);

	const { targetRef: finalPlayerRef, menuOpen } = useOpenSettingsMenu();

	const playerItems = React.useMemo(() => {
		if (!lobbyInfo) {
			return [];
		}

		const output: React.ReactNode[] = [];

		for (let i = 0; i < lobbyInfo.maxPlayers; i++) {
			const player = lobbyInfo.players[i];

			output.push(
				<div
					key={player ? player.id : i}
					className={styles.playerWrapper}
					ref={i === lobbyInfo.maxPlayers - 1 ? finalPlayerRef : undefined}
				>
					<LobbyPlayerBanner player={player ?? null} />
				</div>
			);
		}

		return output;
	}, [lobbyInfo, styles.playerWrapper, finalPlayerRef]);

	if (!lobbyInfo) {
		return null;
	}

	const { startTimestamp, maxPlayers, lobbyWaitTimeSeconds } = lobbyInfo;

	return (
		<Page hasBackground>
			<div className={styles.lobbyInfo}>
				<div className={styles.header}>
					<div className={styles.headerTitle}>Match Lobby</div>
					<div className={styles.headerSub}>{lobbyInfo.players.filter(Boolean).length} / {maxPlayers} players</div>
				</div>

				{startTimestamp && (
					<Countdown
						countdownToSeconds={startTimestamp / 1000}
						render={countdownRender()}
					/>
				)}

				<div className={styles.players}>{playerItems}</div>

				{menuOpen && <SettingsMenu />}
			</div>
		</Page>
	);
}
