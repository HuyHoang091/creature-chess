/**
 * CreepMatch: a PvE match where a player fights against server-generated creep pieces.
 * Similar to Match but the "away" side is creep pieces, not another player.
 */
import {
	Store,
	Reducer,
	UnknownAction,
	configureStore,
} from "@reduxjs/toolkit";
import delay from "delay";
import pDefer from "p-defer";
import createSagaMiddleware from "redux-saga";
import { all, call, takeEvery, takeLatest, put } from "redux-saga/effects";
import { v4 as uuid } from "uuid";
import { Logger } from "winston";

import {
	BoardState,
	createBoardSlice,
	BoardSlice,
	BoardSelectors,
	cloneBoard,
} from "@shoki/board";

import {
	battleSaga,
	BattleEvents,
	BattleCommands,
} from "@creature-chess/battle";
import { battleTurnEvent } from "@creature-chess/battle/src/events";
import { PieceModel, getRandomBaseItem } from "@creature-chess/models";
import { GamemodeSettings } from "@creature-chess/models/settings";

import { PlayerEntity } from "../../entities";
import { PlayerStateSelectors } from "../../entities/player";
import { playerFinishMatchEvent } from "../../entities/player/events";
import { playerInfoCommands } from "../../entities/player/state/playerInfo/reducer";
import { CREEP_OWNER_ID, CreepWave, generateCreepPieces } from "./creepDefinitions";

interface MatchState {
	board: BoardState<PieceModel>;
	turn: number;
}

const turnReducer: Reducer<number, BattleEvents.BattleTurnEvent> = (
	state = 0,
	event
) => (event.type === battleTurnEvent.toString() ? event.payload.turn : state);

export class CreepMatch {
	private store: Store<MatchState>;
	private finalBoard!: BoardState<PieceModel>;
	private boardId = uuid();
	private board: BoardSlice<PieceModel>;

	private serverFinishedMatch = pDefer();
	private clientFinishedMatch = pDefer();

	public constructor(
		public readonly player: PlayerEntity,
		public readonly round: number,
		public readonly creepWave: CreepWave,
		private logger: Logger,
		settings: GamemodeSettings,
		private onTurnComplete?: (timeMs: number) => void
	) {
		this.board = createBoardSlice<PieceModel>(this.boardId, {
			width: settings.boardWidth,
			height: settings.boardHalfHeight * 2,
		});

		this.store = this.createStore(settings);

		// Get player's board pieces
		const playerBoard = player.select(PlayerStateSelectors.getPlayerBoard);

		// Generate creep pieces
		const creepPieces = generateCreepPieces(round);

		// Build merged board manually using correct PiecePositionsState format
		// Format: { "x,y": pieceId }
		const pieces: { [pieceId: string]: PieceModel } = {};
		const piecePositions: { [position: string]: string } = {};

		// Add player pieces (bottom half — they face away / "north")
		Object.entries(playerBoard.pieces).forEach(([id, piece]) => {
			pieces[id] = { ...piece, facingAway: true };
		});
		// Player positions: shift to bottom of doubled board
		Object.entries(playerBoard.piecePositions).forEach(([posKey, pieceId]) => {
			const [x, y] = posKey.split(",").map((v) => parseInt(v, 10));
			// Player pieces stay at bottom (add boardHalfHeight offset for doubled board)
			const newY = y + settings.boardHalfHeight;
			piecePositions[`${x},${newY}`] = pieceId;
		});

		// Place creep pieces on top half of the board (row 0 to boardHalfHeight-1)
		const topRowY = 0;
		creepPieces.forEach((creep, i) => {
			pieces[creep.id] = { ...creep, facingAway: false };
			const x = Math.min(i % settings.boardWidth, settings.boardWidth - 1);
			const y = topRowY + Math.floor(i / settings.boardWidth);
			piecePositions[`${x},${y}`] = creep.id;
		});

		const boardState: BoardState<PieceModel> = {
			id: this.boardId,
			pieces,
			piecePositions,
			locked: false,
			size: {
				width: settings.boardWidth,
				height: settings.boardHalfHeight * 2,
			},
			pieceLimit: null,
		};

		this.store.dispatch(this.board.commands.setBoardPiecesCommand(boardState));
	}

