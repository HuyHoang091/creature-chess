import type { UserDTO } from "@creature-chess/models";

import { apiFetch } from "./api";

export type LocalAuthResponse = {
	token: string;
	user: UserDTO;
};

export const fetchCurrentUser = (token: string) =>
	apiFetch<UserDTO>("/user/current", { method: "GET" }, token);

export const updateCurrentUser = (
	token: string,
	payload: { nickname: string; picture: string }
) =>
	apiFetch<UserDTO>(
		"/user/current",
		{
			method: "PATCH",
			body: JSON.stringify(payload),
		},
		token
	);

export const loginLocal = (email: string, password: string) =>
	apiFetch<LocalAuthResponse>("/auth/local/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});

export const registerLocal = (email: string, password: string) =>
	apiFetch<LocalAuthResponse>("/auth/local/register", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});

export const logoutLocal = (token: string) =>
	apiFetch<null>("/auth/local/logout", { method: "POST" }, token);
