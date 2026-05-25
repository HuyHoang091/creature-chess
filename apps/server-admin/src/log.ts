import winston = require("winston");

export type AdminLogEntry = {
	id: string;
	level: "info" | "warn" | "error";
	message: string;
	meta: string | null;
	createdAt: string;
};

const recentLogs: AdminLogEntry[] = [];
const RECENT_LOG_LIMIT = 200;

const pushRecentLog = (
	level: AdminLogEntry["level"],
	message: string,
	meta?: unknown
) => {
	recentLogs.push({
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
		level,
		message,
		meta: meta === undefined ? null : JSON.stringify(meta),
		createdAt: new Date().toISOString(),
	});

	if (recentLogs.length > RECENT_LOG_LIMIT) {
		recentLogs.splice(0, recentLogs.length - RECENT_LOG_LIMIT);
	}
};

const createWinstonLogger = () => {
	const newLogger = winston.createLogger();
	newLogger.add(new winston.transports.Console());
	return newLogger;
};

export const logger = createWinstonLogger();

const bindLevel = (level: AdminLogEntry["level"]) => {
	const original = logger[level].bind(logger);
	logger[level] = ((message: string, meta?: unknown) => {
		pushRecentLog(level, message, meta);
		return original(message, meta);
	}) as any;
};

bindLevel("info");
bindLevel("warn");
bindLevel("error");

export const getRecentLogEntries = (options?: {
	level?: "all" | "info" | "warn" | "error";
	limit?: number;
}) => {
	const level = options?.level ?? "all";
	const limit = options?.limit ?? 100;
	const filtered =
		level === "all" ? recentLogs : recentLogs.filter((item) => item.level === level);
	return filtered.slice(-limit).reverse();
};
