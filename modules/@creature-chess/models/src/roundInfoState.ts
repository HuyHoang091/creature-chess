import { GamePhase } from "./game-phase";
import { RoundType } from "./roundType";

export type RoundInfoState = {
	round: number;
	phase: GamePhase;
	phaseStartedAtSeconds: number;
	isOvertime?: boolean;
	roundType?: RoundType;
};
