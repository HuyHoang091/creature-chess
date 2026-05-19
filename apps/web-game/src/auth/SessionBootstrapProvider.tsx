import React from "react";
import { useDispatch, useSelector } from "react-redux";

import { useAuth0 } from "@auth0/auth0-react";

import type { UserDTO } from "@creature-chess/models";

import { AUTH0_ENABLED } from "./auth0/config";
import { useLocalUserDTO } from "./auth0/internal/useLocalUserDto";
import { LocalPlayer } from "./LocalPlayer";
import { LocalPlayerContextProvider } from "./context";
import { fetchCurrentUser } from "../services/authApi";
import { ensureConnection } from "../services";
import { AppShellCommands } from "../store/appShell/state";
import { AuthCommands } from "../store/auth/state";
import { FriendsCommands } from "../store/friends/state";
import { ProfileCommands } from "../store/profile/state";
import { AppState } from "../store/state";

const AUTH_MODE_STORAGE_KEY = "cc-auth-mode";
const LOCAL_TOKEN_STORAGE_KEY = "cc-local-token";

const getStoredMode = () => {
	try {
		return localStorage.getItem(AUTH_MODE_STORAGE_KEY);
	} catch (error) {
		return null;
	}
};

export const setStoredMode = (mode: "guest" | "anonymous" | "account") => {
	try {
		localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
	} catch (error) {
		// ignore storage failures
	}
};

export const getStoredLocalToken = () => {
	try {
		return localStorage.getItem(LOCAL_TOKEN_STORAGE_KEY);
	} catch (error) {
		return null;
	}
};

export const setStoredLocalToken = (token: string | null) => {
	try {
		if (token) {
			localStorage.setItem(LOCAL_TOKEN_STORAGE_KEY, token);
		} else {
			localStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
		}
	} catch (error) {
		// ignore storage failures
	}
};

