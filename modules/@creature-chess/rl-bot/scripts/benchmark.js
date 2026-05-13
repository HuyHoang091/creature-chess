/**
 * Fast parallel benchmark: RL Bot vs Rule-Based Bot
 * Spawns games in parallel like load-test.js
 *
 * Usage:
 *   1. Start server with desired BOT_MODE (rl | rule_based)
 *   2. node modules/@creature-chess/rl-bot/scripts/benchmark.js --mode=rl --games=100
 *   3. Results: benchmark-<mode>-<timestamp>.json
 */

const { io } = require("socket.io-client");
const axios = require("axios");
const msgpackParser = require("socket.io-msgpack-parser");
const fs = require("fs");
const path = require("path");

const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:3001";
const INFO_SERVER_URL = process.env.INFO_SERVER_URL || "http://localhost:3000";
const AUTH_URL = `${INFO_SERVER_URL}/guest/session`;

const GAMES = parseInt(process.argv.find((a) => a.startsWith("--games="))?.split("=")[1] || "100", 10);
const MODE = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] || "unknown";

const FAST_SETTINGS = {
  healthLostPerPiece: 12,
  battleTurnCount: 30,
  battleTurnDuration: 20,
};

const CLIENT_CREATION_INTERVAL_IN_MS = 400;
const READY_PULSE_MS = 1000;
const FINISH_MATCH_PULSE_MS = 250;

const results = [];
let spawnedCount = 0;
let completed = 0;
let errors = 0;

function isBotPlayer(player, guestPlayerId) {
  if (!player) {
    return false;
  }

  const id = String(player.id || "");
  const name = String(player.name || "");

  if (guestPlayerId && id === String(guestPlayerId)) {
    return false;
  }

  return id.startsWith("bot-") || name.startsWith("[BOT]");
}

async function createGuestToken() {
  const response = await axios.get(AUTH_URL, {
    headers: { "User-Agent": "RLBenchmark" },
  });
  const cookies = response.headers["set-cookie"] || [];
  const guestTokenCookie = cookies.find((c) => c.includes("guest-token="));
  if (!guestTokenCookie) throw new Error("No guest token");
  return guestTokenCookie.split("guest-token=")[1].split(";")[0];
}

async function runSingleGame(index) {
  return new Promise(async (resolve) => {
    let finished = false;
    let resultData = null;
    let readyInterval = null;
    let finishMatchInterval = null;

    const cleanup = () => {
      if (readyInterval) { clearInterval(readyInterval); readyInterval = null; }
      if (finishMatchInterval) { clearInterval(finishMatchInterval); finishMatchInterval = null; }
    };

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        errors++;
        cleanup();
        resolve({ index, status: "timeout" });
      }
    }, 180_000); // 3 min timeout per game

    try {
      const token = await createGuestToken();
      const socket = io(GAME_SERVER_URL, {
        path: "/socket.io",
        transports: ["websocket"],
        reconnection: false,
        parser: msgpackParser,
      });

      socket.on("connect", () => {
        socket.emit("authenticate", { type: "guest", data: { accessToken: token } });
      });

      socket.on("authenticate_response", (res) => {
        if (res?.error) {
          finished = true;
          errors++;
          cleanup();
          socket.disconnect();
          clearTimeout(timeout);
          resolve({ index, status: "auth_error", error: res.error });
        }
      });

      socket.on("connected", () => {
        for (const [key, value] of Object.entries(FAST_SETTINGS)) {
          socket.emit("updateSetting", { key, value: String(value) });
        }
        socket.emit("startNow", { empty: true });
      });

      let playerId = null;
      let botPlayers = [];

      socket.on("gameConnected", (data) => {
        playerId = data?.playerId || null;
        botPlayers = Array.isArray(data?.players)
          ? data.players.filter((player) => isBotPlayer(player, playerId))
          : [];
        socket.emit("sendPlayerActions", { type: "readyUpPlayerAction" });

        if (!readyInterval) {
          readyInterval = setInterval(() => {
            if (socket.connected) {
              socket.emit("sendPlayerActions", { type: "readyUpPlayerAction" });
            }
          }, READY_PULSE_MS);
        }

        if (!finishMatchInterval) {
          finishMatchInterval = setInterval(() => {
            if (socket.connected) {
              socket.emit("finishMatch", { empty: true });
            }
          }, FINISH_MATCH_PULSE_MS);
        }
      });

      socket.on("sendGameEvents", (action) => {
        if (!action || !action.type) return;

        if (action.type === "gamePhaseStartedEvent" && action.payload?.phase === "PREPARING") {
          socket.emit("sendPlayerActions", { type: "readyUpPlayerAction" });
        }

        if (action.type === "gameFinishEvent") {
          const players = action.payload?.players || [];
          const botResults = botPlayers
            .map((botPlayer) => {
              const finishResult = players.find(
                (player) => String(player.id) === String(botPlayer.id)
              );

              if (!finishResult) {
                return null;
              }

              return {
                id: String(botPlayer.id),
                name: botPlayer.name,
                rank: finishResult.position,
                finishRound: finishResult.finishRound,
              };
            })
            .filter(Boolean);

          const bestBotRank = botResults.length > 0
            ? Math.min(...botResults.map((bot) => bot.rank))
            : 8;

          resultData = {
            rank: bestBotRank,
            botCount: botResults.length,
            bots: botResults,
            players,
          };
          finished = true;
          completed++;
          cleanup();
          socket.disconnect();
          clearTimeout(timeout);
          resolve({ index, status: "finished", result: resultData });
        }
      });

      socket.on("connect_error", (err) => {
        if (!finished) {
          finished = true;
          errors++;
          cleanup();
          clearTimeout(timeout);
          resolve({ index, status: "connect_error", error: err.message });
        }
      });

      socket.on("disconnect", () => {
        cleanup();
      });
    } catch (err) {
      if (!finished) {
        finished = true;
        errors++;
        cleanup();
        clearTimeout(timeout);
        resolve({ index, status: "exception", error: err.message });
      }
    }
  });
}

