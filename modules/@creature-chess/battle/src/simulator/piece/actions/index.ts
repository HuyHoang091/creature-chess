import { doDelete } from "./delete";
import { doHit } from "./hit";
import { doMove } from "./move";
import { doRevive } from "./revive";
import { doSkill } from "./skill";
import { ActionHandler } from "./types";

export type { MoveAction, PieceAction, SkillAction } from "./types";

export const actionFunctions: { [key: string]: ActionHandler } = {
	move: doMove as ActionHandler,
	delete: doDelete as ActionHandler,
	hit: doHit as ActionHandler,
	skill: doSkill as ActionHandler,
	revive: doRevive as ActionHandler,
};
