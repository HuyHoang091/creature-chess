import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { GamePhase, RoundInfoState, RoundType } from "@creature-chess/models";

const initialState: RoundInfoState = {
	round: 1,
	phase: GamePhase.PREPARING,
	phaseStartedAtSeconds: 0,
};

export const {
	reducer,
	actions: { setRoundInfoCommand },
} = createSlice({
	name: "roundInfo",
	initialState,
	reducers: {
		setRoundInfoCommand: (
			state,
			command: PayloadAction<{
				phase: GamePhase;
				startedAt: number;
				round?: number;
				isOvertime?: boolean;
				roundType?: RoundType;
			}>
		) => {
			if (command.payload.round) {
				return {
					...state,
					phase: command.payload.phase,
					phaseStartedAtSeconds: Math.floor(command.payload.startedAt),
					round: command.payload.round,
					isOvertime: command.payload.isOvertime,
					roundType: command.payload.roundType,
				};
			}

			return {
				...state,
				phase: command.payload.phase,
				phaseStartedAtSeconds: Math.floor(command.payload.startedAt),
				isOvertime: command.payload.isOvertime,
				roundType: command.payload.roundType ?? state.roundType,
			};
		},
	},
});

export type SetRoundInfoCommand = ReturnType<typeof setRoundInfoCommand>;

const RoundInfoCommands = { setRoundInfoCommand };

export { RoundInfoCommands };
