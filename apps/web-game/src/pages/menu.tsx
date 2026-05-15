import * as React from "react";
import { useDispatch, useSelector } from "react-redux";

import { useAuth0 } from "@auth0/auth0-react";

import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { AUTH0_ENABLED } from "~/auth/auth0/config";
import {
	setStoredLocalToken,
	setStoredMode,
} from "~/auth/SessionBootstrapProvider";
import { openConnection } from "~/services";
import { loginLocal, registerLocal } from "~/services/authApi";
import { AppShellCommands } from "~/store/appShell/state";
import { AuthCommands } from "~/store/auth/state";
import { ProfileCommands } from "~/store/profile/state";
import { AppState } from "~/store";

import styles from "./MenuPage.module.css";

const LandingAccountActions = () => {
	const { loginWithRedirect } = useAuth0();

	return (
		<button className={styles.primaryBtn} onClick={() => loginWithRedirect()}>
			Sign In
		</button>
	);
};

export function MenuPage() {
	const dispatch = useDispatch();
	const loadingMessage = useSelector(
		(state: AppState) => state.menu.loadingMessage
	);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const authStatus = useSelector((state: AppState) => state.auth.status);
	const [email, setEmail] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [formMode, setFormMode] = React.useState<"login" | "register">("login");
	const [error, setError] = React.useState<string | null>(null);

	const onPlayGuest = React.useCallback(() => {
		setStoredMode("guest");
		dispatch(AuthCommands.setMode("guest"));
	}, [dispatch]);

	const onQuickPlay = React.useCallback(() => {
		dispatch(openConnection());
	}, [dispatch]);

	const onLocalAuth = React.useCallback(async () => {
		setError(null);
		dispatch(AuthCommands.setStatus("loading"));

		try {
			const response =
				formMode === "login"
					? await loginLocal(email, password)
					: await registerLocal(email, password);

			setStoredMode("account");
			setStoredLocalToken(response.token);
			dispatch(AuthCommands.setMode("account"));
			dispatch(AuthCommands.setStatus("authenticated"));
			dispatch(AuthCommands.setAccessToken(response.token));
			dispatch(AuthCommands.setLocalPlayerId(response.user.id));
			dispatch(
				AuthCommands.setRequiresProfileCompletion(!response.user.registered)
			);
			dispatch(ProfileCommands.setCurrentUser(response.user));
			dispatch(
				AppShellCommands.setScreen(
					response.user.registered ? "home" : "complete-profile"
				)
			);
		} catch (authError) {
			setError((authError as Error).message);
			dispatch(AuthCommands.setStatus("unauthenticated"));
		}
	}, [dispatch, email, formMode, password]);

	if (loadingMessage || authStatus === "loading") {
		return <LoadingScreen message={loadingMessage || "Loading session..."} />;
	}

	return (
		<div className={styles.root}>
			<div className={styles.panel}>
				<div>
					<h1 className={styles.title}>Creature Chess</h1>
					<p className={styles.muted}>
						Auto battler prototype with a new app shell for guest play, account
						profiles, friends, history, and the next layer of social systems.
					</p>
				</div>

				<div className={styles.form}>
					{AUTH0_ENABLED && authMode !== "guest" && <LandingAccountActions />}

					{!AUTH0_ENABLED && (
						<>
							<input
								className={styles.input}
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder="Email"
							/>
							<input
								className={styles.input}
								type="password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Password"
							/>
							<button className={styles.primaryBtn} onClick={onLocalAuth}>
								{formMode === "login" ? "Sign In" : "Create Account"}
							</button>
							<button
								className={styles.secondaryBtn}
								onClick={() =>
									setFormMode((prev) =>
										prev === "login" ? "register" : "login"
									)
								}
							>
								{formMode === "login"
									? "Need an account? Register"
									: "Already have an account? Sign In"}
							</button>
							{error && <div className={styles.error}>{error}</div>}
						</>
					)}

					<button className={styles.secondaryBtn} onClick={onPlayGuest}>
						Enter as Guest
					</button>

					<button
						className={styles.secondaryBtn}
						onClick={() => dispatch(AppShellCommands.setModal("signin-required"))}
					>
						Friends and Party
					</button>

					{authMode === "guest" && (
						<button className={styles.primaryBtn} onClick={onQuickPlay}>
							Quick Match Now
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