async function checkServer() {
  try {
    await axios.get(`${INFO_SERVER_URL}/guest/session`, { timeout: 5000 });
  } catch (err) {
    console.error(`\n❌ Game server not available at ${GAME_SERVER_URL} / ${INFO_SERVER_URL}`);
    console.error(`   Please start the server first (e.g. yarn dev-all)\n`);
    process.exit(1);
  }
}

async function main() {
  await checkServer();

  console.log(`\n🏁 Benchmark: ${MODE.toUpperCase()} Bot | ${GAMES} games | ${GAME_SERVER_URL}\n`);

  const interval = setInterval(() => {
    spawnedCount++;
    runSingleGame(spawnedCount).then((res) => {
      results.push(res);
    });

    if (spawnedCount >= GAMES) {
      clearInterval(interval);
    }
  }, CLIENT_CREATION_INTERVAL_IN_MS);

  // Wait until all games finish
  const poll = setInterval(() => {
    if (completed + errors >= GAMES) {
      clearInterval(poll);

      const finishedGames = results.filter((r) => r.status === "finished");
      const botSamples = finishedGames.flatMap((r) => r.result?.bots || []);
      const wins = botSamples.filter((bot) => bot.rank === 1).length;
      const top4 = botSamples.filter((bot) => bot.rank <= 4).length;
      const avgRank = botSamples.length > 0
        ? botSamples.reduce((sum, bot) => sum + (bot.rank || 8), 0) / botSamples.length
        : 0;

      const report = {
        mode: MODE,
        totalGames: GAMES,
        completedGames: finishedGames.length,
        measuredParticipantType: "bot",
        botSampleSize: botSamples.length,
        errors,
        winRate: botSamples.length > 0 ? wins / botSamples.length : 0,
        top4Rate: botSamples.length > 0 ? top4 / botSamples.length : 0,
        avgRank,
        rawResults: results.map((r) => ({
          index: r.index,
          status: r.status,
          bestBotRank: r.result?.rank,
          botRanks: (r.result?.bots || []).map((bot) => bot.rank),
        })),
        timestamp: new Date().toISOString(),
      };

      const outPath = path.join(process.cwd(), `benchmark-${MODE}-${Date.now()}.json`);
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

      console.log(`\n📊 Results for ${MODE.toUpperCase()}`);
      console.log(`   Completed : ${report.completedGames}/${report.totalGames}`);
      console.log(`   Win Rate  : ${(report.winRate * 100).toFixed(1)}%`);
      console.log(`   Top-4 Rate: ${(report.top4Rate * 100).toFixed(1)}%`);
      console.log(`   Avg Rank  : ${report.avgRank.toFixed(2)}`);
      console.log(`   Errors    : ${report.errors}`);
      console.log(`\n💾 Report saved to ${outPath}\n`);
      process.exit(0);
    }
  }, 1000);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
