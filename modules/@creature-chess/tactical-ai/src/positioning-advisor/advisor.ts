import path from "path";
import { Worker } from "worker_threads";

import { BoardSelectors, BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";
import { PPOAgent } from "@creature-chess/rl-bot/src/agent/ppoAgent";
import { ActionDecoder } from "@creature-chess/rl-bot/src/environment/actionDecoder";
import { StateEncoder } from "@creature-chess/rl-bot/src/environment/stateEncoder";

import { generateEnemyScenarios } from "./simulation/scenario-generator";
import {
	FormationTestResult,
	testFormation,
} from "./simulation/win-rate-calculator";
import { pickBestStrategy } from "./strategy-picker";
import {
	PositioningAdvice,
	FormationCandidate,
	PieceMove,
	SimulationConfig,
	DEFAULT_SIMULATION_CONFIG,
	StrategySelectionMode,
} from "./types";

const applyBoardMove = (
	board: BoardState<PieceModel>,
	pieceId: string,
	targetX: number,
	targetY: number
): BoardState<PieceModel> => {
	const from = BoardSelectors.getPiecePosition(board, pieceId);
	if (!from) return board;

	const targetKey = `${targetX},${targetY}`;
	const fromKey = `${from.x},${from.y}`;
	const targetPieceId = board.piecePositions[targetKey];
	const piecePositions = { ...board.piecePositions };

	if (targetPieceId) {
		piecePositions[fromKey] = targetPieceId;
	} else {
		delete piecePositions[fromKey];
	}

	piecePositions[targetKey] = pieceId;

	return {
		...board,
		piecePositions,
	};
};

const generateFormation = (
	board: BoardState<PieceModel>,
	enemyBoard: BoardState<PieceModel> | undefined,
	potentialEnemyBoard: BoardState<PieceModel> | undefined,
	agent: PPOAgent,
	encoder: StateEncoder,
	decoder: ActionDecoder
): {
	formationName: string;
	adjustmentName: string;
	moves: PieceMove[];
	resultBoard: BoardState<PieceModel>;
} => {
	const rlState = encoder.encode(board, enemyBoard, potentialEnemyBoard);
	const { action } = agent.act(rlState);
	let nextBoard = board;
	const moves: PieceMove[] = [];

	for (const move of decoder.decodeAction(action, nextBoard)) {
		nextBoard = applyBoardMove(
			nextBoard,
			move.pieceId,
			move.targetX,
			move.targetY
		);
		moves.push({
			pieceId: move.pieceId,
			targetX: move.targetX,
			targetY: move.targetY,
		});
	}

	for (const move of decoder.applyAdjustment(action, nextBoard)) {
		nextBoard = applyBoardMove(
			nextBoard,
			move.pieceId,
			move.targetX,
			move.targetY
		);
		moves.push({
			pieceId: move.pieceId,
			targetX: move.targetX,
			targetY: move.targetY,
		});
	}

	return {
		formationName: action.payload.formation || "standard",
		adjustmentName: action.payload.adjustment || "none",
		moves,
		resultBoard: nextBoard,
	};
};

const runFormationTestInWorker = (
	myBoard: BoardState<PieceModel>,
	scenarios: ReturnType<typeof generateEnemyScenarios>,
	trialsPerScenario: number
): Promise<FormationTestResult> =>
	new Promise((resolve, reject) => {
		const ext = path.extname(__filename);
		const workerPath = path.resolve(
			__dirname,
			"simulation",
			`formation-test-worker${ext}`
		);
		const workerOptions: any = {
			workerData: {
				myBoard,
				scenarios,
				trialsPerScenario,
			},
		};

		if (ext === ".ts") {
			workerOptions.execArgv = ["-r", "ts-node/register"];
		}

		const worker = new Worker(workerPath, workerOptions);

		worker.once("message", (result: FormationTestResult) => {
			resolve(result);
		});
		worker.once("error", reject);
		worker.once("exit", (code) => {
			if (code !== 0) {
				reject(new Error(`Formation test worker exited with code ${code}`));
			}
		});
	});

export class PositioningAdvisor {
	private agent: PPOAgent;
	private encoder: StateEncoder;
	private decoder: ActionDecoder;
	private config: SimulationConfig;
	private modelLoaded = false;

	constructor(config: Partial<SimulationConfig> = {}) {
		this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config };
		this.agent = new PPOAgent({ temperature: 0.8 });
		this.encoder = new StateEncoder();
		this.decoder = new ActionDecoder();
	}

	async loadModel(modelPath: string): Promise<void> {
		await this.agent.loadModel(modelPath);
		this.modelLoaded = true;
	}

	isReady(): boolean {
		return this.modelLoaded;
	}

	async getAdvice(
		myBoard: BoardState<PieceModel>,
		enemyBoard: BoardState<PieceModel>,
		potentialEnemyBoard?: BoardState<PieceModel>,
		options: { selectionMode?: StrategySelectionMode } = {}
	): Promise<PositioningAdvice | null> {
		if (!this.modelLoaded) {
			throw new Error("Model not loaded. Call loadModel() first.");
		}

		const hasPotential =
			potentialEnemyBoard && Object.keys(potentialEnemyBoard.pieces).length > 0;
		console.log(
			`[Advisor] getAdvice called — myBoard pieces=${Object.keys(myBoard.pieces).length}, enemyBoard pieces=${Object.keys(enemyBoard.pieces).length}${hasPotential ? `, potentialEnemyBoard pieces=${Object.keys(potentialEnemyBoard.pieces).length}` : ""}`
		);

		const realScenarios = generateEnemyScenarios(
			enemyBoard,
			this.config.numScenarios
		).map((scenario) => ({
			...scenario,
			name: `real:${scenario.name}`,
		}));
		const potentialScenarios = hasPotential
			? generateEnemyScenarios(
					potentialEnemyBoard,
					this.config.numScenarios
				).map((scenario) => ({
					...scenario,
					name: `potential:${scenario.name}`,
				}))
			: [];
		const allScenarios = [...realScenarios, ...potentialScenarios];

		const trialsPerScenario = hasPotential
			? Math.ceil(this.config.trialsPerScenario / 2)
			: this.config.trialsPerScenario;

		console.log(
			`[Advisor] Generated ${allScenarios.length} enemy scenarios (${realScenarios.length} real + ${potentialScenarios.length} potential), trialsPerScenario=${trialsPerScenario}`
		);

		const generatedCandidates: Array<{
			formationName: string;
			adjustmentName: string;
			moves: PieceMove[];
			resultBoard: BoardState<PieceModel>;
		}> = [];
		const seen = new Set<string>();

		for (
			let i = 0;
			i < this.config.numFormations * 2 &&
			generatedCandidates.length < this.config.numFormations;
			i++
		) {
			const formation = generateFormation(
				myBoard,
				enemyBoard,
				potentialEnemyBoard,
				this.agent,
				this.encoder,
				this.decoder
			);

			const key = `${formation.formationName}:${formation.adjustmentName}`;
			if (seen.has(key)) continue;
			seen.add(key);

			generatedCandidates.push(formation);
		}

		const candidates: FormationCandidate[] = await Promise.all(
			generatedCandidates.map(async (formation) => {
				const testResult = await runFormationTestInWorker(
					formation.resultBoard,
					allScenarios,
					trialsPerScenario
				);

				return {
					formationName: formation.formationName,
					adjustmentName: formation.adjustmentName,
					moves: formation.moves,
					scenarioResults: testResult.scenarioResults,
					avgWinRate: testResult.avgWinRate,
					avgSurvivorMargin: testResult.avgSurvivorMargin,
					avgHomeSurvivalRate: testResult.avgHomeSurvivalRate,
					avgEnemyEliminationRate: testResult.avgEnemyEliminationRate,
					preservationScore: testResult.preservationScore,
					variance: testResult.variance,
				};
			})
		);

		const advice = pickBestStrategy(
			candidates,
			this.config,
			options.selectionMode
		);
		console.log(
			`[Advisor] pickBestStrategy returned: ${advice ? `formation=${advice.formation}, winRate=${advice.winRate}, confidence=${advice.confidence}` : "null"}`
		);

		if (!advice) {
			return advice;
		}

		const bestCandidate = candidates.find(
			(candidate) =>
				candidate.formationName === advice.formation &&
				candidate.adjustmentName === advice.adjustment
		);

		if (!bestCandidate) {
			return advice;
		}

		const opponentBreakdown = [
			{ label: "Đối thủ 1", prefix: "real:" },
			{ label: "Đối thủ 2", prefix: "potential:" },
		]
			.map(({ label, prefix }) => {
				const results = bestCandidate.scenarioResults.filter((scenario) =>
					scenario.scenarioName.startsWith(prefix)
				);

				if (results.length === 0) {
					return null;
				}

				const totalWins = results.reduce((sum, result) => sum + result.wins, 0);
				const totalTrials = results.reduce(
					(sum, result) => sum + result.wins + result.losses + result.draws,
					0
				);
				const avgSurvivorMargin =
					results.reduce((sum, result) => sum + result.avgSurvivorMargin, 0) /
					results.length;

				return {
					label,
					winRate: totalTrials > 0 ? totalWins / totalTrials : 0,
					avgSurvivorMargin,
					testedScenarios: results.length,
				};
			})
			.filter((value): value is NonNullable<typeof value> => value !== null);

		return {
			...advice,
			explanation: hasPotential
				? `${advice.explanation}. Đã mô phỏng với cả 2 đối thủ có thể gặp.`
				: advice.explanation,
			opponentBreakdown,
		};
	}
}