const useGuestBootstrap = () => {
	const dispatch = useDispatch();
	const mode = useSelector((state: AppState) => state.auth.mode);
	const [player, setPlayer] = React.useState<LocalPlayer | null>(null);

	React.useEffect(() => {
		if (mode !== "guest") {
			setPlayer(null);
			return;
		}

		const loadGuest = async () => {
			dispatch(AuthCommands.setStatus("loading"));
			dispatch(AppShellCommands.setScreen("auth-loading"));

			const response = await fetch(`${APP_API_URL}/guest/session`, {
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				dispatch(AppShellCommands.setLastError("Failed to create guest session"));
				dispatch(AuthCommands.setStatus("unauthenticated"));
				dispatch(AppShellCommands.setScreen("landing"));
				dispatch(AppShellCommands.setBootstrapped(true));
				return;
			}

			const { id } = await response.json();
			const nextPlayer: LocalPlayer = {
				type: "guest",
				id,
				nickname: `Guest ${id}`,
			};

			setStoredMode("guest");
			setPlayer(nextPlayer);
			dispatch(AuthCommands.setLocalPlayerId(id));
			dispatch(AuthCommands.setAccessToken(null));
			dispatch(AuthCommands.setStatus("authenticated"));
			dispatch(ProfileCommands.setCurrentUser(null));
			dispatch(AppShellCommands.setScreen("home"));
			dispatch(AppShellCommands.setBootstrapped(true));
		};

		loadGuest();
	}, [dispatch, mode]);

	return player;
};

const Auth0Bootstrap = ({ children }: { children: React.ReactNode }) => {
	const dispatch = useDispatch();
	const guestPlayer = useGuestBootstrap();
	const { isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
	const { user, isFetching, error } = useLocalUserDTO();
	const [player, setPlayer] = React.useState<LocalPlayer | null>(null);

	React.useEffect(() => {
		if (isLoading) {
			dispatch(AppShellCommands.setScreen("auth-loading"));
			dispatch(AuthCommands.setStatus("loading"));
			return;
		}

		if (!isAuthenticated) {
			const storedMode = getStoredMode();
			if (storedMode === "guest") {
				dispatch(AuthCommands.setMode("guest"));
				return;
			}

			dispatch(AuthCommands.setMode("anonymous"));
			dispatch(AuthCommands.setStatus("unauthenticated"));
			dispatch(AppShellCommands.setScreen("landing"));
			dispatch(AppShellCommands.setBootstrapped(true));
			setPlayer(null);
			return;
		}

		dispatch(AuthCommands.setMode("account"));
		dispatch(AuthCommands.setStatus("loading"));
		dispatch(AppShellCommands.setScreen("auth-loading"));
	}, [dispatch, isAuthenticated, isLoading]);

	React.useEffect(() => {
		if (!isAuthenticated || isLoading || isFetching || !user) {
			if (error) {
				dispatch(AppShellCommands.setLastError(error));
				dispatch(AppShellCommands.setScreen("landing"));
				dispatch(AppShellCommands.setBootstrapped(true));
			}
			return;
		}

		const hydrate = async (currentUser: UserDTO) => {
			const token = await getAccessTokenSilently();
			const playerValue: LocalPlayer = {
				...currentUser,
				type: "user",
			};

			setStoredMode("anonymous");
			setPlayer(playerValue);
			dispatch(AuthCommands.setMode("account"));
			dispatch(AuthCommands.setStatus("authenticated"));
			dispatch(AuthCommands.setLocalPlayerId(currentUser.id));
			dispatch(AuthCommands.setAccessToken(token));
			dispatch(
				AuthCommands.setRequiresProfileCompletion(!currentUser.registered)
			);
			dispatch(ProfileCommands.setCurrentUser(currentUser));
			dispatch(
				AppShellCommands.setScreen(
					currentUser.registered ? "home" : "complete-profile"
				)
			);
			dispatch(AppShellCommands.setBootstrapped(true));
		};

		hydrate(user).catch(async () => {
			try {
				const token = await getAccessTokenSilently();
				const refreshed = await fetchCurrentUser(token);
				await hydrate(refreshed);
			} catch (requestError) {
				dispatch(
					AppShellCommands.setLastError("Failed to load authenticated profile")
				);
				dispatch(AppShellCommands.setScreen("landing"));
				dispatch(AppShellCommands.setBootstrapped(true));
			}
		});
	}, [
		dispatch,
		error,
		getAccessTokenSilently,
		isAuthenticated,
		isFetching,
		isLoading,
		user,
	]);

	return (
		<LocalPlayerContextProvider value={player ?? guestPlayer}>
			{children}
		</LocalPlayerContextProvider>
	);
};

const LocalBootstrap = ({ children }: { children: React.ReactNode }) => {
	const dispatch = useDispatch();
	const guestPlayer = useGuestBootstrap();
	const [player, setPlayer] = React.useState<LocalPlayer | null>(null);

	React.useEffect(() => {
		const token = getStoredLocalToken();
		const mode = getStoredMode();

		if (mode === "guest") {
			dispatch(AuthCommands.setMode("guest"));
			return;
		}

		if (!token) {
			dispatch(AuthCommands.setMode("anonymous"));
			dispatch(AuthCommands.setStatus("unauthenticated"));
			dispatch(AppShellCommands.setScreen("landing"));
			dispatch(AppShellCommands.setBootstrapped(true));
			setPlayer(null);
			return;
		}

		const hydrateLocalUser = async () => {
			dispatch(AuthCommands.setStatus("loading"));
			dispatch(AppShellCommands.setScreen("auth-loading"));

			try {
				const currentUser = await fetchCurrentUser(token);
				const playerValue: LocalPlayer = {
					...currentUser,
					type: "user",
				};

				setStoredMode("account");
				setPlayer(playerValue);
				dispatch(AuthCommands.setMode("account"));
				dispatch(AuthCommands.setStatus("authenticated"));
				dispatch(AuthCommands.setLocalPlayerId(currentUser.id));
				dispatch(AuthCommands.setAccessToken(token));
				dispatch(
					AuthCommands.setRequiresProfileCompletion(!currentUser.registered)
				);
				dispatch(ProfileCommands.setCurrentUser(currentUser));
				dispatch(
					AppShellCommands.setScreen(
						currentUser.registered ? "home" : "complete-profile"
					)
				);
				dispatch(AppShellCommands.setBootstrapped(true));
			} catch (error) {
				setStoredLocalToken(null);
				setStoredMode("anonymous");
				dispatch(AuthCommands.resetAuth());
				dispatch(AppShellCommands.setScreen("landing"));
				dispatch(AppShellCommands.setBootstrapped(true));
			}
		};

		hydrateLocalUser();
	}, [dispatch]);

	return (
		<LocalPlayerContextProvider value={player ?? guestPlayer}>
			{children}
		</LocalPlayerContextProvider>
	);
};

export const SessionBootstrapProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const mode = useSelector((state: AppState) => state.auth.mode);
	const status = useSelector((state: AppState) => state.auth.status);
	const requiresProfileCompletion = useSelector(
		(state: AppState) => state.auth.requiresProfileCompletion
	);

	React.useEffect(() => {
		if (
			mode !== "account" ||
			requiresProfileCompletion ||
			!token ||
			status !== "authenticated"
		) {
			if (mode !== "account" || requiresProfileCompletion) {
				dispatch(FriendsCommands.reset());
			}
			return;
		}
		dispatch(ensureConnection());
	}, [dispatch, mode, requiresProfileCompletion, status, token]);

	return AUTH0_ENABLED ? (
		<Auth0Bootstrap>{children}</Auth0Bootstrap>
	) : (
		<LocalBootstrap>{children}</LocalBootstrap>
	);
};
