import React from "react";

import { useAuth0 } from "@auth0/auth0-react";
import { LogOut, Shield, UserCog } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
	setStoredLocalToken,
	setStoredMode,
} from "~/auth/SessionBootstrapProvider";
import { AUTH0_ENABLED } from "~/auth/auth0/config";
import { logoutLocal } from "~/services/authApi";
import { clearCurrentSocket } from "~/services/socket";
import { AppShellCommands } from "~/store/appShell/state";
import { AuthCommands } from "~/store/auth/state";
import { FriendsCommands } from "~/store/friends/state";
import { ProfileCommands } from "~/store/profile/state";
import { AppState } from "~/store/state";

import styles from "./SettingsPage.module.css";

const SettingsContent = ({ auth0Logout }: { auth0Logout?: () => void }) => {
	const dispatch = useDispatch();
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const currentUser = useSelector(
		(state: AppState) => state.profile.currentUser
	);
	const [working, setWorking] = React.useState(false);

	const resetClientSession = () => {
		clearCurrentSocket();
		setStoredLocalToken(null);
		setStoredMode("anonymous");
		dispatch(FriendsCommands.reset());
		dispatch(ProfileCommands.setCurrentUser(null));
		dispatch(AuthCommands.resetAuth());
		dispatch(AppShellCommands.setPanel(null));
		dispatch(AppShellCommands.setScreen("landing"));
	};

	const onLogout = async () => {
		setWorking(true);
		try {
			if (token) {
				await logoutLocal(token).catch(() => undefined);
			}
		} finally {
			resetClientSession();
			setWorking(false);
			auth0Logout?.();
		}
	};

	return (
		<div className={styles.root}>
			<div className={styles.accountBlock}>
				<div className={styles.avatar}>
					{(currentUser?.nickname?.[0] || "G").toUpperCase()}
				</div>
				<div>
					<div className={styles.name}>
						{currentUser?.nickname ||
							(authMode === "guest" ? "Guest" : "Player")}
					</div>
					<div className={styles.meta}>
						{authMode === "account"
							? currentUser?.email || "Account"
							: "Guest session"}
					</div>
				</div>
			</div>

			<button
				className={styles.rowButton}
				onClick={() => dispatch(AppShellCommands.setPanel("profile"))}
				disabled={authMode !== "account"}
			>
				<UserCog size={18} />
				<span>Profile Management</span>
			</button>

			{currentUser?.role === "admin" && (
				<button
					className={styles.rowButton}
					onClick={() => (window.location.href = APP_ADMIN_URL)}
				>
					<Shield size={18} />
					<span>Admin Console</span>
				</button>
			)}

			<button
				className={`${styles.rowButton} ${styles.danger}`}
				onClick={onLogout}
				disabled={working || authMode === "anonymous"}
			>
				<LogOut size={18} />
				<span>{working ? "Signing out..." : "Sign Out"}</span>
			</button>
		</div>
	);
};

const Auth0SettingsPage = () => {
	const { logout } = useAuth0();
	return (
		<SettingsContent
			auth0Logout={() => logout({ returnTo: window.location.origin })}
		/>
	);
};

export const SettingsPage = () =>
	AUTH0_ENABLED ? <Auth0SettingsPage /> : <SettingsContent />;
