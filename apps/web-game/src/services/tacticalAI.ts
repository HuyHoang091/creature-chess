import { getCurrentSocket } from "./socket";

export interface PositioningRequest {
	myBoard: any;
	enemyBoard: any;
}

export interface PositioningAdvice {
	formation: string;
	adjustment: string;
	winRate: number;
	avgSurvivorMargin: number;
	confidence: "low" | "medium" | "high";
	moves: Array<{ pieceId: string; targetX: number; targetY: number }>;
	explanation: string;
	alternatives: Array<{ formation: string; winRate: number }>;
	testedScenarios: number;
	opponentBreakdown?: Array<{
		label: string;
		winRate: number;
		avgSurvivorMargin: number;
		testedScenarios: number;
	}>;
}

export interface CoachResponse {
	answer: string;
	sources: string[];
	plan?: any;
}

export type BuildAutoPlayLevel = 1 | 2 | 3 | 4;
export type BuildAutoPlayPreset = "balanced" | "stabilize" | "economy";

export interface BuildAutoPlayStatus {
	enabled: boolean;
	level: BuildAutoPlayLevel | null;
	preset: BuildAutoPlayPreset | null;
	effectivePreset?: BuildAutoPlayPreset | null;
	lobbyTempo?: "fast" | "slow" | "neutral" | null;
	planName: string | null;
	round: number | null;
	activity:
		| "analyzing"
		| "choosing_action"
		| "acting"
		| "waiting"
		| "error"
		| "disabled";
	message: string;
	recentSteps: string[];
}

export interface BattleAnalysis {
	winner: "win" | "loss" | "draw";
	summary: string;
	issues: Array<any>;
	recommendations: Array<any>;
	stats: any;
}

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8003";

export interface AgentPlan {
	tool: string;
	clientAction:
		| "positioning"
		| "build"
		| "item"
		| "counter"
		| "scout"
		| null;
	args: Record<string, any>;
	reason: string;
	smalltalk: boolean;
	needs: string[];
}

/**
 * Ask the agent which tool a free-form message maps to. Returns a routing
 * decision the UI can act on (run a game action) or "general_advice" to stream
 * a RAG answer.
 */
export const requestAgentPlan = async (
	query: string,
	context?: any,
	sessionId?: string
): Promise<AgentPlan> => {
	const res = await fetch(`${RAG_SERVICE_URL}/agent`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query,
			context: context || {},
			session_id: sessionId,
		}),
	});
	if (!res.ok) {
		throw new Error(`Agent routing failed (${res.status})`);
	}
	return res.json();
};

/**
 * Stream a general-knowledge answer using agentic RAG (re-query when weak).
 */
export const requestAgentStream = async (
	query: string,
	context?: any,
	onChunk?: (text: string) => void,
	sessionId?: string,
	smalltalk?: boolean
): Promise<void> => {
	const res = await fetch(`${RAG_SERVICE_URL}/agent-stream`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			query,
			context: context || {},
			session_id: sessionId,
			smalltalk: !!smalltalk,
		}),
	});
	if (!res.body) return;
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let done = false;
	while (!done) {
		const { value, done: readerDone } = await reader.read();
		done = readerDone;
		if (value) {
			const chunk = decoder.decode(value, { stream: true });
			if (onChunk) onChunk(chunk);
		}
	}
};

/**
 * Tell the agent that a client-side action tool ran, so its intent is folded
 * into the conversation memory for the next turn. Fire-and-forget.
 */
export const recordAgentAction = async (
	sessionId: string,
	query: string,
	tool: string,
	args?: Record<string, any>
): Promise<void> => {
	try {
		await fetch(`${RAG_SERVICE_URL}/agent-action-memory`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				session_id: sessionId,
				query,
				tool,
				args: args || {},
			}),
		});
	} catch {
		// Memory is best-effort; ignore failures.
	}
};

const emitWithAck = <T>(event: string, data: any): Promise<T> => {
	return new Promise((resolve, reject) => {
		const socket = getCurrentSocket();
		if (!socket) {
			reject(new Error("Socket not connected"));
			return;
		}
		socket.emit(event, data, (response: any) => {
			if (response?.success) {
				resolve(response);
			} else {
				reject(new Error(response?.error || "Request failed"));
			}
		});
	});
};

