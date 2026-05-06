import * as React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";
import { GAME_PHASE_LENGTHS } from "@creature-chess/models/config";

import { Countdown } from "../ui/countdown";

const renderPhaseInfoCountdown = (secondsRemaining: number) => (
	<span>({secondsRemaining})</span>
);

export function PhaseTimer() {
	const phase = useSelector<AppState, GamePhase | null>(
		(state) => state.game.roundInfo.phase
	);
	const phaseStartedAtSeconds = useSelector<AppState, number | null>(
		(state) => state.game.roundInfo.phaseStartedAtSeconds
	);
	const isDead = useSelector<AppState, boolean>(
		(state) => state.game.playerInfo.health === 0
	);

	const isOvertime = useSelector<AppState, boolean>(
		(state) => !!state.game.roundInfo.isOvertime
	);

	if (isDead) {
		return <span>GAME OVER</span>;
	}

	if (phase === null || !phaseStartedAtSeconds) {
		return null;
	}

	const phaseEndTime = GAME_PHASE_LENGTHS[phase] + phaseStartedAtSeconds;

	return (
		<span style={{ 
			display: 'flex', 
			alignItems: 'center', 
			gap: '8px',
			color: isOvertime ? '#ff1744' : 'inherit',
			fontWeight: isOvertime ? 'bold' : 'normal',
			textShadow: isOvertime ? '0 0 5px rgba(255, 23, 68, 0.8)' : 'none',
			animation: isOvertime ? 'pulseRed 1s infinite' : 'none'
		}}>
			<style>{`
				@keyframes pulseRed {
					0% { transform: scale(1); }
					50% { transform: scale(1.1); color: #d50000; }
					100% { transform: scale(1); }
				}
			`}</style>
			{isOvertime && <span>☠️ SUDDEN DEATH: </span>}
			<Countdown
				countdownToSeconds={phaseEndTime}
				render={renderPhaseInfoCountdown}
			/>
		</span>
	);
}
