import { Request, Response, NextFunction } from "express";

export function basicAuth(username: string, password: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		const auth = req.headers.authorization;
		if (!auth) {
			res.set("WWW-Authenticate", 'Basic realm="metrics"');
			return res.status(401).send("Authentication required");
		}

		const [type, encoded] = auth.split(" ");
		if (type !== "Basic") {
			res.set("WWW-Authenticate", 'Basic realm="metrics"');
			return res.status(401).send("Authentication required");
		}

		const decoded = Buffer.from(encoded, "base64").toString();
		const [user, pass] = decoded.split(":");

		if (user === username && pass === password) {
			return next();
		}

		res.set("WWW-Authenticate", 'Basic realm="metrics"');
		return res.status(401).send("Authentication failed");
	};
}
