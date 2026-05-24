import http from "http";
import { Socket } from "socket.io";
import { BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";

import {
	BuildAdviceContext,
	BuildAdvicePlan,
} from "../build-advisor/types";
import { PositioningAdvice } from "../positioning-advisor/types";
import { getPositioningAdvisor } from "./advisor-instance";
import { analyzeBattle } from "../post-battle-analyzer/analyzer";
import { BattleReplayData } from "../post-battle-analyzer/types";
import { getCache, hashKey } from "../cache/cache";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8003";

const httpPost = (
	url: string,
	body: object
): Promise<{ ok: boolean; status: number; json(): Promise<any> }> => {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(body);
		const req = http.request(
			url,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(data),
				},
			},
			(res) => {
				let responseData = "";
				res.on("data", (chunk) => (responseData += chunk));
				res.on("end", () => {
					resolve({
						ok: res.statusCode! >= 200 && res.statusCode! < 300,
						status: res.statusCode || 0,
						json: () => Promise.resolve(JSON.parse(responseData)),
					});
				});
			}
		);
		req.on("error", reject);
		req.write(data);
		req.end();
	});
};

const httpPostStreamJsonLines = (
	url: string,
	body: object,
	onEvent: (event: any) => void
): Promise<void> => {
	return new Promise((resolve, reject) => {
		const data = JSON.stringify(body);
		const req = http.request(
			url,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(data),
				},
			},
			(res) => {
				const status = res.statusCode || 0;
				let errorText = "";
				let buffer = "";

				res.setEncoding("utf8");

				if (status < 200 || status >= 300) {
					res.on("data", (chunk) => (errorText += chunk));
					res.on("end", () =>
						reject(new Error(errorText || `RAG service error: ${status}`))
					);
					return;
				}

				res.on("data", (chunk) => {
					if (!chunk) {
						return;
					}

					buffer += chunk;
					let newlineIndex = buffer.indexOf("\n");

					while (newlineIndex >= 0) {
						const line = buffer.slice(0, newlineIndex).trim();
						buffer = buffer.slice(newlineIndex + 1);

						if (line) {
							try {
								onEvent(JSON.parse(line));
							} catch (error) {
								reject(error);
								return;
							}
						}

						newlineIndex = buffer.indexOf("\n");
					}
				});
				res.on("end", () => {
					const trailingLine = buffer.trim();

					if (trailingLine) {
						try {
							onEvent(JSON.parse(trailingLine));
						} catch (error) {
							reject(error);
							return;
						}
					}

					resolve();
				});
			}
		);
		req.on("error", reject);
		req.write(data);
		req.end();
	});
};

const chunkText = (text: string, chunkSize = 120) => {
	const chunks: string[] = [];

	for (let index = 0; index < text.length; index += chunkSize) {
		chunks.push(text.slice(index, index + chunkSize));
	}

	return chunks;
};

export interface TacticalAIPluginDeps {
	getOpponentBoard?: (playerId: string) => BoardState<PieceModel> | null;
	getPotentialOpponentBoard?: (playerId: string) => BoardState<PieceModel> | null;
	getBuildAdviceContext?: (playerId: string) => BuildAdviceContext | null;
}

export interface PositioningRequest {
	myBoard: BoardState<PieceModel>;
	enemyBoard: BoardState<PieceModel>;
	potentialEnemyBoard?: BoardState<PieceModel>;
}

export interface CoachRequest {
	query: string;
	context?: {
		requestType?: string;
		traits?: string[];
		pieces?: Array<{ name: string; definitionId: number }>;
		enemyArchetype?: string;
		buildState?: BuildAdviceContext;
	};
}

export interface CoachResponse {
	answer: string;
	sources: string[];
	plan?: BuildAdvicePlan | null;
}

const cloneBoardWithOwner = (
	board: BoardState<PieceModel>,
	ownerId: string
): BoardState<PieceModel> => {
	const idMapping: Record<string, string> = {};
	const newPieces = Object.entries(board.pieces).map(([oldId, piece]) => {
		const newId = `${oldId}-away`;
		idMapping[oldId] = newId;
		return [newId, { ...piece, ownerId }] as [string, PieceModel];
	});

	const newPiecePositions: Record<string, string> = {};
	for (const [pos, oldId] of Object.entries(board.piecePositions)) {
		newPiecePositions[pos] = idMapping[oldId];
	}

	return {
		...board,
		pieces: Object.fromEntries(newPieces),
		piecePositions: newPiecePositions,
	};
};

