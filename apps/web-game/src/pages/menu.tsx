import * as React from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { Lock, LogIn, Mail, Swords, UserPlus, Users } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
	setStoredLocalToken,
	setStoredMode,
} from "~/auth/SessionBootstrapProvider";
import { AUTH0_ENABLED } from "~/auth/auth0/config";
import { LoadingScreen } from "~/components/ui/LoadingScreen";
import { openConnection } from "~/services";
import { loginLocal, registerLocal } from "~/services/authApi";
import { AppState } from "~/store";
import { AppShellCommands } from "~/store/appShell/state";
import { AuthCommands } from "~/store/auth/state";
import { ProfileCommands } from "~/store/profile/state";

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
			<div className={styles.loginFrame}>
				<div className={styles.logoBlock}>
					<img
						src={`${APP_IMAGE_ROOT}/ui/logo.png`}
						alt="Creature Chess"
						className={styles.logo}
						onError={(event) => {
							(event.target as HTMLImageElement).style.display = "none";
						}}
					/>
				</div>

				<div className={styles.authSurface}>
					<div className={styles.formHeader}>
						<div className={styles.formEyebrow}>Creature Chess Account</div>
						<div className={styles.formTitle}>
							{formMode === "login" ? "Sign In" : "Create Account"}
						</div>
						<div className={styles.formSubtitle}>
							{formMode === "login"
								? "Return to your profile and social hub."
								: "Start with email and password, then choose nickname and avatar."}
						</div>
					</div>

					{AUTH0_ENABLED && authMode !== "guest" && <LandingAccountActions />}

					{!AUTH0_ENABLED && (
						<>
							<div className={styles.modeSwitch}>
								<button
									className={formMode === "login" ? styles.modeActive : ""}
									onClick={() => setFormMode("login")}
								>
									<LogIn size={15} />
									Sign In
								</button>
								<button
									className={formMode === "register" ? styles.modeActive : ""}
									onClick={() => setFormMode("register")}
								>
									<UserPlus size={15} />
									Register
								</button>
							</div>
							<label className={styles.inputWrap}>
								<Mail size={18} />
								<input
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="Email"
								/>
							</label>
							<label className={styles.inputWrap}>
								<Lock size={18} />
								<input
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="Password"
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											onLocalAuth();
										}
									}}
								/>
							</label>
							<button className={styles.primaryBtn} onClick={onLocalAuth}>
								{formMode === "login" ? (
									<LogIn size={18} />
								) : (
									<UserPlus size={18} />
								)}
								{formMode === "login" ? "Sign In" : "Create Account"}
							</button>
							{error && <div className={styles.error}>{error}</div>}
						</>
					)}

					<div className={styles.quickActions}>
						<button className={styles.secondaryBtn} onClick={onPlayGuest}>
							<Swords size={18} />
							Guest
						</button>

						<button
							className={styles.secondaryBtn}
							onClick={() =>
								dispatch(AppShellCommands.setModal("signin-required"))
							}
						>
							<Users size={18} />
							Social
						</button>
					</div>

					{authMode === "guest" && (
						<button className={styles.primaryBtn} onClick={onQuickPlay}>
							<Swords size={18} />
							Quick Match Now
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