export const requestPositioningAdvice = (
	myBoard: any
): Promise<{
	success: boolean;
	advice?: PositioningAdvice;
	error?: string;
}> => {
	return emitWithAck("requestPositioningAdvice", { myBoard });
};

export const requestCoachAdvice = (
	query: string,
	context?: any
): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
	return emitWithAck("requestCoachAdvice", { query, context });
};

export const requestCoachAdviceStream = async (
	query: string,
	context?: any,
	onChunk?: (text: string) => void
): Promise<void> => {
	const res = await fetch(`${RAG_SERVICE_URL}/query-stream`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, context }),
	});
	if (!res.body) return;
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let done = false;
	while (!done) {
		const { value, done: readerDone } = await reader.read();
		done = readerDone;
		if (value) {
			const chunk = decoder.decode(value, { stream: true });
			if (onChunk) onChunk(chunk);
		}
	}
};

export const requestBuildAdvice = (
	note?: string
): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
	return emitWithAck("requestBuildAdvice", { note });
};

export const requestBuildAdviceStream = (
	note?: string,
	onChunk?: (text: string) => void
): Promise<CoachResponse> => {
	return new Promise((resolve, reject) => {
		const socket = getCurrentSocket();
		if (!socket) {
			reject(new Error("Socket not connected"));
			return;
		}

		const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		let answer = "";

		const cleanup = () => {
			socket.off("buildAdviceStreamChunk", handleChunk);
			socket.off("buildAdviceStreamDone", handleDone);
			socket.off("buildAdviceStreamError", handleError);
		};

		const handleChunk = (payload: any) => {
			if (payload?.requestId !== requestId || !payload?.chunk) {
				return;
			}

			answer += payload.chunk;
			onChunk?.(payload.chunk);
		};

		const handleDone = (payload: any) => {
			if (payload?.requestId !== requestId) {
				return;
			}

			cleanup();
			resolve({
				answer: payload.answer || answer,
				sources: payload.sources || [],
				plan: payload.plan || null,
			});
		};

		const handleError = (payload: any) => {
			if (payload?.requestId !== requestId) {
				return;
			}

			cleanup();
			reject(new Error(payload?.error || "Build advice stream failed"));
		};

		socket.on("buildAdviceStreamChunk", handleChunk);
		socket.on("buildAdviceStreamDone", handleDone);
		socket.on("buildAdviceStreamError", handleError);

		socket.emit(
			"requestBuildAdviceStream",
			{ requestId, note },
			(response: any) => {
				if (response?.success) {
					return;
				}

				cleanup();
				reject(
					new Error(response?.error || "Build advice stream request failed")
				);
			}
		);
	});
};

export const startBuildAutoPlay = (
	plan: any,
	level: BuildAutoPlayLevel,
	preset: BuildAutoPlayPreset = "balanced"
): Promise<{ success: boolean; state: BuildAutoPlayStatus }> =>
	emitWithAck("startBuildAutoPlay", { plan, level, preset });

export const stopBuildAutoPlay = (): Promise<{
	success: boolean;
	state: BuildAutoPlayStatus;
}> => emitWithAck("stopBuildAutoPlay", {});

export const requestBuildAutoPlayState = (): Promise<{
	success: boolean;
	state: BuildAutoPlayStatus;
}> => emitWithAck("requestBuildAutoPlayState", {});

export const subscribeBuildAutoPlayStatus = (
	onStatus: (status: BuildAutoPlayStatus) => void
) => {
	const socket = getCurrentSocket();
	if (!socket) return () => undefined;
	socket.on("buildAutoPlayStatus", onStatus);
	return () => {
		socket.off("buildAutoPlayStatus", onStatus);
	};
};

export const requestCounterAdvice = (
	enemyArchetype: string,
	enemyPieces: Array<{ name: string }>
): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
	return emitWithAck("requestCounterAdvice", { enemyArchetype, enemyPieces });
};

export const requestItemAdvice = (
	pieceName: string,
	role: string,
	currentItems: string[]
): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
	return emitWithAck("requestItemAdvice", { pieceName, role, currentItems });
};

export const requestBattleAnalysis = (
	data: any
): Promise<{ success: boolean; analysis?: BattleAnalysis; error?: string }> => {
	return emitWithAck("requestBattleAnalysis", data);
};