const handlePositioningRequest = async (
	data: PositioningRequest,
	deps: TacticalAIPluginDeps,
	callback: (result: {
		success: boolean;
		advice?: PositioningAdvice;
		error?: string;
	}) => void
) => {
	try {
		let enemyBoard: BoardState<PieceModel> | null = null;
		let potentialEnemyBoard: BoardState<PieceModel> | null = null;

		if (data.enemyBoard && Object.keys(data.enemyBoard.pieces || {}).length > 0) {
			enemyBoard = data.enemyBoard;
		} else if (deps.getOpponentBoard) {
			const playerId = (data as any).playerId;
			if (playerId) {
				enemyBoard = deps.getOpponentBoard(playerId);
			}
		}

		if (
			data.potentialEnemyBoard &&
			Object.keys(data.potentialEnemyBoard.pieces || {}).length > 0
		) {
			potentialEnemyBoard = data.potentialEnemyBoard;
		} else if (deps.getPotentialOpponentBoard) {
			const playerId = (data as any).playerId;
			if (playerId) {
				potentialEnemyBoard = deps.getPotentialOpponentBoard(playerId);
			}
		}

		if (!enemyBoard || Object.keys(enemyBoard.pieces || {}).length === 0) {
			enemyBoard = cloneBoardWithOwner(data.myBoard, "AWAY");
		}

		const cache = getCache();
		const cacheKey = hashKey([
			"pos",
			JSON.stringify(data.myBoard.piecePositions),
			JSON.stringify(enemyBoard.piecePositions),
			potentialEnemyBoard
				? JSON.stringify(potentialEnemyBoard.piecePositions)
				: "",
		]);
		const cached = await cache.get<{
			success: boolean;
			advice: PositioningAdvice;
		}>(cacheKey);
		if (cached) {
			callback(cached);
			return;
		}

		const advisor = await getPositioningAdvisor();
		const advice = await advisor.getAdvice(
			data.myBoard,
			enemyBoard,
			potentialEnemyBoard || undefined
		);

		if (!advice) {
			callback({
				success: false,
				error: "Could not generate positioning advice",
			});
			return;
		}

		const result = { success: true as const, advice };
		await cache.set(cacheKey, result, 300);
		callback(result);
	} catch (err: any) {
		console.error("[TacticalAI] Positioning error:", err.message, err.stack);
		callback({ success: false, error: err.message || "Internal error" });
	}
};

const handleCoachRequest = async (
	data: CoachRequest,
	callback: (result: {
		success: boolean;
		response?: CoachResponse;
		error?: string;
	}) => void
) => {
	try {
		const cache = getCache();
		const cacheKey = hashKey([
			"coach",
			data.query,
			JSON.stringify(data.context || {}),
		]);
		const cached = await cache.get<{
			success: boolean;
			response: CoachResponse;
		}>(cacheKey);
		if (cached) {
			callback(cached);
			return;
		}

		const res = await httpPost(`${RAG_SERVICE_URL}/query`, {
			query: data.query,
			context: data.context || {},
		});

		if (!res.ok) {
			callback({ success: false, error: `RAG service error: ${res.status}` });
			return;
		}

		const result = await res.json();
		const response = {
			success: true as const,
			response: {
				answer: result.answer,
				sources: result.sources || [],
				plan: result.plan || null,
			},
		};
		await cache.set(cacheKey, response, 3600);
		callback(response);
	} catch (err: any) {
		callback({
			success: false,
			error: err.message || "RAG service unavailable",
		});
	}
};

const handleBuildRequest = async (
	playerId: string,
	note: string | undefined,
	deps: TacticalAIPluginDeps,
	callback: (result: {
		success: boolean;
		response?: CoachResponse;
		error?: string;
	}) => void
) => {
	try {
		const buildState = deps.getBuildAdviceContext?.(playerId);

		if (!buildState) {
			callback({ success: false, error: "Build context unavailable" });
			return;
		}

		const noteText = note?.trim();
		const query = noteText
			? `Recommend the strongest realistic build for the current state. Extra player note: ${noteText}`
			: "Recommend the strongest realistic build for the current state.";
		const cache = getCache();
		const cacheKey = hashKey([
			"build",
			playerId,
			noteText || "",
			JSON.stringify(buildState),
		]);
		const cached = await cache.get<{
			success: boolean;
			response: CoachResponse;
		}>(cacheKey);

		if (cached) {
			callback(cached);
			return;
		}

		const res = await httpPost(`${RAG_SERVICE_URL}/build-advice`, {
			query,
			context: buildState,
		});

		if (!res.ok) {
			callback({ success: false, error: `RAG service error: ${res.status}` });
			return;
		}

		const result = await res.json();
		const response = {
			success: true as const,
			response: {
				answer: result.answer,
				sources: result.sources || [],
				plan: result.plan || null,
			},
		};
		await cache.set(cacheKey, response, 900);
		callback(response);
	} catch (err: any) {
		callback({
			success: false,
			error: err.message || "RAG service unavailable",
		});
	}
};

