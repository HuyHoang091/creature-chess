import React from "react";

import {
	Activity,
	AlertTriangle,
	Bot,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Download,
	Flag,
	Globe,
	Lock,
	LogOut,
	Menu,
	Moon,
	Plus,
	RefreshCw,
	RotateCcw,
	Server,
	Shield,
	Sun,
	Users,
} from "lucide-react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import {
	adminApi,
	type AdminBot,
	type AdminEvent,
	type AdminOverview,
	type AdminPermission,
	type AdminReportDetail,
	type AdminReportListItem,
	type AdminSessionUser,
	type AdminUserDetail,
	type AdminUserListItem,
	type MonitoringResponse,
	getStoredAdminToken,
	setStoredAdminToken,
} from "./api";
import styles from "./App.module.css";
import { TRANSLATIONS, type TranslationKey } from "./translations";
import {
	ALL_PERMISSIONS,
	APP_ADMIN_API_URL,
	APP_VERSION,
	BOT_LABELS,
	downloadWithToken,
	formatActivityMeta,
	formatDateTime,
	formatDuration,
	formatPercent,
	getActionTypeLabel,
	getActivityActionLabel,
	getPermissionLabel,
	getReasonLabelStr,
	getRoleLabel,
	getStatusLabel,
	hasPermission,
} from "./helpers";
import { Modal, StatCard, ToastContainer, useToast } from "./components";

type TabId =
	| "overview"
	| "users"
	| "reports"
	| "monitoring"
	| "bots"
	| "events";

type TabConfig = {
	id: TabId;
	label: string;
	icon: React.ReactNode;
	permission?: AdminPermission;
};

