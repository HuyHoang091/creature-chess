import http from "http";
import { Socket } from "socket.io";
import { BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";

import { PositioningAdvice } from "../positioning-advisor/types";
import { getPositioningAdvisor } from "./advisor-instance";
import { analyzeBattle } from "../post-battle-analyzer/analyzer";
import { BattleReplayData } from "../post-battle-analyzer/types";
import { getCache, hashKey } from "../cache/cache";

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8003";

const httpPost = (url: string, body: object): Promise<{ ok: boolean; status: number; json(): Promise<any> }> => {
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

export interface TacticalAIPluginDeps {
  getOpponentBoard?: (playerId: string) => BoardState<PieceModel> | null;
}

export interface PositioningRequest {
  myBoard: BoardState<PieceModel>;
  enemyBoard: BoardState<PieceModel>;
}

export interface CoachRequest {
  query: string;
  context?: {
    traits?: string[];
    pieces?: Array<{ name: string; definitionId: number }>;
    enemyArchetype?: string;
  };
}

export interface CoachResponse {
  answer: string;
  sources: string[];
}

const cloneBoardWithOwner = (board: BoardState<PieceModel>, ownerId: string): BoardState<PieceModel> => {
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
  callback: (result: { success: boolean; advice?: PositioningAdvice; error?: string }) => void
) => {
  try {
    let enemyBoard: BoardState<PieceModel> | null = null;

    if (data.enemyBoard && Object.keys(data.enemyBoard.pieces || {}).length > 0) {
      enemyBoard = data.enemyBoard;
    } else if (deps.getOpponentBoard) {
      const playerId = (data as any).playerId;
      if (playerId) {
        enemyBoard = deps.getOpponentBoard(playerId);
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
    ]);
    const cached = await cache.get<{ success: boolean; advice: PositioningAdvice }>(cacheKey);
    if (cached) {
      callback(cached);
      return;
    }

    const advisor = await getPositioningAdvisor();
    const advice = advisor.getAdvice(data.myBoard, enemyBoard);

    if (!advice) {
      callback({ success: false, error: "Could not generate positioning advice" });
      return;
    }

    const result = { success: true as const, advice };
    await cache.set(cacheKey, result, 300); // 5 min TTL
    callback(result);
  } catch (err: any) {
    console.error("[TacticalAI] Positioning error:", err.message, err.stack);
    callback({ success: false, error: err.message || "Internal error" });
  }
};

const handleCoachRequest = async (
  data: CoachRequest,
  callback: (result: { success: boolean; response?: CoachResponse; error?: string }) => void
) => {
  try {
    const cache = getCache();
    const cacheKey = hashKey(["coach", data.query, JSON.stringify(data.context || {})]);
    const cached = await cache.get<{ success: boolean; response: CoachResponse }>(cacheKey);
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
      },
    };
    await cache.set(cacheKey, response, 3600); // 1 hour TTL
    callback(response);
  } catch (err: any) {
    callback({ success: false, error: err.message || "RAG service unavailable" });
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
    handleCoachRequest(data, callback).catch((err) => {
      callback({ success: false, error: "Unexpected error" });
    });
  });

  socket.on("requestBuildAdvice", (data: { traits: string[]; pieces: Array<{ name: string; definitionId: number }> }, callback) => {
    handleCoachRequest(
      {
        query: `Gợi ý build team. Traits hiện tại: ${data.traits.join(", ")}. Quân: ${data.pieces.map(p => p.name).join(", ")}`,
        context: { traits: data.traits, pieces: data.pieces },
      },
      callback
    ).catch(() => callback({ success: false, error: "Unexpected error" }));
  });

  socket.on("requestCounterAdvice", (data: { enemyArchetype: string; enemyPieces: Array<{ name: string }> }, callback) => {
    handleCoachRequest(
      {
        query: `Counter đội hình ${data.enemyArchetype}. Đối thủ có: ${data.enemyPieces.map(p => p.name).join(", ")}`,
        context: { enemyArchetype: data.enemyArchetype },
      },
      callback
    ).catch(() => callback({ success: false, error: "Unexpected error" }));
  });

  socket.on("requestItemAdvice", (data: { pieceName: string; role: string; currentItems: string[] }, callback) => {
    handleCoachRequest(
      {
        query: `Gợi ý item cho ${data.pieceName} (role: ${data.role}). Items hiện tại: ${data.currentItems.join(", ") || "không có"}`,
      },
      callback
    ).catch(() => callback({ success: false, error: "Unexpected error" }));
  });

  socket.on("requestBattleAnalysis", (data: BattleReplayData, callback) => {
    try {
      const analysis = analyzeBattle(data);
      callback({ success: true, analysis });
    } catch (err: any) {
      callback({ success: false, error: err.message || "Analysis failed" });
    }
  });
};
