export type HandshakeIntent = "social" | "matchmake";

export type HandshakeRequest =
	| { type: "auth0"; data: { accessToken: string; intent?: HandshakeIntent } }
	| { type: "local"; data: { accessToken: string; intent?: HandshakeIntent } }
	| { type: "guest"; data: { accessToken: string; intent?: HandshakeIntent } };