const TABS: TabConfig[] = [
	{ id: "overview", label: "Tổng quan", icon: <Activity size={18} /> },
	{
		id: "users",
		label: "Người dùng",
		icon: <Users size={18} />,
		permission: "user_management",
	},
	{
		id: "reports",
		label: "Báo cáo",
		icon: <Flag size={18} />,
		permission: "report_management",
	},
	{
		id: "monitoring",
		label: "Giám sát",
		icon: <Server size={18} />,
		permission: "server_monitoring",
	},
	{
		id: "bots",
		label: "Bot AI",
		icon: <Bot size={18} />,
		permission: "bot_management",
	},
	{
		id: "events",
		label: "Sự kiện",
		icon: <CalendarDays size={18} />,
		permission: "event_management",
	},
];
export const App = () => {
	const [token, setToken] = React.useState<string | null>(() => getStoredAdminToken());
	const [currentUser, setCurrentUser] = React.useState<AdminSessionUser | null>(null);
	const [booting, setBooting] = React.useState(true);
	const [authError, setAuthError] = React.useState<string | null>(null);
	const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
	const [loginBusy, setLoginBusy] = React.useState(false);
	const [tab, setTab] = React.useState<TabId>("overview");
	const [refreshKey, setRefreshKey] = React.useState(0);

	const { toasts, show: showToast } = useToast();
	const [lockMode, setLockMode] = React.useState<"temporary" | "permanent">("temporary");
	const [activityPage, setActivityPage] = React.useState(1);

	// Theme state
	const [theme, setTheme] = React.useState<"dark" | "light">(() => {
		try {
			return (localStorage.getItem("cc-admin-theme") as "dark" | "light") || "dark";
		} catch (_e) {
			return "dark";
		}
	});

	// Language state
	const [lang, setLang] = React.useState<"vi" | "en">(() => {
		try {
			return (localStorage.getItem("cc-admin-lang") as "vi" | "en") || "vi";
		} catch (_e) {
			return "vi";
		}
	});

	// Sidebar Collapse state
	const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
		try {
			return localStorage.getItem("cc-admin-sidebar-collapsed") === "true";
		} catch (_e) {
			return false;
		}
	});

	// Event Modal state
	const [isCreateEventOpen, setIsCreateEventOpen] = React.useState(false);

	// User detail Modal tab state
	const [activeUserTab, setActiveUserTab] = React.useState<"basic" | "activity" | "permissions">("basic");

	// Localizer helper
	const t = React.useCallback(
		(key: TranslationKey) => {
			return TRANSLATIONS[lang][key] || TRANSLATIONS.en[key] || String(key);
		},
		[lang]
	);

	React.useEffect(() => {
		try {
			localStorage.setItem("cc-admin-theme", theme);
		} catch (_e) {}
	}, [theme]);

	React.useEffect(() => {
		try {
			localStorage.setItem("cc-admin-lang", lang);
		} catch (_e) {}
	}, [lang]);

	React.useEffect(() => {
		try {
			localStorage.setItem("cc-admin-sidebar-collapsed", String(sidebarCollapsed));
		} catch (_e) {}
	}, [sidebarCollapsed]);

	const [overview, setOverview] = React.useState<AdminOverview | null>(null);
	const [overviewBusy, setOverviewBusy] = React.useState(false);

	const [users, setUsers] = React.useState<AdminUserListItem[]>([]);
	const [usersBusy, setUsersBusy] = React.useState(false);
	const [userFilters, setUserFilters] = React.useState({
		q: "",
		status: "all",
		nextCursor: null as string | null,
	});
	const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
	const [selectedUser, setSelectedUser] = React.useState<AdminUserDetail | null>(null);
	const [selectedUserBusy, setSelectedUserBusy] = React.useState(false);
	const [activityType, setActivityType] = React.useState("");

	const ITEMS_PER_PAGE = 10;
	const paginatedActivity = React.useMemo(() => {
		if (!selectedUser?.activity) return [];
		const startIndex = (activityPage - 1) * ITEMS_PER_PAGE;
		return selectedUser.activity.slice(startIndex, startIndex + ITEMS_PER_PAGE);
	}, [selectedUser?.activity, activityPage]);

	const [reports, setReports] = React.useState<AdminReportListItem[]>([]);
	const [reportsBusy, setReportsBusy] = React.useState(false);
	const [reportFilters, setReportFilters] = React.useState({
		status: "all",
		reason: "all",
		windowDays: 30,
		sortBy: "newest",
	});
	const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
	const [selectedReport, setSelectedReport] = React.useState<AdminReportDetail | null>(null);
	const [selectedReportBusy, setSelectedReportBusy] = React.useState(false);

	const [bots, setBots] = React.useState<AdminBot[]>([]);
	const [botsBusy, setBotsBusy] = React.useState(false);
	const [selectedBotId, setSelectedBotId] = React.useState<string | null>(null);
	const [selectedBotDraft, setSelectedBotDraft] = React.useState<AdminBot | null>(null);
	const [botCheckpoints, setBotCheckpoints] = React.useState<Record<string, Pick<AdminBot, "ambition" | "composure" | "vision">>>({});

	const [events, setEvents] = React.useState<AdminEvent[]>([]);
	const [eventsBusy, setEventsBusy] = React.useState(false);
	const [editingEvent, setEditingEvent] = React.useState<AdminEvent | null>(null);
	const [eventDraft, setEventDraft] = React.useState({
		name: "",
		description: "",
		status: "draft" as AdminEvent["status"],
		startsAt: "",
		endsAt: "",
	});

	const [monitoring, setMonitoring] = React.useState<MonitoringResponse | null>(null);
	const [monitoringBusy, setMonitoringBusy] = React.useState(false);
	const [monitoringRange, setMonitoringRange] = React.useState("1h");
	const [logLevel, setLogLevel] = React.useState("all");
	const [pageError, setPageError] = React.useState<string | null>(null);

	const visibleTabs = React.useMemo(
		() => TABS.filter((item) => hasPermission(currentUser, item.permission)),
		[currentUser]
	);

	const loadOverview = React.useCallback(async () => {
		if (!token) {
			return;
		}
		setOverviewBusy(true);
		try {
			setOverview(await adminApi.overview(token));
		} catch (error) {
			setPageError((error as Error).message);
		} finally {
			setOverviewBusy(false);
		}
	}, [token]);

	const loadUsers = React.useCallback(
		async (append = false, cursor: string | null = null) => {
			if (!token || !hasPermission(currentUser, "user_management")) {
				return;
			}
			setUsersBusy(true);
			try {
				const payload = await adminApi.users(token, {
					q: userFilters.q,
					status: userFilters.status,
					cursor: append ? cursor : null,
					limit: 50,
				});
				setUsers((prev) => (append ? [...prev, ...payload.users] : payload.users));
				setUserFilters((state) => ({
					...state,
					nextCursor: payload.nextCursor,
				}));
			} catch (error) {
				setPageError((error as Error).message);
			} finally {
				setUsersBusy(false);
			}
		},
		[currentUser, token, userFilters.q, userFilters.status]
	);

	const loadUserDetail = React.useCallback(
		async (userId: string) => {
			if (!token) {
				return;
			}
			setSelectedUserBusy(true);
			try {
				setSelectedUser(await adminApi.userDetail(token, userId, activityType));
			} catch (error) {
				setPageError((error as Error).message);
			} finally {
				setSelectedUserBusy(false);
			}
		},
		[token, activityType]
	);

	const loadReports = React.useCallback(async () => {
		if (!token || !hasPermission(currentUser, "report_management")) {
			return;
		}
		setReportsBusy(true);
		try {
			const payload = await adminApi.reports(token, reportFilters);
			setReports(payload.reports);
		} catch (error) {
			setPageError((error as Error).message);
		} finally {
			setReportsBusy(false);
		}
	}, [currentUser, reportFilters, token]);

	const loadReportDetail = React.useCallback(
		async (reportId: string) => {
			if (!token) {
				return;
			}
			setSelectedReportBusy(true);
			try {
				setSelectedReport(await adminApi.reportDetail(token, reportId));
			} catch (error) {
				setPageError((error as Error).message);
			} finally {
				setSelectedReportBusy(false);
			}
		},
		[token]
	);

	const loadBots = React.useCallback(async () => {
		if (!token || !hasPermission(currentUser, "bot_management")) {
			return;
		}
		setBotsBusy(true);
		try {
			const payload = await adminApi.bots(token);
			setBots(payload.bots);

			const checkpoints: Record<string, Pick<AdminBot, "ambition" | "composure" | "vision">> = {};
			payload.bots.forEach((b) => {
				checkpoints[b.id] = {
					ambition: b.ambition,
					composure: b.composure,
					vision: b.vision,
				};
			});
			setBotCheckpoints(checkpoints);
		} catch (error) {
			setPageError((error as Error).message);
		} finally {
			setBotsBusy(false);
		}
	}, [currentUser, token]);

	const loadEvents = React.useCallback(async () => {
		if (!token || !hasPermission(currentUser, "event_management")) {
			return;
		}
		setEventsBusy(true);
		try {
			const payload = await adminApi.events(token);
			setEvents(payload.events);
		} catch (error) {
			setPageError((error as Error).message);
		} finally {
			setEventsBusy(false);
		}
	}, [currentUser, token]);

	const loadMonitoring = React.useCallback(async () => {
		if (!token || !hasPermission(currentUser, "server_monitoring")) {
			return;
		}
		setMonitoringBusy(true);
		try {
			setMonitoring(await adminApi.monitoring(token, { range: monitoringRange, logLevel }));
		} catch (error) {
			setPageError((error as Error).message);
		} finally {
			setMonitoringBusy(false);
		}
	}, [currentUser, logLevel, monitoringRange, token]);

	React.useEffect(() => {
		document.title = "Creature Chess Admin";
	}, []);

	React.useEffect(() => {
		const bootstrap = async () => {
			if (!token) {
				setBooting(false);
				return;
			}
			try {
				const payload = await adminApi.me(token);
				setCurrentUser(payload.user);
				setAuthError(null);
			} catch (error) {
				setStoredAdminToken(null);
				setToken(null);
				setCurrentUser(null);
				setAuthError((error as Error).message);
			} finally {
				setBooting(false);
			}
		};
		bootstrap().catch(() => {
			setBooting(false);
		});
	}, [token]);

	React.useEffect(() => {
		if (!currentUser) {
			return;
		}
		if (!visibleTabs.some((item) => item.id === tab)) {
			setTab(visibleTabs[0]?.id || "overview");
		}
	}, [currentUser, tab, visibleTabs]);

	React.useEffect(() => {
		if (!currentUser || !token) {
			return;
		}
		loadOverview().catch(() => undefined);
	}, [currentUser, token, refreshKey, loadOverview]);

	React.useEffect(() => {
		if (!currentUser) {
			return;
		}
		if (tab === "users") {
			loadUsers(false).catch(() => undefined);
		} else if (tab === "reports") {
			loadReports().catch(() => undefined);
		} else if (tab === "bots") {
			loadBots().catch(() => undefined);
		} else if (tab === "events") {
			loadEvents().catch(() => undefined);
		} else if (tab === "monitoring") {
			loadMonitoring().catch(() => undefined);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser, tab, refreshKey]);

	React.useEffect(() => {
		setActivityPage(1);
		setLockMode("temporary");
		if (!selectedUserId) {
			setSelectedUser(null);
			return;
		}
		loadUserDetail(selectedUserId).catch(() => undefined);
	}, [selectedUserId, loadUserDetail]);

	React.useEffect(() => {
		setActivityPage(1);
	}, [activityType]);

	React.useEffect(() => {
		if (!selectedReportId) {
			setSelectedReport(null);
			return;
		}
		loadReportDetail(selectedReportId).catch(() => undefined);
	}, [selectedReportId, loadReportDetail]);

	React.useEffect(() => {
		if (!token || !currentUser) {
			return;
		}
		const timer = window.setInterval(() => {
			loadOverview().catch(() => undefined);
			if (tab === "monitoring") {
				loadMonitoring().catch(() => undefined);
			}
		}, 30_000);
		return () => window.clearInterval(timer);
	}, [currentUser, loadMonitoring, loadOverview, tab, token]);

	const onLogin = async (event: React.FormEvent) => {
		event.preventDefault();
		setLoginBusy(true);
		setAuthError(null);
		try {
			const payload = await adminApi.login(loginForm.email, loginForm.password);
			setStoredAdminToken(payload.accessToken);
			setToken(payload.accessToken);
			setCurrentUser(payload.user);
		} catch (error) {
			setAuthError((error as Error).message);
		} finally {
			setLoginBusy(false);
		}
	};

	const onLogout = async () => {
		if (token) {
			await adminApi.logout(token).catch(() => undefined);
		}
		setStoredAdminToken(null);
		setToken(null);
		setCurrentUser(null);
		setUsers([]);
		setReports([]);
		setMonitoring(null);
	};

	const onSaveUser = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedUser) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		try {
			await adminApi.updateUser(token, selectedUser.user.id, {
				nickname: String(formData.get("nickname") || "").trim() || null,
				email: String(formData.get("email") || "").trim() || null,
				picture: formData.get("picture")
					? Number(formData.get("picture"))
					: null,
				personalInfo: String(formData.get("personalInfo") || "").trim() || null,
				role: formData.get("role") as "player" | "admin",
			});
			showToast(t("toastUserSaved"), "success");
			await Promise.all([loadUsers(false), loadUserDetail(selectedUser.user.id)]);
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onSavePermissions = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedUser) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		const permissions = ALL_PERMISSIONS.filter((permission) =>
			formData.get(permission)
		);
		try {
			await adminApi.updatePermissions(token, selectedUser.user.id, permissions);
			showToast(t("toastPermsSaved"), "success");
			await loadUserDetail(selectedUser.user.id);
			if (currentUser?.id === selectedUser.user.id) {
				const me = await adminApi.me(token);
				setCurrentUser(me.user);
			}
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onLockUser = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedUser) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		const reason = String(formData.get("reason") || "").trim();
		if (!reason) {
			showToast(lang === "vi" ? "Vui lòng nhập lý do khóa" : "Please enter a reason", "error");
			return;
		}
		try {
			await adminApi.lockUser(token, selectedUser.user.id, {
				reason,
				mode: lockMode,
				durationDays: lockMode === "temporary" ? Number(formData.get("durationDays") || "7") : 0,
			});
			showToast(t("toastUserLocked"), "success");
			setSelectedUserId(null);
			setSelectedUser(null);
			await Promise.all([loadUsers(false), loadOverview()]);
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onUnlockUser = async (userId: string) => {
		if (!token) {
			return;
		}
		try {
			await adminApi.unlockUser(token, userId);
			showToast(t("toastUserUnlocked"), "success");
			setSelectedUserId(null);
			setSelectedUser(null);
			await Promise.all([loadUsers(false), loadOverview()]);
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onHandleReport = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedReport) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		try {
			await adminApi.handleReport(token, selectedReport.report.id, {
				action: String(formData.get("action") || ""),
				adminNote: String(formData.get("adminNote") || "").trim(),
				durationDays: Number(formData.get("durationDays") || "7"),
			});
			showToast(t("toastReportHandled"), "success");
			await Promise.all([loadReports(), loadReportDetail(selectedReport.report.id), loadOverview()]);
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onSaveBot = async (botId: string, field: keyof Pick<AdminBot, "ambition" | "composure" | "vision">, value: number) => {
		setBots((items) =>
			items.map((item) => (item.id === botId ? { ...item, [field]: value } : item))
		);
	};

	const onSubmitBot = async (bot: AdminBot) => {
		if (!token) {
			return;
		}
		try {
			await adminApi.updateBot(token, bot.id, {
				ambition: bot.ambition,
				composure: bot.composure,
				vision: bot.vision,
			});
			showToast(t("toastBotSaved"), "success");
			await loadBots();
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onSubmitEvent = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			return;
		}
		try {
			await adminApi.createEvent(token, {
				name: eventDraft.name,
				description: eventDraft.description,
				status: eventDraft.status,
				startsAt: eventDraft.startsAt || null,
				endsAt: eventDraft.endsAt || null,
			});
			showToast(t("toastEventCreated"), "success");
			setEventDraft({
				name: "",
				description: "",
				status: "draft",
				startsAt: "",
				endsAt: "",
			});
			await loadEvents();
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	const onUpdateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !editingEvent) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		try {
			await adminApi.updateEvent(token, editingEvent.id, {
				name: String(formData.get("name") || "").trim(),
				description: String(formData.get("description") || "").trim(),
				status: formData.get("status") as AdminEvent["status"],
				startsAt: String(formData.get("startsAt") || "").trim() || null,
				endsAt: String(formData.get("endsAt") || "").trim() || null,
			});
			showToast(t("toastEventUpdated"), "success");
			setEditingEvent(null);
			await loadEvents();
		} catch (error) {
			showToast((error as Error).message || t("toastError"), "error");
		}
	};

	if (booting) {
		return <div className={`${styles.boot} ${theme === "light" ? styles.lightTheme : ""}`}>{t("loadingAdmin")}</div>;
	}

	if (!currentUser || !token) {
		return (
			<div className={`${styles.authShell} ${theme === "light" ? styles.lightTheme : ""}`}>
				<div className={styles.authPanel}>
					<div className={styles.brandRow}>
						<div className={styles.brandMark}>
							<Shield size={22} />
						</div>
						<div>
							<div className={styles.brandTitle}>{t("appName")}</div>
							<div className={styles.brandMeta}>{t("appSubtitle")}</div>
						</div>
					</div>
					<h1 className={styles.authTitle}>{t("adminLogin")}</h1>
					<p className={styles.authDescription}>{t("loginDesc")}</p>
					<form className={styles.authForm} onSubmit={onLogin}>
						<label className={styles.field}>
							<span>{t("email")}</span>
							<input
								type="email"
								value={loginForm.email}
								onChange={(event) =>
									setLoginForm((state) => ({ ...state, email: event.target.value }))
								}
								required
							/>
						</label>
						<label className={styles.field}>
							<span>{t("password")}</span>
							<input
								type="password"
								value={loginForm.password}
								onChange={(event) =>
									setLoginForm((state) => ({
										...state,
										password: event.target.value,
									}))
								}
								required
							/>
						</label>
						{authError ? <div className={styles.errorBanner}>{authError}</div> : null}
						<button className={styles.primaryButton} type="submit" disabled={loginBusy}>
							{loginBusy ? t("authenticating") : t("login")}
						</button>
					</form>
					<button
						className={styles.ghostButton}
						onClick={() => (window.location.href = APP_GAME_URL)}
					>
						{t("backToGame")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={`${styles.shell} ${theme === "light" ? styles.lightTheme : ""} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
			<aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ""}`}>
				<div className={styles.sidebarHeader}>
					{sidebarCollapsed ? (
						<button
							type="button"
							className={styles.iconToggleBtn}
							style={{ border: "none", background: "transparent", margin: "0 auto" }}
							onClick={() => setSidebarCollapsed(false)}
							title={t("reload")}
						>
							<Menu size={20} />
						</button>
					) : (
						<>
							<div className={styles.brandMark}>
								<Shield size={18} />
							</div>
							<div>
								<div className={styles.brandTitle}>{t("appName")}</div>
								<div className={styles.brandMeta}>v{APP_VERSION}</div>
							</div>
							<button
								type="button"
								className={styles.iconToggleBtn}
								style={{ marginLeft: "auto", border: "none", background: "transparent", padding: 4 }}
								onClick={() => setSidebarCollapsed(true)}
							>
								<ChevronLeft size={16} />
							</button>
						</>
					)}
				</div>
				<nav className={styles.nav}>
					{visibleTabs.map((item) => (
						<button
							key={item.id}
							className={`${styles.navButton} ${tab === item.id ? styles.navButtonActive : ""}`}
							onClick={() => {
								setPageError(null);
								setTab(item.id);
							}}
							title={sidebarCollapsed ? t(item.id as keyof typeof TRANSLATIONS.vi) : undefined}
						>
							{item.icon}
							<span>{t(item.id as keyof typeof TRANSLATIONS.vi)}</span>
						</button>
					))}
				</nav>
				<div className={styles.sidebarFooter}>
					{!sidebarCollapsed && (
						<div className={styles.adminIdentity}>
							<div className={styles.identityLabel}>{t("currentAdmin")}</div>
							<div className={styles.identityValue}>
								{currentUser.nickname || currentUser.email || currentUser.id}
							</div>
						</div>
					)}
					<div className={styles.sidebarActions}>
						<button
							className={styles.ghostButton}
							onClick={() => setRefreshKey((value) => value + 1)}
							title={t("refresh")}
						>
							<RefreshCw size={16} />
							<span>{t("refresh")}</span>
						</button>
						<button
							className={styles.ghostButton}
							onClick={() => (window.location.href = APP_GAME_URL)}
							title={t("backToGameClient")}
						>
							<Globe size={16} />
							<span>{t("backToGameClient")}</span>
						</button>
						<button
							className={styles.dangerButton}
							onClick={onLogout}
							title={t("logout")}
						>
							<LogOut size={16} />
							<span>{t("logout")}</span>
						</button>
					</div>
				</div>
			</aside>

			<main className={styles.main}>
				<header className={styles.header}>
					<div>
						<div className={styles.headerEyebrow}>{t("adminServiceOwn")}</div>
						<h1>{t(visibleTabs.find((item) => item.id === tab)?.id as keyof typeof TRANSLATIONS.vi || "overview")}</h1>
					</div>
					<div className={styles.headerActions}>
						<button
							className={styles.iconToggleBtn}
							onClick={() => setLang(lang === "vi" ? "en" : "vi")}
							title={lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}
						>
							<Globe size={16} />
							<span style={{ fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
								{lang.toUpperCase()}
							</span>
						</button>
						<button
							className={styles.iconToggleBtn}
							onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
							title={theme === "dark" ? "Giao diện Sáng" : "Giao diện Tối"}
						>
							{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
						</button>
						<div className={styles.permissionPills}>
							{currentUser.permissions.map((permission) => (
								<span key={permission} className={styles.permissionPill} title={permission}>
									{getPermissionLabel(permission, lang)}
								</span>
							))}
						</div>
					</div>
				</header>

				{pageError ? (
					<div className={styles.errorBanner}>
						<AlertTriangle size={16} />
						<span>{pageError}</span>
					</div>
				) : null}

				{tab === "overview" && (
					<section className={styles.sectionGrid}>
						<div className={styles.statsGrid}>
							<StatCard label={t("userCount")} value={overview?.users ?? "-"} />
							<StatCard label={t("lockedUserCount")} value={overview?.lockedUsers ?? "-"} />
							<StatCard label={t("matchCount")} value={overview?.matches ?? "-"} />
							<StatCard label={t("openReportCount")} value={overview?.openReports ?? "-"} />
							<StatCard label={t("botCount")} value={overview?.bots ?? "-"} />
							<StatCard label={t("activeEventCount")} value={overview?.activeEvents ?? "-"} />
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("currentOps")}</h2>
								{overviewBusy ? <span className={styles.muted}>{t("loading")}</span> : null}
							</div>
							<div className={styles.keyValueGrid}>
								<div>
									<span>{t("uptime")}</span>
									<strong>{overview ? formatDuration(overview.server.uptimeSeconds) : "-"}</strong>
								</div>
								<div>
									<span>{t("rssMemory")}</span>
									<strong>{overview?.server.memoryMb ?? "-"} MB</strong>
								</div>
								<div>
									<span>{t("heapUsed")}</span>
									<strong>{overview?.server.heapUsedMb ?? "-"} MB</strong>
								</div>
								<div>
									<span>{t("nodeVersion")}</span>
									<strong>{overview?.server.nodeVersion ?? "-"}</strong>
								</div>
								<div>
									<span>{t("activePlayers")}</span>
									<strong>{overview?.server.activePlayers ?? "-"}</strong>
								</div>
								<div>
									<span>{t("playersInGame")}</span>
									<strong>{overview?.server.playersInGame ?? "-"}</strong>
								</div>
							</div>
						</div>
					</section>
				)}

				{tab === "users" && (
					<section className={styles.sectionStack}>
						<div className={styles.toolbar}>
							<input
								className={styles.searchInput}
								placeholder={t("searchUserPlaceholder")}
								value={userFilters.q}
								onChange={(event) =>
									setUserFilters((state) => ({
										...state,
										q: event.target.value,
									}))
								}
							/>
							<select
								value={userFilters.status}
								onChange={(event) =>
									setUserFilters((state) => ({
										...state,
										status: event.target.value,
									}))
								}
							>
								<option value="all">{t("allStatus")}</option>
								<option value="active">{t("active")}</option>
								<option value="locked">{t("locked")}</option>
							</select>
							<button className={styles.primaryButton} onClick={() => loadUsers(false)}>
								<RefreshCw size={16} />
								<span>{t("reload")}</span>
							</button>
							<button
								className={styles.ghostButton}
								onClick={() =>
									token
										? downloadWithToken("/users/export", token, "admin-users.csv").catch(
												(error) => setPageError((error as Error).message)
										  )
										: undefined
								}
							>
								<Download size={16} />
								<span>{t("exportCsv")}</span>
							</button>
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("registeredUsers")}</h2>
								<span className={styles.muted}>
									{usersBusy ? t("loading") : `${users.length} ${lang === "vi" ? "mục" : "items"}`}
								</span>
							</div>
							<div className={styles.table}>
								<div className={styles.tableHead}>
									<span>{t("account")}</span>
									<span>{t("role")}</span>
									<span>{t("status")}</span>
									<span>{t("stats")}</span>
									<span></span>
								</div>
								{users.map((user) => (
									<div key={user.id} className={styles.tableRow}>
										<div>
											<div className={styles.rowTitle}>{user.nickname || user.email || user.id}</div>
											<div className={styles.rowMeta}>{user.email || user.id}</div>
										</div>
										<div>{getRoleLabel(user.role, lang)}</div>
										<div>
											<span className={user.locked ? styles.statusDanger : styles.statusOk}>
												{getStatusLabel(user.locked ? "locked" : "active", lang)}
											</span>
										</div>
										<div className={styles.rowMeta}>
											{user.gamesPlayed} {lang === "vi" ? "trận" : "matches"} / {formatPercent(user.wins, user.gamesPlayed)}
										</div>
										<div className={styles.rowAction}>
											<button
												className={styles.inlineButton}
												onClick={() => setSelectedUserId(user.id)}
											>
												{t("viewDetail")}
												<ChevronRight size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
							{userFilters.nextCursor ? (
								<div className={styles.loadMoreRow}>
									<button className={styles.ghostButton} onClick={() => loadUsers(true, userFilters.nextCursor)}>
										{t("loadMore")}
									</button>
								</div>
							) : null}
						</div>
					</section>
				)}

				{tab === "reports" && (
					<section className={styles.sectionStack}>
						<div className={styles.toolbar}>
							<select
								value={reportFilters.status}
								onChange={(event) =>
									setReportFilters((state) => ({
										...state,
										status: event.target.value,
									}))
								}
							>
								<option value="all">{t("allStatuses")}</option>
								<option value="pending">{getStatusLabel("pending", lang)}</option>
								<option value="reviewed">{getStatusLabel("reviewed", lang)}</option>
								<option value="actioned">{getStatusLabel("actioned", lang)}</option>
								<option value="dismissed">{getStatusLabel("dismissed", lang)}</option>
							</select>
							<select
								value={reportFilters.reason}
								onChange={(event) =>
									setReportFilters((state) => ({
										...state,
										reason: event.target.value,
									}))
								}
							>
								<option value="all">{t("allReasons")}</option>
								<option value="abuse">{getReasonLabelStr("abuse", lang)}</option>
								<option value="spam">{getReasonLabelStr("spam", lang)}</option>
								<option value="offensive_name">{getReasonLabelStr("offensive_name", lang)}</option>
								<option value="cheating">{getReasonLabelStr("cheating", lang)}</option>
								<option value="other">{getReasonLabelStr("other", lang)}</option>
							</select>
							<select
								value={String(reportFilters.windowDays)}
								onChange={(event) =>
									setReportFilters((state) => ({
										...state,
										windowDays: Number(event.target.value),
									}))
								}
							>
								<option value="1">{t("today")}</option>
								<option value="7">{t("sevenDays")}</option>
								<option value="30">{t("thirtyDays")}</option>
							</select>
							<select
								value={reportFilters.sortBy}
								onChange={(event) =>
									setReportFilters((state) => ({
										...state,
										sortBy: event.target.value,
									}))
								}
							>
								<option value="newest">{t("newest")}</option>
								<option value="oldest">{t("oldest")}</option>
								<option value="priority">{t("highPriority")}</option>
							</select>
							<button className={styles.primaryButton} onClick={() => loadReports()}>
								<RefreshCw size={16} />
								<span>{t("filter")}</span>
							</button>
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("reportsList")}</h2>
								<span className={styles.muted}>
									{reportsBusy ? t("loading") : `${reports.length} ${lang === "vi" ? "báo cáo" : "reports"}`}
								</span>
							</div>
							<div className={styles.table}>
								<div className={styles.tableHead}>
									<span>{t("target")}</span>
									<span>{t("reason")}</span>
									<span>{t("priority")}</span>
									<span>{t("status")}</span>
									<span></span>
								</div>
								{reports.map((report) => (
									<div key={report.id} className={styles.tableRow}>
										<div>
											<div className={styles.rowTitle}>{report.target.nickname}</div>
											<div className={styles.rowMeta}>
												{t("reporter")}: {report.reporter.nickname}
											</div>
										</div>
										<div>{getReasonLabelStr(report.reason, lang)}</div>
										<div>{report.priority}</div>
										<div>
											<span className={styles.statusInfo}>{getStatusLabel(report.status, lang)}</span>
										</div>
										<div className={styles.rowAction}>
											<button
												className={styles.inlineButton}
												onClick={() => setSelectedReportId(report.id)}
											>
												{t("handle")}
												<ChevronRight size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}

				{tab === "monitoring" && (
					<section className={styles.sectionStack}>
						<div className={styles.toolbar}>
							<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
								<select value={monitoringRange} onChange={(event) => setMonitoringRange(event.target.value)}>
									<option value="5m">{lang === "vi" ? "5 phút" : "5 min"}</option>
									<option value="1h">{lang === "vi" ? "1 giờ" : "1 hour"}</option>
									<option value="24h">{lang === "vi" ? "24 giờ" : "24 hours"}</option>
									<option value="7d">{lang === "vi" ? "7 ngày" : "7 days"}</option>
								</select>
								<select value={logLevel} onChange={(event) => setLogLevel(event.target.value)}>
									<option value="all">{t("allLogs")}</option>
									<option value="info">{t("info")}</option>
									<option value="warn">{t("warn")}</option>
									<option value="error">{t("error")}</option>
								</select>
							</div>
							<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
								<button
									className={styles.ghostButton}
									onClick={() =>
										token
											? downloadWithToken(
													`/monitoring/export?range=${encodeURIComponent(monitoringRange)}&format=csv`,
													token,
													"admin-monitoring.csv"
											  ).catch((error) => setPageError((error as Error).message))
											: undefined
									}
								>
									<Download size={16} />
									<span>{t("exportCsv")}</span>
								</button>
								<button
									className={styles.ghostButton}
									onClick={() =>
										token
											? downloadWithToken(
													`/monitoring/export?range=${encodeURIComponent(monitoringRange)}&format=json`,
													token,
													"admin-monitoring.json"
											  ).catch((error) => setPageError((error as Error).message))
											: undefined
									}
								>
									<Download size={16} />
									<span>{t("exportJson")}</span>
								</button>
								<button className={styles.primaryButton} onClick={() => loadMonitoring()}>
									<RefreshCw size={16} />
									<span>{t("refresh")}</span>
								</button>
							</div>
						</div>
						<div className={styles.statsGrid}>
							<StatCard label={t("apiRequests")} value={monitoring?.summary?.apiRequests ?? "-"} />
							<StatCard label="5xx errors" value={monitoring?.summary?.api5xx ?? "-"} />
							<StatCard label={t("socketConnections")} value={monitoring?.summary?.socketConnections ?? "-"} />
							<StatCard label={t("dbLatency")} value={monitoring?.summary?.dbLatencyMs ?? "-"} description="ms" />
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("serviceHealth")}</h2>
								<span className={styles.muted}>{monitoringBusy ? t("loading") : formatDateTime(monitoring?.checkedAt, lang)}</span>
							</div>
							<div className={styles.serviceGrid}>
								{Object.entries(monitoring?.services || {}).map(([key, value]) => (
									<div key={key} className={styles.serviceCard}>
										<span>{key}</span>
										<strong className={value === "online" ? styles.statusOk : styles.statusDanger}>
											{value}
										</strong>
									</div>
								))}
							</div>
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("activityChart")}</h2>
							</div>
							<div className={styles.chartWrap}>
								<ResponsiveContainer width="100%" height={280}>
									<LineChart data={monitoring?.history || []}>
										<CartesianGrid strokeDasharray="3 3" stroke="#2b3448" />
										<XAxis
											dataKey="capturedAt"
											tickFormatter={(value: string) =>
												new Date(value).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})
											}
											stroke="#8b9bb4"
										/>
										<YAxis stroke="#8b9bb4" />
										<Tooltip />
										<Legend />
										<Line type="monotone" dataKey="activePlayers" stroke="#34d399" dot={false} />
										<Line type="monotone" dataKey="apiRequests" stroke="#60a5fa" dot={false} />
										<Line type="monotone" dataKey="api5xx" stroke="#f87171" dot={false} />
									</LineChart>
								</ResponsiveContainer>
							</div>
						</div>
						<div className={styles.dualColumn}>
							<div className={styles.panel}>
								<div className={styles.panelHeader}>
									<h2>{t("alerts")}</h2>
								</div>
								<div className={styles.stackList}>
									{monitoring?.alerts.length ? (
										monitoring.alerts.map((alert, index) => (
											<div key={`${alert.metric}-${index}`} className={styles.alertItem}>
												<AlertTriangle size={16} />
												<div>
													<div className={styles.rowTitle}>{alert.metric}</div>
													<div className={styles.rowMeta}>{alert.message}</div>
												</div>
											</div>
										))
									) : (
										<div className={styles.emptyState}>{t("noAlerts")}</div>
									)}
								</div>
							</div>
							<div className={styles.panel}>
								<div className={styles.panelHeader}>
									<h2>{t("logs")}</h2>
								</div>
								<div className={styles.logList}>
									{monitoring?.logs.length ? (
										monitoring.logs.map((entry, index) => {
											let levelColor = "var(--text-muted)";
											if (entry.level.toLowerCase() === "error") levelColor = "var(--status-danger-text)";
											else if (entry.level.toLowerCase() === "warn") levelColor = "#f59e0b";
											else if (entry.level.toLowerCase() === "info") levelColor = "var(--status-ok-text)";

											return (
												<div key={`${entry.timestamp}-${index}`} className={styles.logRow}>
													<div className={styles.rowMeta}>{formatDateTime(entry.timestamp, lang)}</div>
													<div className={styles.rowTitle} style={{ color: levelColor }}>{entry.level.toUpperCase()}</div>
													<div style={{ color: entry.level.toLowerCase() === "error" ? "var(--status-danger-text)" : "var(--text-primary)" }}>{entry.message}</div>
												</div>
											);
										})
									) : (
										<div className={styles.emptyState}>{t("noLogs")}</div>
									)}
								</div>
							</div>
						</div>
					</section>
				)}

				{tab === "bots" && (
					<section className={styles.sectionStack}>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("botConfig")}</h2>
								<span className={styles.muted}>{botsBusy ? t("loading") : `${bots.length} bot`}</span>
							</div>
							<div className={styles.cardGrid}>
								{bots.map((bot) => (
									<div key={bot.id} className={styles.configCard}>
										<div className={styles.configHeader} style={{ marginBottom: 16 }}>
											<div>
												<div className={styles.rowTitle} style={{ fontSize: 17 }}>{bot.nickname}</div>
												<div className={styles.rowMeta}>
													{bot.games_played} {lang === "vi" ? "trận" : "matches"} / win rate {formatPercent(bot.wins, bot.games_played)}
												</div>
											</div>
											<button
												className={styles.primaryButton}
												onClick={() => {
													setSelectedBotId(bot.id);
													setSelectedBotDraft({ ...bot });
												}}
											>
												{t("configureBot")}
											</button>
										</div>
										<div className={styles.botMetricsPreview}>
											<div className={styles.previewMetricItem}>
												<span className={styles.metricName}>{lang === "vi" ? "Kinh tế" : "Economy"}</span>
												<strong className={styles.metricValue}>{bot.ambition}</strong>
											</div>
											<div className={styles.previewMetricItem}>
												<span className={styles.metricName}>{lang === "vi" ? "Áp lực" : "Pressure"}</span>
												<strong className={styles.metricValue}>{bot.composure}</strong>
											</div>
											<div className={styles.previewMetricItem}>
												<span className={styles.metricName}>{lang === "vi" ? "Tầm nhìn" : "Vision"}</span>
												<strong className={styles.metricValue}>{bot.vision}</strong>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}

				{tab === "events" && (
					<section className={styles.sectionStack}>
						<div className={styles.toolbar}>
							<div />
							<button
								className={styles.primaryButton}
								onClick={() => setIsCreateEventOpen(true)}
							>
								<Plus size={16} />
								<span>{t("openCreateEventModal")}</span>
							</button>
						</div>

						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>{t("createdEvents")}</h2>
								<span className={styles.muted}>{eventsBusy ? t("loading") : `${events.length} ${lang === "vi" ? "sự kiện" : "events"}`}</span>
							</div>
							<div className={styles.cardGrid}>
								{events.map((item) => (
									<div key={item.id} className={styles.configCard}>
										<div className={styles.rowTitle}>{item.name}</div>
										<div className={styles.rowMeta}>{getStatusLabel(item.status, lang)}</div>
										<div className={styles.helpText}>{item.description || t("noDescription")}</div>
										<div className={styles.keyValueGrid}>
											<div>
												<span>{t("startsAt")}</span>
												<strong>{formatDateTime(item.startsAt, lang)}</strong>
											</div>
											<div>
												<span>{t("endsAt")}</span>
												<strong>{formatDateTime(item.endsAt, lang)}</strong>
											</div>
										</div>
										<div className={styles.formActions}>
											<button
												className={styles.ghostButton}
												onClick={() => setEditingEvent(item)}
											>
												{t("edit")}
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}
			</main>

			{selectedUserId ? (
				<Modal
					title={t("viewDetail")}
					onClose={() => {
						setSelectedUserId(null);
						setSelectedUser(null);
					}}
					wide
					headerExtras={
						!selectedUserBusy || selectedUser ? (
							<div className={styles.modalTabs} style={{ marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>
								<button
									className={`${styles.modalTabButton} ${activeUserTab === "basic" ? styles.modalTabButtonActive : ""}`}
									onClick={() => setActiveUserTab("basic")}
								>
									{t("basicInfo")}
								</button>
								<button
									className={`${styles.modalTabButton} ${activeUserTab === "activity" ? styles.modalTabButtonActive : ""}`}
									onClick={() => setActiveUserTab("activity")}
								>
									{t("activityHistory")}
								</button>
								<button
									className={`${styles.modalTabButton} ${activeUserTab === "permissions" ? styles.modalTabButtonActive : ""}`}
									onClick={() => setActiveUserTab("permissions")}
								>
									{t("locksAndPerms")}
								</button>
							</div>
						) : null
					}
				>
					{selectedUserBusy && !selectedUser ? (
						<div className={styles.emptyState}>{t("loadingUserDetail")}</div>
					) : selectedUser ? (
						<>
							{activeUserTab === "basic" && (
								<div className={styles.modalLayout}>
									<form className={styles.modalPanel} onSubmit={onSaveUser}>
										<div className={styles.panelHeader}>
											<h2>{t("basicInfo")}</h2>
											{selectedUser.user.locked ? (
												<span className={styles.statusDanger}>{t("locked")}</span>
											) : (
												<span className={styles.statusOk}>{t("active")}</span>
											)}
										</div>
										<div className={styles.formGrid}>
											<label className={styles.field}>
												<span>Nickname</span>
												<input name="nickname" defaultValue={selectedUser.user.nickname || ""} />
											</label>
											<label className={styles.field}>
												<span>Email</span>
												<input name="email" defaultValue={selectedUser.user.email || ""} />
											</label>
											<label className={styles.field}>
												<span>Avatar ID</span>
												<input
													type="number"
													name="picture"
													defaultValue={selectedUser.user.profilePicture ?? ""}
												/>
											</label>
											<label className={styles.field}>
												<span>{t("role")}</span>
												<select name="role" defaultValue={selectedUser.user.role}>
													<option value="player">player</option>
													<option value="admin">admin</option>
												</select>
											</label>
											<label className={`${styles.field} ${styles.fieldWide}`}>
												<span>{lang === "vi" ? "Thông tin cá nhân" : "Personal Info"}</span>
												<textarea
													name="personalInfo"
													defaultValue={selectedUser.user.personalInfo || ""}
													rows={4}
												/>
											</label>
										</div>
										<div className={styles.formActions}>
											<button className={styles.primaryButton} type="submit">
												{t("saveChanges")}
											</button>
											{selectedUser.user.locked ? (
												<button
													type="button"
													className={styles.ghostButton}
													onClick={() => onUnlockUser(selectedUser.user.id)}
												>
													{t("unlock")}
												</button>
											) : null}
										</div>
									</form>

									<div className={styles.modalPanel}>
										<div className={styles.panelHeader}>
											<h2>{t("stats")}</h2>
										</div>
										<div className={styles.keyValueGrid}>
											<div>
												<span>{t("gamesPlayed")}</span>
												<strong>{selectedUser.user.gamesPlayed}</strong>
											</div>
											<div>
												<span>{t("wins")}</span>
												<strong>{selectedUser.user.wins}</strong>
											</div>
											<div>
												<span>{t("winRate")}</span>
												<strong>
													{formatPercent(selectedUser.user.wins, selectedUser.user.gamesPlayed)}
												</strong>
											</div>
											<div>
												<span>{t("warnings")}</span>
												<strong>{selectedUser.user.warningCount}</strong>
											</div>
											<div>
												<span>{t("lastLogin")}</span>
												<strong>{formatDateTime(selectedUser.user.lastLoginAt, lang)}</strong>
											</div>
											<div>
												<span>{t("lastLogout")}</span>
												<strong>{formatDateTime(selectedUser.user.lastLogoutAt, lang)}</strong>
											</div>
										</div>
									</div>
								</div>
							)}

							{activeUserTab === "activity" && (
								<div className={styles.modalLayout}>
									<div className={styles.modalPanel}>
										<div className={styles.panelHeader}>
											<h2>{t("recentActivity")}</h2>
											<select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
												<option value="">{lang === "vi" ? "Tất cả" : "All"}</option>
												<option value="admin.auth">admin.auth</option>
												<option value="admin.user">admin.user</option>
												<option value="admin.report">admin.report</option>
												<option value="system.user">system.user</option>
											</select>
										</div>
										<div className={styles.stackList}>
											{paginatedActivity.length ? (
												paginatedActivity.map((entry) => (
													<div key={entry.id} className={styles.timelineItem}>
														<div className={styles.rowTitle}>{getActivityActionLabel(entry.action, lang)}</div>
														<div className={styles.rowMeta}>{formatDateTime(entry.createdAt, lang)}</div>
														{entry.reason && (
															<div style={{ fontSize: 13, marginTop: 4 }}>
																<strong>{lang === "vi" ? "Lý do: " : "Reason: "}</strong>{entry.reason}
															</div>
														)}
														{formatActivityMeta(entry, lang) && (
															<div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
																{formatActivityMeta(entry, lang)}
															</div>
														)}
													</div>
												))
											) : (
												<div className={styles.emptyState}>{t("noLogs")}</div>
											)}

											{selectedUser.activity.length > ITEMS_PER_PAGE && (
												<div className={styles.paginationRow}>
													<button
														type="button"
														className={styles.ghostButton}
														style={{ padding: "4px 8px" }}
														disabled={activityPage === 1}
														onClick={() => setActivityPage((prev) => prev - 1)}
													>
														<ChevronLeft size={16} />
														<span>{lang === "vi" ? "Trước" : "Prev"}</span>
													</button>
													<span className={styles.pageIndicator}>
														{activityPage} / {Math.ceil(selectedUser.activity.length / ITEMS_PER_PAGE)}
													</span>
													<button
														type="button"
														className={styles.ghostButton}
														style={{ padding: "4px 8px" }}
														disabled={activityPage >= Math.ceil(selectedUser.activity.length / ITEMS_PER_PAGE)}
														onClick={() => setActivityPage((prev) => prev + 1)}
													>
														<span>{lang === "vi" ? "Sau" : "Next"}</span>
														<ChevronRight size={16} />
													</button>
												</div>
											)}
										</div>
									</div>

									<div className={styles.modalPanel}>
										<div className={styles.panelHeader}>
											<h2>{t("relatedReports")}</h2>
										</div>
										<div className={styles.stackList}>
											{selectedUser.relatedReports.length ? (
												selectedUser.relatedReports.map((entry) => (
													<div key={entry.id} className={styles.timelineItem}>
														<div className={styles.rowTitle}>{getReasonLabelStr(entry.reason, lang)}</div>
														<div className={styles.rowMeta}>
															{getStatusLabel(entry.status, lang)} / {formatDateTime(entry.createdAt, lang)}
														</div>
													</div>
												))
											) : (
												<div className={styles.emptyState}>{lang === "vi" ? "Không có báo cáo nào." : "No reports."}</div>
											)}
										</div>
									</div>
								</div>
							)}

							{activeUserTab === "permissions" && (
								<div className={styles.modalLayout}>
									<form className={styles.modalPanel} onSubmit={onLockUser}>
										<div className={styles.panelHeader}>
											<h2>{t("lockAccount")}</h2>
											{selectedUser.user.locked && (
												<span className={styles.statusDanger}>{lang === "vi" ? "Đã khóa" : "Locked"}</span>
											)}
										</div>
										<fieldset disabled={selectedUser.user.locked} style={{ border: "none", padding: 0, margin: 0, opacity: selectedUser.user.locked ? 0.6 : 1 }}>
											<div className={styles.formGrid}>
												<label className={styles.field}>
													<span>{t("mode")}</span>
													<select
														name="mode"
														value={lockMode}
														onChange={(event) => setLockMode(event.target.value as "temporary" | "permanent")}
													>
														<option value="temporary">{t("temporary")}</option>
														<option value="permanent">{t("permanent")}</option>
													</select>
												</label>
												{lockMode === "temporary" && (
													<label className={styles.field}>
														<span>{t("durationDays")}</span>
														<input type="number" name="durationDays" min={1} max={365} defaultValue={7} />
													</label>
												)}
												<label className={`${styles.field} ${styles.fieldWide}`}>
													<span>{t("reasonLabel")}</span>
													<textarea name="reason" rows={3} placeholder={lang === "vi" ? "Nhập lý do..." : "Enter reason..."} />
												</label>
											</div>
											<div className={styles.formActions}>
												<button className={styles.dangerButton} type="submit">
													<Lock size={16} />
													<span>{t("lockAccount")}</span>
												</button>
											</div>
										</fieldset>
									</form>

									{selectedUser.user.role === "admin" && currentUser.canGrantAdminPermissions ? (
										<form className={styles.modalPanel} onSubmit={onSavePermissions}>
											<div className={styles.panelHeader}>
												<h2>{t("permissionsAdmin")}</h2>
											</div>
											<div className={styles.checkboxGrid}>
												{ALL_PERMISSIONS.map((permission) => (
													<label key={permission} className={styles.checkboxLabel} title={permission}>
														<input
															type="checkbox"
															name={permission}
															defaultChecked={selectedUser.user.grantedPermissions.includes(permission)}
														/>
														<span>{getPermissionLabel(permission, lang)}</span>
													</label>
												))}
											</div>
											<div className={styles.formActions}>
												<button className={styles.primaryButton} type="submit">
													{t("updatePermissions")}
												</button>
											</div>
										</form>
									) : (
										<div className={styles.modalPanel} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
											<span className={styles.muted}>
												{lang === "vi" ? "Chỉ admin mới có phân quyền hệ thống." : "Only admins have system permissions."}
											</span>
										</div>
									)}
								</div>
							)}
						</>
					) : null}
				</Modal>
			) : null}

			{selectedReportId ? (
				<Modal
					title={t("viewReport")}
					onClose={() => {
						setSelectedReportId(null);
						setSelectedReport(null);
					}}
					wide
				>
					{selectedReportBusy && !selectedReport ? (
						<div className={styles.emptyState}>{t("loadingReportDetail")}</div>
					) : selectedReport ? (
						<div className={styles.modalLayout}>
							<div className={styles.sectionStack}>
								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>{t("reportContent")}</h2>
										<span className={styles.statusInfo}>{getStatusLabel(selectedReport.report.status, lang)}</span>
									</div>
									<div className={styles.keyValueGrid}>
										<div>
											<span>{t("reason")}</span>
											<strong>{getReasonLabelStr(selectedReport.report.reason, lang)}</strong>
										</div>
										<div>
											<span>{t("matchId")}</span>
											<strong>{selectedReport.report.matchId || "-"}</strong>
										</div>
										<div>
											<span>{t("startsAt")}</span>
											<strong>{formatDateTime(selectedReport.report.createdAt, lang)}</strong>
										</div>
										<div>
											<span>{t("actionType")}</span>
											<strong>{getActionTypeLabel(selectedReport.report.actionType, lang)}</strong>
										</div>
									</div>
									<div className={styles.noteBox}>{selectedReport.report.description || t("noDescription")}</div>
								</div>

								<form className={styles.panel} onSubmit={onHandleReport}>
									<div className={styles.panelHeader}>
										<h2>{t("handle")}</h2>
									</div>
									<div className={styles.formGrid}>
										<label className={styles.field}>
											<span>{t("actionType")}</span>
											<select name="action" defaultValue="review">
												<option value="review">{getActionTypeLabel("review", lang)}</option>
												<option value="dismiss">{getActionTypeLabel("dismiss", lang)}</option>
												<option value="warning">{getActionTypeLabel("warning", lang)}</option>
												<option value="temporary_ban">{getActionTypeLabel("temporary_ban", lang)}</option>
												<option value="permanent_ban">{getActionTypeLabel("permanent_ban", lang)}</option>
											</select>
										</label>
										<label className={styles.field}>
											<span>{t("durationDays")}</span>
											<input type="number" name="durationDays" min={1} max={365} defaultValue={7} />
										</label>
										<label className={`${styles.field} ${styles.fieldWide}`}>
											<span>{t("reasonDecision")}</span>
											<textarea name="adminNote" required rows={4} defaultValue={selectedReport.report.adminNote || ""} />
										</label>
									</div>
									<div className={styles.formActions}>
										<button className={styles.primaryButton} type="submit">
											{t("confirmHandle")}
										</button>
									</div>
								</form>
							</div>

							<div className={styles.sectionStack}>
								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>{t("reporter")} / {t("target")}</h2>
									</div>
									<div className={styles.stackList}>
										<div className={styles.timelineItem}>
											<div className={styles.rowTitle}>
												{t("reporter")}: {selectedReport.report.reporter?.nickname || (lang === "vi" ? "Đã xóa" : "Deleted")}
											</div>
											<div className={styles.rowMeta}>
												{selectedReport.report.reporter?.email || "-"}
											</div>
										</div>
										<div className={styles.timelineItem}>
											<div className={styles.rowTitle}>
												{t("target")}: {selectedReport.report.target?.nickname || (lang === "vi" ? "Đã xóa" : "Deleted")}
											</div>
											<div className={styles.rowMeta}>
												{t("warningCount")}: {selectedReport.report.target?.warningCount || 0}
											</div>
										</div>
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>{t("patternReasons")}</h2>
									</div>
									<div className={styles.stackList}>
										{Object.entries(selectedReport.targetReasonPatterns).map(([reason, count]) => (
											<div key={reason} className={styles.timelineItem}>
												<div className={styles.rowTitle}>{getReasonLabelStr(reason, lang)}</div>
												<div className={styles.rowMeta}>{count} {lang === "vi" ? "lần" : "times"}</div>
											</div>
										))}
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>{t("matchParticipants")}</h2>
									</div>
									<div className={styles.stackList}>
										{selectedReport.matchParticipants.map((participant, index) => (
											<div key={`${participant.displayName}-${index}`} className={styles.timelineItem}>
												<div className={styles.rowTitle}>
													#{participant.placement} {participant.displayName}
												</div>
												<div className={styles.rowMeta}>
													{participant.isBot ? "Bot" : participant.userId || "Player"}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					) : null}
				</Modal>
			) : null}

			{editingEvent ? (
				<Modal
					title={t("editEventTitle")}
					onClose={() => setEditingEvent(null)}
					footer={
						<div className={styles.modalActions} style={{ marginTop: 0 }}>
							<button type="button" className={styles.ghostButton} onClick={() => setEditingEvent(null)}>
								{t("cancel")}
							</button>
							<button className={styles.primaryButton} type="submit" form="editEventForm">
								{t("saveChanges")}
							</button>
						</div>
					}
				>
					<form id="editEventForm" className={styles.sectionStack} onSubmit={onUpdateEvent}>
						<label className={styles.field}>
							<span>{t("eventName")}</span>
							<input name="name" defaultValue={editingEvent.name} required />
						</label>
						<label className={styles.field}>
							<span>{t("status")}</span>
							<select name="status" defaultValue={editingEvent.status}>
								<option value="draft">draft</option>
								<option value="scheduled">scheduled</option>
								<option value="active">active</option>
								<option value="ended">ended</option>
							</select>
						</label>
						<label className={styles.field}>
							<span>{t("startsAt")}</span>
							<input
								type="datetime-local"
								name="startsAt"
								defaultValue={editingEvent.startsAt?.slice(0, 16) || ""}
							/>
						</label>
						<label className={styles.field}>
							<span>{t("endsAt")}</span>
							<input
								type="datetime-local"
								name="endsAt"
								defaultValue={editingEvent.endsAt?.slice(0, 16) || ""}
							/>
						</label>
						<label className={styles.field}>
							<span>{t("description")}</span>
							<textarea
								name="description"
								rows={4}
								defaultValue={editingEvent.description}
							/>
						</label>
					</form>
				</Modal>
			) : null}

			{isCreateEventOpen ? (
				<Modal
					title={t("createEventTitle")}
					onClose={() => setIsCreateEventOpen(false)}
					footer={
						<div className={styles.modalActions} style={{ marginTop: 0 }}>
							<button type="button" className={styles.ghostButton} onClick={() => setIsCreateEventOpen(false)}>
								{t("cancel")}
							</button>
							<button className={styles.primaryButton} type="submit" form="createEventForm">
								{t("createEvent")}
							</button>
						</div>
					}
				>
					<form id="createEventForm" className={styles.sectionStack} onSubmit={(event) => {
						onSubmitEvent(event).then(() => {
							setIsCreateEventOpen(false);
						}).catch(() => undefined);
					}}>
						<label className={styles.field}>
							<span>{t("eventName")}</span>
							<input
								value={eventDraft.name}
								onChange={(event) =>
									setEventDraft((state) => ({ ...state, name: event.target.value }))
								}
								required
							/>
						</label>
						<label className={styles.field}>
							<span>{t("status")}</span>
							<select
								value={eventDraft.status}
								onChange={(event) =>
									setEventDraft((state) => ({
										...state,
										status: event.target.value as AdminEvent["status"],
									}))
								}
							>
								<option value="draft">draft</option>
								<option value="scheduled">scheduled</option>
								<option value="active">active</option>
								<option value="ended">ended</option>
							</select>
						</label>
						<label className={styles.field}>
							<span>{t("startsAt")}</span>
							<input
								type="datetime-local"
								value={eventDraft.startsAt}
								onChange={(event) =>
									setEventDraft((state) => ({ ...state, startsAt: event.target.value }))
								}
							/>
						</label>
						<label className={styles.field}>
							<span>{t("endsAt")}</span>
							<input
								type="datetime-local"
								value={eventDraft.endsAt}
								onChange={(event) =>
									setEventDraft((state) => ({ ...state, endsAt: event.target.value }))
								}
							/>
						</label>
						<label className={styles.field}>
							<span>{t("description")}</span>
							<textarea
								value={eventDraft.description}
								onChange={(event) =>
									setEventDraft((state) => ({
										...state,
										description: event.target.value,
									}))
								}
								rows={4}
							/>
						</label>
					</form>
				</Modal>
			) : null}

			{selectedBotId && selectedBotDraft ? (
				<Modal
					title={t("botConfigDetail")}
					onClose={() => {
						setSelectedBotId(null);
						setSelectedBotDraft(null);
					}}
					footer={
						<div className={styles.modalActions} style={{ marginTop: 0 }}>
							<button 
								type="button" 
								className={styles.ghostButton} 
								onClick={() => {
									setSelectedBotId(null);
									setSelectedBotDraft(null);
								}}
							>
								{t("cancel")}
							</button>
							<button 
								type="button" 
								className={styles.primaryButton}
								disabled={
									!(
										selectedBotDraft.ambition !== (botCheckpoints[selectedBotId]?.ambition ?? 100) ||
										selectedBotDraft.composure !== (botCheckpoints[selectedBotId]?.composure ?? 100) ||
										selectedBotDraft.vision !== (botCheckpoints[selectedBotId]?.vision ?? 100)
									)
								}
								onClick={async () => {
									await onSubmitBot(selectedBotDraft);
									setSelectedBotId(null);
									setSelectedBotDraft(null);
								}}
							>
								{t("save")}
							</button>
						</div>
					}
				>
					<div className={styles.sectionStack}>
						<div className={styles.panelHeader} style={{ marginBottom: 12 }}>
							<h2>{selectedBotDraft.nickname}</h2>
							<span className={styles.statusInfo}>
								{selectedBotDraft.games_played} {lang === "vi" ? "trận đã đấu" : "matches"}
							</span>
						</div>

						{(["ambition", "composure", "vision"] as const).map((field) => {
							const originalVal = botCheckpoints[selectedBotId]?.[field] ?? 100;
							const currentVal = selectedBotDraft[field];
							const isModified = originalVal !== currentVal;

							const fieldLabel = lang === "vi"
								? field === "vision"
									? "Tầm nhìn chiến thuật (Vision)"
									: field === "ambition"
									? "Quyết đoán kinh tế (Ambition)"
									: "Kiểm soát áp lực (Composure)"
								: BOT_LABELS[field];

							const fieldDesc = lang === "vi"
								? field === "vision"
									? "Xác định khả năng dự đoán đội hình đối phương và tối ưu hóa vị trí đặt quân cờ trên bàn."
									: field === "ambition"
									? "Quyết định mức độ chi tiêu vàng để mua quân hoặc lên cấp. Chỉ số cao khiến bot chơi mạo hiểm hơn."
									: "Khả năng giữ bình tĩnh và đưa ra quyết định chuẩn xác dưới áp lực khi máu thấp hoặc đang thua."
								: field === "vision"
									? "Measures capability to predict enemy formations and optimize piece placement on the board."
									: field === "ambition"
									? "Determines how aggressively the bot spends gold on buying pieces or leveling up. High values make the bot take more economic risks."
									: "Ability to stay calm under pressure when HP is low or losing. High values help the bot make better decisions when disadvantaged.";

							return (
								<div key={field} style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, display: "grid", gap: 10 }}>
									<div className={styles.sliderHeader}>
										<span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{fieldLabel}</span>
										<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
											{isModified ? (
												<span style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
													{lang === "vi" ? `Gốc: ${originalVal}` : `Orig: ${originalVal}`}
												</span>
											) : (
												<span style={{ fontSize: 11, color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
													{lang === "vi" ? "Khớp gốc" : "Matched"}
												</span>
											)}
											<strong style={{ color: "var(--primary-color)", fontSize: 16 }}>{currentVal}</strong>
										</div>
									</div>
									<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
										<input
											type="range"
											min={1}
											max={200}
											value={currentVal}
											onChange={(event) => {
												const val = Number(event.target.value);
												setSelectedBotDraft(state => state ? { ...state, [field]: val } : null);
											}}
											style={{ flexGrow: 1, accentColor: "var(--primary-color)", cursor: "pointer" }}
										/>
										{isModified && (
											<button
												type="button"
												className={styles.iconToggleBtn}
												style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }}
												onClick={() => {
													setSelectedBotDraft(state => state ? { ...state, [field]: originalVal } : null);
												}}
												title={t("restoreToCheckpoint")}
											>
												<RotateCcw size={12} />
											</button>
										)}
									</div>
									<p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{fieldDesc}</p>
								</div>
							);
						})}

					</div>
				</Modal>
			) : null}
			<ToastContainer toasts={toasts} />
		</div>
	);
};
