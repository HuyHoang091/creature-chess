import { all, SagaGenerator } from "typed-redux-saga";

import { getVariable } from "@shoki/engine";

import { PlayerEntity } from "../../entities";
import { CreepMatch } from "../../game/creepRound";
import { Match } from "../../game/match";
import { PlayerVariables } from "./playerVariables";

export const getMatch = () =>
	getVariable<PlayerVariables, Match | CreepMatch>((variables) => variables.match!);

export const getMatches = function* (players: PlayerEntity[]) {
	const promises = players.map((p) =>
		p
			.runSaga(function* () {
				return yield* getMatch();
			})
			.toPromise<Match | CreepMatch>()
	);

	return yield* all(promises) as SagaGenerator<(Match | CreepMatch)[]>;
};
