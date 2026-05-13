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
}

export interface CoachResponse {
  answer: string;
  sources: string[];
}

export interface BattleAnalysis {
  winner: "win" | "loss" | "draw";
  summary: string;
  issues: Array<any>;
  recommendations: Array<any>;
  stats: any;
}

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
): Promise<{ success: boolean; advice?: PositioningAdvice; error?: string }> => {
  return emitWithAck("requestPositioningAdvice", { myBoard });
};

export const requestCoachAdvice = (query: string, context?: any): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
  return emitWithAck("requestCoachAdvice", { query, context });
};

export const requestCoachAdviceStream = async (
  query: string,
  context?: any,
  onChunk?: (text: string) => void
): Promise<void> => {
  const res = await fetch("http://localhost:8003/query-stream", {
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
  traits: string[],
  pieces: Array<{ name: string; definitionId: number }>
): Promise<{ success: boolean; response?: CoachResponse; error?: string }> => {
  return emitWithAck("requestBuildAdvice", { traits, pieces });
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

export const requestBattleAnalysis = (data: any): Promise<{ success: boolean; analysis?: BattleAnalysis; error?: string }> => {
  return emitWithAck("requestBattleAnalysis", data);
};
