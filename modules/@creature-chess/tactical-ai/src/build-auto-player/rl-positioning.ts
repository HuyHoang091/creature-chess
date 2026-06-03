import path from "path";

import { BoardSelectors, BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";
import { PPOAgent } from "@creature-chess/rl-bot/src/agent/ppoAgent";
import { ActionDecoder } from "@creature-chess/rl-bot/src/environment/actionDecoder";
import { StateEncoder } from "@creature-chess/rl-bot/src/environment/stateEncoder";

export type RlTacticalMove = {
	pieceId: string;
	targetX: number;
	targetY: number;
};

let sharedAgent: PPOAgent | null = null;
let sharedEncoder: StateEncoder | null = null;
let sharedDecoder: ActionDecoder | null = null;
let loadPromise: Promise<void> | null = null;

const getModelPath = () =>
	process.env.RL_MODEL_PATH ||
	path.resolve(__dirname, "../../../rl-bot/training/models/final");

const getAgent = () => {
	if (!sharedAgent) {
		sharedAgent = new PPOAgent();
	}
	return sharedAgent;
};

const getEncoder = () => {
	if (!sharedEncoder) {
		sharedEncoder = new StateEncoder();
	}
	return sharedEncoder;
};

const getDecoder = () => {
	if (!sharedDecoder) {
		sharedDecoder = new ActionDecoder();
	}
	return sharedDecoder;
};

const ensureModelLoaded = async () => {
	if (!loadPromise) {
		const modelPath = getModelPath();
		loadPromise = getAgent()
			.loadModel(modelPath)
			.then(() => {
				console.log(`[TacticalAI] Auto-play RL model loaded from ${modelPath}`);
			})
			.catch((error) => {
				loadPromise = null;
				throw error;
			});
	}

	await loadPromise;
};

const removeNoOpMoves = (
	board: BoardState<PieceModel>,
	moves: RlTacticalMove[]
) =>
	moves.filter((move) => {
		const current = BoardSelectors.getPiecePosition(board, move.pieceId);
		return (
			current && (current.x !== move.targetX || current.y !== move.targetY)
		);
	});

export const getRlTacticalMoves = async (
	myBoard: BoardState<PieceModel>,
	enemyBoard?: BoardState<PieceModel> | null,
	potentialEnemyBoard?: BoardState<PieceModel> | null
): Promise<RlTacticalMove[]> => {
	await ensureModelLoaded();

	const state = getEncoder().encode(
		myBoard,
		enemyBoard || undefined,
		potentialEnemyBoard || undefined
	);
	const { action } = getAgent().act(state);
	const decoder = getDecoder();

	return removeNoOpMoves(myBoard, [
		...decoder.decodeAction(action, myBoard),
		...decoder.applyAdjustment(action, myBoard),
	]);
};