	public onClientFinishMatch(playerId: string) {
		if (playerId === this.player.id) {
			this.clientFinishedMatch.resolve();
		}
	}

	public triggerOvertime() {
		this.store.dispatch(BattleCommands.overtimeBattleCommand());
	}

	public getBoardForPlayer(_playerId: string): BoardState<PieceModel> {
		const { board } = this.store.getState();
		return cloneBoard(board);
	}

	public getTurn() {
		return this.store.getState().turn;
	}

	public getFinalBoard() {
		return this.finalBoard;
	}

	public async fight(battleTimeout: Promise<void>) {
		this.store.dispatch(BattleCommands.startBattleCommand({}));

		await Promise.race([
			battleTimeout,
			Promise.all([
				this.serverFinishedMatch.promise,
				this.clientFinishedMatch.promise,
			]),
		]);

		await delay(500);

		this.finalBoard = this.store.getState().board;

		const survivingPieces = BoardSelectors.getAllPieces(this.finalBoard).filter(
			(p) => p.currentHealth > 0
		);

		const surviving = {
			player: survivingPieces.filter((p) => p.ownerId === this.player.id),
			creep: survivingPieces.filter((p) => p.ownerId === CREEP_OWNER_ID),
		};

		const playerScore = surviving.player.length;
		const creepScore = surviving.creep.length;

		// PvE: player is always "home"
		this.player.put(
			playerFinishMatchEvent({
				homeScore: playerScore,
				awayScore: creepScore,
				isHomePlayer: true,
			})
		);

		// Process item drops from killed creeps
		const killedCreeps = this.creepWave.count - creepScore;
		for (let i = 0; i < killedCreeps; i++) {
			if (Math.random() < this.creepWave.dropChance) {
				const item = getRandomBaseItem();
				this.player.put(
					playerInfoCommands.addItemToInventoryCommand(item.id)
				);
			}
		}

		return this.finalBoard;
	}

	private createStore(settings: GamemodeSettings) {
		// eslint-disable-next-line no-underscore-dangle
		const _this = this;
		const rootSaga = function* () {
			yield all([
				call(
					battleSaga,
					(state: MatchState) => state.board,
					settings,
					_this.board
				),
				takeEvery<BattleEvents.BattleFinishEvent>(
					BattleEvents.battleFinishEvent,
					function* ({ payload: { turn } }) {
						_this.onServerFinishMatch();

						_this.logger.debug("Creep battle finished", {
							meta: {
								player: _this.player.getVariable((v) => v.name),
								round: _this.round,
								turns: turn,
							},
						});
					}
				),
				takeLatest<BattleEvents.BattleTurnEvent>(
					BattleEvents.battleTurnEvent,
					function* ({
						payload: { board, timeMs },
					}: BattleEvents.BattleTurnEvent) {
						if (_this.onTurnComplete) {
							_this.onTurnComplete(timeMs);
						}

						yield put(
							_this.board.commands.setBoardPiecesCommand({
								pieces: board.pieces,
								piecePositions: board.piecePositions,
								size: undefined,
							})
						);
					}
				),
			]);
		};

		const sagaMiddleware = createSagaMiddleware();

		const store = configureStore<MatchState>({
			reducer: {
				board: this.board.boardReducer,
				turn: turnReducer as Reducer<number, UnknownAction>,
			},
			middleware: (getDefaultMiddleware) =>
				getDefaultMiddleware({
					thunk: false,
					serializableCheck: false,
				}).concat(sagaMiddleware),
		});

		sagaMiddleware.run(rootSaga);

		return store;
	}

	private onServerFinishMatch() {
		this.serverFinishedMatch.resolve();
	}
}
