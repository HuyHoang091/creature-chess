import * as React from "react";

import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useSelector } from "react-redux";
import { useVoiceChat } from "~/services/voiceChat";
import { useSetting } from "~/settings";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { DebugBar } from "./DebugBar";
import { PhaseTimer } from "./PhaseTimer";
import styles from "./TopBar.module.css";
import { ReadyUpButton } from "./board/overlays/ReadyUpButton";

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

	const {
		isAvailable: vcAvailable,
		micEnabled,
		speakerEnabled,
		toggleMic,
		toggleSpeaker,
	} = useVoiceChat();

	const getPhaseClass = () => {
		if (phase === GamePhase.PREPARING) {
			return styles.phasePreparing;
		}
		if (phase === GamePhase.READY) {
			return styles.phaseReady;
		}
		if (phase === GamePhase.PLAYING) {
			return styles.phasePlaying;
		}
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
				{/* Voice chat buttons – only visible when in a private room / game-from-room */}
				{vcAvailable && (
					<>
						<button
							className={`${styles.iconButton} ${micEnabled ? styles.iconButtonVoiceOn : styles.iconButtonVoiceOff}`}
							title={micEnabled ? "Tắt mic" : "Bật mic"}
							onClick={() => toggleMic().catch(console.error)}
						>
							{micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
						</button>
						<button
							className={`${styles.iconButton} ${speakerEnabled ? styles.iconButtonVoiceOn : styles.iconButtonVoiceOff}`}
							title={speakerEnabled ? "Tắt loa" : "Bật loa"}
							onClick={toggleSpeaker}
						>
							{speakerEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
						</button>
						<span className={styles.divider} />
					</>
				)}

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
