import { apiFetch } from "./api";

export const pingPresence = (token: string, state: string) =>
	apiFetch<null>(
		"/presence/ping",
		{
			method: "POST",
			body: JSON.stringify({ state }),
		},
		token
	);
