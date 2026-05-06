import { doDelete } from "./delete";
import { doHit } from "./hit";
import { doMove } from "./move";
import { doSkill } from "./skill";
import { ActionHandler } from "./types";

export type { MoveAction, PieceAction, SkillAction } from "./types";

export const actionFunctions: { [key: string]: ActionHandler } = {
	move: doMove as ActionHandler,
	delete: doDelete as ActionHandler,
	hit: doHit as ActionHandler,
	skill: doSkill as ActionHandler,
};
