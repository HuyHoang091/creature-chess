import React from "react";

import { Home, Users, Clock, User, Shield } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { AppShellCommands, AppScreen } from "~/store/appShell/state";
import { AppState } from "~/store/state";

import styles from "./DockBar.module.css";

type DockItem = {
	screen: AppScreen;
	icon: React.ReactNode;
	label: string;
	requiresAccount?: boolean;
};

const dockItems: DockItem[] = [
	{ screen: "home", icon: <Home size={22} />, label: "Home" },
	{
		screen: "profile",
		icon: <User size={22} />,
		label: "Profile",
		requiresAccount: true,
	},
	{
		screen: "friends",
		icon: <Users size={22} />,
		label: "Friends",
		requiresAccount: true,
	},
	{
		screen: "history",
		icon: <Clock size={22} />,
		label: "History",
		requiresAccount: true,
	},
];

export const DockBar = () => {
	const dispatch = useDispatch();
	const screen = useSelector((state: AppState) => state.appShell.screen);
	const panel = useSelector((state: AppState) => state.appShell.panel);
	const authMode = useSelector((state: AppState) => state.auth.mode);
	const role = useSelector(
		(state: AppState) => state.profile.currentUser?.role
	);

	const activeScreen = panel ?? screen;
	const visibleItems =
		role === "admin"
			? [
					...dockItems,
					{
						screen: "admin" as AppScreen,
						icon: <Shield size={22} />,
						label: "Admin",
						requiresAccount: true,
					},
				]
			: dockItems;

	const onClick = (item: DockItem) => {
		if (item.requiresAccount && authMode !== "account") {
			dispatch(AppShellCommands.setModal("signin-required"));
			return;
		}
		if (item.screen === "admin") {
			window.location.href = `${window.location.origin}/admin`;
			return;
		}
		if (activeScreen === item.screen) {
			dispatch(AppShellCommands.setPanel(null));
			if (screen !== "home") {
				dispatch(AppShellCommands.setScreen("home"));
			}
		} else {
			if (item.screen === "home") {
				dispatch(AppShellCommands.setScreen("home"));
				dispatch(AppShellCommands.setPanel(null));
			} else {
				dispatch(AppShellCommands.setPanel(item.screen));
			}
		}
	};

	return (
		<div className={styles.dock}>
			{visibleItems.map((item) => {
				const isActive = activeScreen === item.screen;
				return (
					<button
						key={item.screen}
						className={`${styles.dockItem} ${isActive ? styles.active : ""}`}
						onClick={() => onClick(item)}
						title={item.label}
					>
						<div className={styles.iconWrap}>{item.icon}</div>
						<span className={styles.label}>{item.label}</span>
						{isActive && <div className={styles.indicator} />}
					</button>
				);
			})}
		</div>
	);
};
