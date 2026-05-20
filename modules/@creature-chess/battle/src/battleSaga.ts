import { takeLatest, select, put, call, all } from "@redux-saga/core/effects";

import { BoardState, BoardSlice } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";
import { GamemodeSettings } from "@creature-chess/models/settings";

import {
	pauseBattleCommand,
	resumeBattleCommand,
	startBattleCommand,
	overtimeBattleCommand,
	stopBattleCommand,
} from "./commands";
import { battleFinishEvent, battleTurnEvent, exposeStoreEvent } from "./events";
import { simulateTurn } from "./simulator";
import { PieceCombatState } from "./state/state";
import { pieceInfoStore } from "./state/store";
import { duration } from "./utils/duration";
import { buildBattleModifiersForBoard } from "./utils/elementSynergies";
import { getStats } from "./utils/getStats";
import { isATeamDefeated } from "./utils/isATeamDefeated";

const runBattle = function* (
	controls: { paused: boolean; isOvertime: boolean },
	initialBoard: BoardState<PieceModel>,
	boardSlice: BoardSlice<PieceModel>,
	startingTurn: number,
	settings: GamemodeSettings
) {
	const battleModifiersByPiece = buildBattleModifiersForBoard(initialBoard);

	let board: BoardState<PieceModel> = {
		id: initialBoard.id,
		pieces: Object.fromEntries(
			Object.entries(initialBoard.pieces).map(([id, piece]) => {
				const pieceWithModifiers: PieceModel = {
					...piece,
					battleModifiers: battleModifiersByPiece.get(id),
				};
				const stats = getStats(pieceWithModifiers);
				return [
					id,
					{
						...pieceWithModifiers,
						maxHealth: stats.hp,
						currentHealth: stats.hp, // Reset health to full at battle start (includes item bonus)
						currentMana: Math.min(
							stats.startingMana,
							pieceWithModifiers.maxMana || 100
						), // Set starting mana from items and traits
						visualEffects: [],
						statusEffects: [],
						lastBattleStats: {
							damageDealt: 0,
							damageTaken: 0,
							turnsSurvived: 0,
						},
					},
				];
			})
		),
		piecePositions: {
			...initialBoard.piecePositions,
		},
		locked: initialBoard.locked,
		size: initialBoard.size,
		pieceLimit: null,
	};

	let turnCount = startingTurn;

	const combatStore = pieceInfoStore<PieceCombatState>({
		state: { type: "wandering" },

		canMoveAtTurn: 15,
		canBeAttackedAtTurn: 0,
		canAttackAtTurn: 15,
		reviveUsed: false,
		slowUntilTurn: 0,
	});

	Object.keys(board.pieces).forEach((pieceId) => {
		combatStore.updatePiece(pieceId, {
			state: { type: "wandering" },
			canMoveAtTurn: 15,
			canBeAttackedAtTurn: 0,
			canAttackAtTurn: 15,
			reviveUsed: false,
			slowUntilTurn: 0,
		});
	});

	/**
	 * TODO (jkm) come up with a better way to expose the store
	 * https://redux.js.org/faq/actions#why-should-type-be-a-string-or-at-least-serializable-why-should-my-action-types-be-constants
	 */
	yield put(exposeStoreEvent({ stores: { combat: combatStore } }));

	while (true) {
		const shouldStop =
			turnCount >= settings.battleTurnCount ||
			isATeamDefeated(board, { combatStore });

		if (shouldStop) {
			yield duration(1000).remaining().promise;

			yield put(battleFinishEvent({ turn: turnCount }));
			break;
		}

		while (controls.paused) {
			yield duration(1000).remaining().promise;
		}

		const turnDuration = controls.isOvertime
			? Math.floor(settings.battleTurnDuration / 3)
			: settings.battleTurnDuration;

		const turnTimer = duration(turnDuration);

		board = simulateTurn(++turnCount, board, boardSlice, { combatStore });
		const { ms, promise } = turnTimer.remaining();

		yield put(
			battleTurnEvent({
				turn: turnCount,
				board,
				timeMs: turnDuration - ms,
			})
		);

		yield promise;
	}
};

export const battleSaga = function* (
	boardSelector: (state: any) => BoardState<PieceModel>,
	settings: GamemodeSettings,
	boardSlice: BoardSlice<PieceModel>
) {
	yield takeLatest(
		[startBattleCommand.toString(), stopBattleCommand.toString()],
		function* (action: any) {
			if (action.type === stopBattleCommand.toString()) {
				return;
			}

			const { turn, isOvertime } = action.payload;
			const board: BoardState<PieceModel> = yield select(boardSelector);

			const controls = { paused: false, isOvertime: isOvertime ?? false };

			yield all([
				takeLatest(pauseBattleCommand, function* () {
					controls.paused = true;
				}),
				takeLatest(resumeBattleCommand, function* () {
					controls.paused = false;
				}),
				takeLatest(overtimeBattleCommand, function* () {
					controls.isOvertime = true;
				}),
				call(runBattle, controls, board, boardSlice, turn || 0, settings),
			]);
		}
	);
};
