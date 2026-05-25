import express from "express";
import { logger as expressWinston } from "express-winston";
import { createServer } from "http";
import { register } from "prom-client";
import { Server } from "socket.io";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const customParser = require("socket.io-msgpack-parser");
import { createAdapter } from "@socket.io/redis-adapter";
import { instrument } from "@socket.io/admin-ui";
import { createClient } from "redis";
//

import { basicAuth } from "./src/basicAuth";
import { logger } from "./src/log";
import { startServer } from "./src/server";

process.on("unhandledRejection", function (reason, p) {
	console.log(
		"Possibly Unhandled Rejection at: Promise ",
		p,
		" reason: ",
		reason
	);
	// application specific logging here
});

const port = parseInt(process.env.PORT || "3001", 10);

const app = express();
const server = createServer(app);
// const io = new Server(server, { path: "/socket.io" });

// new
const io = new Server(server, {
	path: "/socket.io",
	parser: customParser,
	cors: {
		origin: (origin, callback) => {
			callback(null, true);
		},
		credentials: true
	}
});

instrument(io, {
	auth: {
		type: "basic",
		username: process.env.METRICS_USERNAME || "admin",
		password: "$2a$10$EIUx8YNvZIQAQxxdkRmV4O/zTShiNzxf9uDGrtCX9fJKPHSEtyyiu",
	},
	mode: process.env.NODE_ENV === "production" ? "production" : "development"
});

logger.info(`Registered namespaces: ${Array.from(io._nsps.keys())}`);

if (process.env.REDIS_URL) {
	logger.info(`Conneting to Redis adapter: ${process.env.REDIS_URL}`);
	const pubClient = createClient({ url: process.env.REDIS_URL });
	const subClient = pubClient.duplicate();

	Promise.all([pubClient.connect(), subClient.connect()])
		.then(() => {
			io.adapter(createAdapter(pubClient, subClient));
			logger.info(`Redis adapter connected`);
		})
		.catch((error) => {
			logger.error("Redis adapter connection failed, continuing without adapter", error);
		});
}
// new

app.use(expressWinston({ winstonInstance: logger }));

app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok", service: "game" });
});

if (process.env.METRICS_USERNAME && process.env.METRICS_PASSWORD) {
	app.get(
		"/metrics",
		basicAuth(process.env.METRICS_USERNAME, process.env.METRICS_PASSWORD),
		async (req, res) => {
			res.setHeader("Content-Type", register.contentType);
			res.end(await register.metrics());
		}
	);
} else {
	console.warn(
		"Metrics endpoint is not active. Please set METRICS_USERNAME and METRICS_PASSWORD environment variables."
	);
}

startServer({ io }).catch((e) => {
	logger.error("An error occurred while starting the server", e);
	process.exit(1);
});

server.listen(port, "0.0.0.0");
logger.info(`Server running on port ${port}`);
