import { CreepMatch } from "../../game/creepRound";
import { Match } from "../../game/match";

export type PlayerVariables = {
	match: Match | CreepMatch | null;
};

export const defaultPlayerVariables = (): PlayerVariables => ({ match: null });
