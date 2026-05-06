import * as React from "react";

import { useSelector } from "react-redux";
import { useSetting } from "~/settings";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { DebugBar } from "./DebugBar";
import { PhaseTimer } from "./PhaseTimer";
import { ReadyUpButton } from "./board/overlays/ReadyUpButton";
import styles from "./TopBar.module.css";

type TopBarTFTProps = {
	onToggleStats?: () => void;
	onOpenSettings?: () => void;
	showingStats?: boolean;
};

const PHASE_LABELS: Record<GamePhase, string> = {
	[GamePhase.PREPARING]: "Preparing",
	[GamePhase.READY]: "Ready",
	[GamePhase.PLAYING]: "Combat",
};

export function TopBarTFT({
	onToggleStats,
	onOpenSettings,
	showingStats,
}: TopBarTFTProps) {
	const showPing = useSetting("showPing");

	const round = useSelector<AppState, number | null>(
		(state) => state.game.roundInfo.round
	);

	const phase = useSelector<AppState, GamePhase | null>(
		(state) => state.game.roundInfo.phase
	);

	const getPhaseClass = () => {
		if (phase === GamePhase.PREPARING) return styles.phasePreparing;
		if (phase === GamePhase.READY) return styles.phaseReady;
		if (phase === GamePhase.PLAYING) return styles.phasePlaying;
		return "";
	};

	return (
		<div className={styles.topBar}>
			<div className={styles.leftSection}>{showPing && <DebugBar />}</div>

			<div className={styles.centerSection}>
				{/* Round number */}
				<span className={styles.roundLabel}>Round {round ?? "-"}</span>

				{/* Phase indicator */}
				{phase !== null && (
					<span className={`${styles.phaseBadge} ${getPhaseClass()}`}>
						{PHASE_LABELS[phase]}
					</span>
				)}

				{/* Timer */}
				<div className={styles.timerBadge}>
					<PhaseTimer />
				</div>
			</div>

			<div className={styles.rightSection}>
				<ReadyUpButton />
				<button
					className={`${styles.iconButton} ${showingStats ? styles.iconButtonActive : ""}`}
					title="Stats"
					onClick={onToggleStats}
				>
					📊
				</button>
				<button
					className={styles.iconButton}
					title="Settings"
					onClick={onOpenSettings}
				>
					⚙
				</button>
			</div>
		</div>
	);
}