const streamBuildAdvice = async (
	socket: Socket,
	requestId: string,
	playerId: string,
	note: string | undefined,
	deps: TacticalAIPluginDeps
) => {
	const buildState = deps.getBuildAdviceContext?.(playerId);

	if (!buildState) {
		socket.emit("buildAdviceStreamError", {
			requestId,
			error: "Build context unavailable",
		});
		return;
	}

	const noteText = note?.trim();
	const query = noteText
		? `Recommend the strongest realistic build for the current state. Extra player note: ${noteText}`
		: "Recommend the strongest realistic build for the current state.";
	const cache = getCache();
	const cacheKey = hashKey([
		"build",
		playerId,
		noteText || "",
		JSON.stringify(buildState),
	]);
	const cached = await cache.get<{
		success: boolean;
		response: CoachResponse;
	}>(cacheKey);

	if (cached?.response?.answer) {
		for (const chunk of chunkText(cached.response.answer)) {
			socket.emit("buildAdviceStreamChunk", {
				requestId,
				chunk,
			});
		}

		socket.emit("buildAdviceStreamDone", {
			requestId,
			answer: cached.response.answer,
			sources: cached.response.sources || [],
			plan: cached.response.plan || null,
			cached: true,
		});
		return;
	}

	try {
		let finalAnswer = "";
		let finalSources: string[] = [];
		let finalPlan: BuildAdvicePlan | null = null;

		await httpPostStreamJsonLines(
			`${RAG_SERVICE_URL}/build-advice-stream`,
			{
				query,
				context: buildState,
			},
			(event) => {
				if (event?.type === "chunk" && event.chunk) {
					socket.emit("buildAdviceStreamChunk", {
						requestId,
						chunk: event.chunk,
					});
					return;
				}

				if (event?.type === "done") {
					finalAnswer = event.answer || "";
					finalSources = event.sources || [];
					finalPlan = event.plan || null;
					return;
				}

				if (event?.type === "error") {
					throw new Error(event.error || "RAG stream unavailable");
				}
			}
		);

		if (finalAnswer) {
			const response = {
				success: true as const,
				response: {
					answer: finalAnswer,
					sources: finalSources,
					plan: finalPlan,
				},
			};
			await cache.set(cacheKey, response, 900);
		}

		socket.emit("buildAdviceStreamDone", {
			requestId,
			answer: finalAnswer,
			sources: finalSources,
			plan: finalPlan,
			cached: false,
		});
	} catch (err: any) {
		socket.emit("buildAdviceStreamError", {
			requestId,
			error: err.message || "RAG stream unavailable",
		});
	}
};

export const registerTacticalAIEvents = (
	socket: Socket,
	deps: TacticalAIPluginDeps
) => {
	console.log("[TacticalAI] registerTacticalAIEvents loaded for socket", socket.id);
	socket.on("requestPositioningAdvice", (data: PositioningRequest, callback) => {
		console.log("[TacticalAI] requestPositioningAdvice received");
		const requestData = { ...data, playerId: socket.data.id.toString() };
		handlePositioningRequest(requestData, deps, callback).catch(() => {
			callback({ success: false, error: "Unexpected error" });
		});
	});

	socket.on("requestCoachAdvice", (data: CoachRequest, callback) => {
		handleCoachRequest(data, callback).catch(() => {
			callback({ success: false, error: "Unexpected error" });
		});
	});

	socket.on("requestBuildAdvice", (data: { note?: string }, callback) => {
		handleBuildRequest(socket.data.id.toString(), data?.note, deps, callback).catch(
			() => {
				callback({ success: false, error: "Unexpected error" });
			}
		);
	});

	socket.on(
		"requestBuildAdviceStream",
		(data: { requestId: string; note?: string }, callback) => {
			if (!data?.requestId) {
				callback?.({ success: false, error: "Missing requestId" });
				return;
			}

			callback?.({ success: true });
			streamBuildAdvice(
				socket,
				data.requestId,
				socket.data.id.toString(),
				data.note,
				deps
			).catch((err) => {
				socket.emit("buildAdviceStreamError", {
					requestId: data.requestId,
					error: err?.message || "Unexpected stream error",
				});
			});
		}
	);

	socket.on(
		"requestCounterAdvice",
		(
			data: { enemyArchetype: string; enemyPieces: Array<{ name: string }> },
			callback
		) => {
			handleCoachRequest(
				{
					query: `Counter enemy comp ${data.enemyArchetype}. Enemy units: ${data.enemyPieces
						.map((p) => p.name)
						.join(", ")}`,
					context: { enemyArchetype: data.enemyArchetype },
				},
				callback
			).catch(() => callback({ success: false, error: "Unexpected error" }));
		}
	);

	socket.on(
		"requestItemAdvice",
		(data: { pieceName: string; role: string; currentItems: string[] }, callback) => {
			handleCoachRequest(
				{
					query: `Recommend items for ${data.pieceName} (role: ${data.role}). Current items: ${
						data.currentItems.join(", ") || "none"
					}`,
				},
				callback
			).catch(() => callback({ success: false, error: "Unexpected error" }));
		}
	);

	socket.on("requestBattleAnalysis", (data: BattleReplayData, callback) => {
		try {
			const analysis = analyzeBattle(data);
			callback({ success: true, analysis });
		} catch (err: any) {
			callback({ success: false, error: err.message || "Analysis failed" });
		}
	});
};
