const { io } = require("socket.io-client");
const axios = require("axios");
const msgpackParser = require("socket.io-msgpack-parser");

const GAME_SERVER_URL = process.env.GAME_SERVER_URL || "http://localhost:3001";
const INFO_SERVER_URL = process.env.INFO_SERVER_URL || "http://localhost:3000";
const AUTH_URL = `${INFO_SERVER_URL}/guest/session`;
const GAME_COUNT = parseInt(process.env.RL_TRAIN_GAME_COUNT || process.argv[2] || "1000", 10);
const CLIENT_CREATION_INTERVAL_IN_MS = parseInt(process.env.RL_TRAIN_GAME_INTERVAL_MS || "400", 10);
const READY_PULSE_MS = parseInt(process.env.RL_READY_PULSE_MS || "1000", 10);
const FINISH_MATCH_PULSE_MS = parseInt(process.env.RL_FINISH_MATCH_PULSE_MS || "250", 10);
const FAST_SETTINGS = {
  healthLostPerPiece: 12,
  battleTurnCount: 30,
  battleTurnDuration: 20,
};

let spawnedCount = 0;
let authenticatedCount = 0;
let lobbyStartCount = 0;
let gameConnectedCount = 0;
let finishedGameCount = 0;
let errorCount = 0;
const clients = [];

const sendReadyUp = (socket) => {
  if (!socket.connected) {
    return;
  }

  socket.emit("sendPlayerActions", {
    type: "readyUpPlayerAction",
  });
};

const createGuestToken = async () => {
  const response = await axios.get(AUTH_URL, {
    headers: {
      "User-Agent": "RLAutoTrainer",
    },
  });

  const cookies = response.headers["set-cookie"] || [];
  const guestTokenCookie = cookies.find((cookie) =>
    cookie.includes("guest-token=")
  );

  if (!guestTokenCookie) {
    throw new Error("Guest token cookie was not returned by server-info");
  }

  return guestTokenCookie.split("guest-token=")[1].split(";")[0];
};

async function createClient(index) {
  let readyInterval = null;
  let finishMatchInterval = null;
  let startedLobby = false;

  try {
    const token = await createGuestToken();
    const socket = io(GAME_SERVER_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: false,
      parser: msgpackParser,
    });

    const cleanup = () => {
      if (readyInterval) {
        clearInterval(readyInterval);
        readyInterval = null;
      }

      if (finishMatchInterval) {
        clearInterval(finishMatchInterval);
        finishMatchInterval = null;
      }
    };

    socket.on("connect", () => {
      socket.emit("authenticate", {
        type: "guest",
        data: {
          accessToken: token,
        },
      });
    });

    socket.on("authenticate_response", (response) => {
      if (response?.error) {
        errorCount++;
        console.error(`[X] Guest ${index} authenticate failed:`, response.error);
        socket.disconnect();
        return;
      }

      authenticatedCount++;
      console.log(`[✔] Guest ${index} authenticated (${authenticatedCount}/${GAME_COUNT})`);
    });

    socket.on("connected", () => {
      for (const [key, value] of Object.entries(FAST_SETTINGS)) {
        socket.emit("updateSetting", { key, value: String(value) });
      }

      if (!startedLobby) {
        startedLobby = true;
        lobbyStartCount++;
        socket.emit("startNow", { empty: true });
      }
    });

    socket.on("gameConnected", () => {
      gameConnectedCount++;
      sendReadyUp(socket);

      if (!readyInterval) {
        readyInterval = setInterval(() => sendReadyUp(socket), READY_PULSE_MS);
      }

      if (!finishMatchInterval) {
        finishMatchInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit("finishMatch", { empty: true });
          }
        }, FINISH_MATCH_PULSE_MS);
      }
    });

    socket.on("sendGameEvents", (packet) => {
      const action = packet?.payload;
      if (!action) {
        return;
      }

      if (
        action.type === "gamePhaseStartedEvent" &&
        action.payload?.phase === "PREPARING"
      ) {
        sendReadyUp(socket);
      }

      if (action.type === "gameFinishEvent") {
        finishedGameCount++;
        cleanup();
        console.log(`[🏁] Guest ${index} observed game finish (${finishedGameCount})`);
      }
    });

    socket.on("connect_error", (error) => {
      errorCount++;
      console.error(`[!] Guest ${index} socket error: ${error.message}`);
    });

    socket.on("disconnect", () => {
      cleanup();
    });

    clients.push(socket);
  } catch (error) {
    errorCount++;
    console.error(`[!] Failed to create guest ${index}: ${error.message}`);
  }
}

console.log(
  `� Auto-creating ${GAME_COUNT} fast training lobbies via ${GAME_SERVER_URL} using ${AUTH_URL}`
);

const interval = setInterval(() => {
  spawnedCount++;
  createClient(spawnedCount);

  if (spawnedCount >= GAME_COUNT) {
    clearInterval(interval);
  }
}, CLIENT_CREATION_INTERVAL_IN_MS);

setInterval(() => {
  console.log(
    `📊 guests=${spawnedCount}/${GAME_COUNT} authed=${authenticatedCount} lobbyStarts=${lobbyStartCount} gameConnected=${gameConnectedCount} finished=${finishedGameCount} errors=${errorCount}`
  );
}, 5000);
