import React from "react";

import {
	Activity,
	AlertTriangle,
	Bot,
	CalendarDays,
	ChevronRight,
	Clock3,
	Download,
	Flag,
	Lock,
	LogOut,
	RefreshCw,
	Server,
	Shield,
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

const ALL_PERMISSIONS: AdminPermission[] = [
	"user_management",
	"report_management",
	"server_monitoring",
	"bot_management",
	"event_management",
	"admin_permissions",
];

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

const BOT_LABELS = {
	ambition: "Economy Aggression",
	composure: "Pressure Control",
	vision: "Tactical Vision",
} as const;

const formatDateTime = (value: string | null | undefined) =>
	value ? new Date(value).toLocaleString() : "-";

const formatDuration = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
};

const formatPercent = (wins: number, gamesPlayed: number) => {
	if (!gamesPlayed) {
		return "0%";
	}
	return `${Math.round((wins / gamesPlayed) * 100)}%`;
};

const hasPermission = (
	user: AdminSessionUser | null,
	permission?: AdminPermission
) => !permission || Boolean(user?.permissions.includes(permission));

const Modal = ({
	title,
	children,
	onClose,
	wide = false,
}: {
	title: string;
	children: React.ReactNode;
	onClose: () => void;
	wide?: boolean;
}) => (
	<div className={styles.modalBackdrop} onClick={onClose}>
		<div
			className={`${styles.modal} ${wide ? styles.modalWide : ""}`}
			onClick={(event) => event.stopPropagation()}
		>
			<div className={styles.modalHeader}>
				<div>
					<h3>{title}</h3>
				</div>
				<button className={styles.ghostButton} onClick={onClose}>
					Đóng
				</button>
			</div>
			<div className={styles.modalBody}>{children}</div>
		</div>
	</div>
);

const StatCard = ({
	label,
	value,
	description,
}: {
	label: string;
	value: string | number;
	description?: string;
}) => (
	<div className={styles.statCard}>
		<div className={styles.statLabel}>{label}</div>
		<div className={styles.statValue}>{value}</div>
		{description ? <div className={styles.statMeta}>{description}</div> : null}
	</div>
);

const downloadWithToken = async (
	path: string,
	token: string,
	filename: string
) => {
	const response = await fetch(`${APP_ADMIN_API_URL}${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!response.ok) {
		throw new Error("Không thể export dữ liệu");
	}
	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

export const App = () => {
	const [token, setToken] = React.useState<string | null>(() => getStoredAdminToken());
	const [currentUser, setCurrentUser] = React.useState<AdminSessionUser | null>(null);
	const [booting, setBooting] = React.useState(true);
	const [authError, setAuthError] = React.useState<string | null>(null);
	const [loginForm, setLoginForm] = React.useState({ email: "", password: "" });
	const [loginBusy, setLoginBusy] = React.useState(false);
	const [tab, setTab] = React.useState<TabId>("overview");
	const [refreshKey, setRefreshKey] = React.useState(0);

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
		async (append = false) => {
			if (!token || !hasPermission(currentUser, "user_management")) {
				return;
			}
			setUsersBusy(true);
			try {
				const payload = await adminApi.users(token, {
					q: userFilters.q,
					status: userFilters.status,
					cursor: append ? userFilters.nextCursor : null,
					limit: 50,
				});
				setUsers(append ? [...users, ...payload.users] : payload.users);
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
		[currentUser, token, userFilters.nextCursor, userFilters.q, userFilters.status, users]
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
	}, [currentUser, tab, refreshKey, loadUsers, loadReports, loadBots, loadEvents, loadMonitoring]);

	React.useEffect(() => {
		if (!selectedUserId) {
			setSelectedUser(null);
			return;
		}
		loadUserDetail(selectedUserId).catch(() => undefined);
	}, [selectedUserId, loadUserDetail]);

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
		await adminApi.updateUser(token, selectedUser.user.id, {
			nickname: String(formData.get("nickname") || "").trim() || null,
			email: String(formData.get("email") || "").trim() || null,
			picture: formData.get("picture")
				? Number(formData.get("picture"))
				: null,
			personalInfo: String(formData.get("personalInfo") || "").trim() || null,
			role: formData.get("role") as "player" | "admin",
		});
		await Promise.all([loadUsers(false), loadUserDetail(selectedUser.user.id)]);
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
		await adminApi.updatePermissions(token, selectedUser.user.id, permissions);
		await loadUserDetail(selectedUser.user.id);
		if (currentUser?.id === selectedUser.user.id) {
			const me = await adminApi.me(token);
			setCurrentUser(me.user);
		}
	};

	const onLockUser = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedUser) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		await adminApi.lockUser(token, selectedUser.user.id, {
			reason: String(formData.get("reason") || "").trim(),
			mode: formData.get("mode") === "temporary" ? "temporary" : "permanent",
			durationDays: Number(formData.get("durationDays") || "7"),
		});
		await Promise.all([loadUsers(false), loadUserDetail(selectedUser.user.id), loadOverview()]);
	};

	const onUnlockUser = async (userId: string) => {
		if (!token) {
			return;
		}
		await adminApi.unlockUser(token, userId);
		await Promise.all([loadUsers(false), loadUserDetail(userId), loadOverview()]);
	};

	const onHandleReport = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !selectedReport) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		await adminApi.handleReport(token, selectedReport.report.id, {
			action: String(formData.get("action") || ""),
			adminNote: String(formData.get("adminNote") || "").trim(),
			durationDays: Number(formData.get("durationDays") || "7"),
		});
		await Promise.all([loadReports(), loadReportDetail(selectedReport.report.id), loadOverview()]);
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
		await adminApi.updateBot(token, bot.id, {
			ambition: bot.ambition,
			composure: bot.composure,
			vision: bot.vision,
		});
		await loadBots();
	};

	const onSubmitEvent = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			return;
		}
		await adminApi.createEvent(token, {
			name: eventDraft.name,
			description: eventDraft.description,
			status: eventDraft.status,
			startsAt: eventDraft.startsAt || null,
			endsAt: eventDraft.endsAt || null,
		});
		setEventDraft({
			name: "",
			description: "",
			status: "draft",
			startsAt: "",
			endsAt: "",
		});
		await loadEvents();
	};

	const onUpdateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token || !editingEvent) {
			return;
		}
		const formData = new FormData(event.currentTarget);
		await adminApi.updateEvent(token, editingEvent.id, {
			name: String(formData.get("name") || "").trim(),
			description: String(formData.get("description") || "").trim(),
			status: formData.get("status") as AdminEvent["status"],
			startsAt: String(formData.get("startsAt") || "").trim() || null,
			endsAt: String(formData.get("endsAt") || "").trim() || null,
		});
		setEditingEvent(null);
		await loadEvents();
	};

	if (booting) {
		return <div className={styles.boot}>Đang khởi tạo admin service...</div>;
	}

	if (!currentUser || !token) {
		return (
			<div className={styles.authShell}>
				<div className={styles.authPanel}>
					<div className={styles.brandRow}>
						<div className={styles.brandMark}>
							<Shield size={22} />
						</div>
						<div>
							<div className={styles.brandTitle}>Creature Chess Admin</div>
							<div className={styles.brandMeta}>Tách biệt khỏi giao diện game</div>
						</div>
					</div>
					<h1 className={styles.authTitle}>Đăng nhập quản trị</h1>
					<p className={styles.authDescription}>
						Sử dụng tài khoản quản trị nội bộ. Admin panel chạy trên service riêng.
					</p>
					<form className={styles.authForm} onSubmit={onLogin}>
						<label className={styles.field}>
							<span>Email</span>
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
							<span>Mật khẩu</span>
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
							{loginBusy ? "Đang xác thực..." : "Đăng nhập"}
						</button>
					</form>
					<button
						className={styles.ghostButton}
						onClick={() => (window.location.href = APP_GAME_URL)}
					>
						Về game client
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.shell}>
			<aside className={styles.sidebar}>
				<div className={styles.sidebarHeader}>
					<div className={styles.brandMark}>
						<Shield size={18} />
					</div>
					<div>
						<div className={styles.brandTitle}>Creature Chess Admin</div>
						<div className={styles.brandMeta}>v{APP_VERSION}</div>
					</div>
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
						>
							{item.icon}
							<span>{item.label}</span>
						</button>
					))}
				</nav>
				<div className={styles.sidebarFooter}>
					<div className={styles.adminIdentity}>
						<div className={styles.identityLabel}>Admin hiện tại</div>
						<div className={styles.identityValue}>
							{currentUser.nickname || currentUser.email || currentUser.id}
						</div>
					</div>
					<div className={styles.sidebarActions}>
						<button className={styles.ghostButton} onClick={() => setRefreshKey((value) => value + 1)}>
							<RefreshCw size={16} />
							<span>Làm mới</span>
						</button>
						<button className={styles.ghostButton} onClick={() => (window.location.href = APP_GAME_URL)}>
							Về game
						</button>
						<button className={styles.dangerButton} onClick={onLogout}>
							<LogOut size={16} />
							<span>Đăng xuất</span>
						</button>
					</div>
				</div>
			</aside>

			<main className={styles.main}>
				<header className={styles.header}>
					<div>
						<div className={styles.headerEyebrow}>Admin service riêng</div>
						<h1>{visibleTabs.find((item) => item.id === tab)?.label || "Admin"}</h1>
					</div>
					<div className={styles.permissionPills}>
						{currentUser.permissions.map((permission) => (
							<span key={permission} className={styles.permissionPill}>
								{permission}
							</span>
						))}
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
							<StatCard label="Người chơi" value={overview?.users ?? "-"} />
							<StatCard label="Tài khoản bị khóa" value={overview?.lockedUsers ?? "-"} />
							<StatCard label="Tổng trận" value={overview?.matches ?? "-"} />
							<StatCard label="Report đang mở" value={overview?.openReports ?? "-"} />
							<StatCard label="Bot cấu hình" value={overview?.bots ?? "-"} />
							<StatCard label="Sự kiện đang chạy/chờ" value={overview?.activeEvents ?? "-"} />
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>Vận hành hiện tại</h2>
								{overviewBusy ? <span className={styles.muted}>Đang tải...</span> : null}
							</div>
							<div className={styles.keyValueGrid}>
								<div>
									<span>Uptime</span>
									<strong>{overview ? formatDuration(overview.server.uptimeSeconds) : "-"}</strong>
								</div>
								<div>
									<span>RSS Memory</span>
									<strong>{overview?.server.memoryMb ?? "-"} MB</strong>
								</div>
								<div>
									<span>Heap Used</span>
									<strong>{overview?.server.heapUsedMb ?? "-"} MB</strong>
								</div>
								<div>
									<span>Node</span>
									<strong>{overview?.server.nodeVersion ?? "-"}</strong>
								</div>
								<div>
									<span>Active Players</span>
									<strong>{overview?.server.activePlayers ?? "-"}</strong>
								</div>
								<div>
									<span>Players In Game</span>
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
								placeholder="Tìm theo email, nickname, id"
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
								<option value="all">Tất cả trạng thái</option>
								<option value="active">Đang hoạt động</option>
								<option value="locked">Đang bị khóa</option>
							</select>
							<button className={styles.primaryButton} onClick={() => loadUsers(false)}>
								<RefreshCw size={16} />
								<span>Tải lại</span>
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
								<span>CSV</span>
							</button>
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>Danh sách người dùng</h2>
								<span className={styles.muted}>
									{usersBusy ? "Đang tải..." : `${users.length} mục`}
								</span>
							</div>
							<div className={styles.table}>
								<div className={styles.tableHead}>
									<span>Tài khoản</span>
									<span>Vai trò</span>
									<span>Trạng thái</span>
									<span>Thống kê</span>
									<span></span>
								</div>
								{users.map((user) => (
									<div key={user.id} className={styles.tableRow}>
										<div>
											<div className={styles.rowTitle}>{user.nickname || user.email || user.id}</div>
											<div className={styles.rowMeta}>{user.email || user.id}</div>
										</div>
										<div>{user.role}</div>
										<div>
											<span className={user.locked ? styles.statusDanger : styles.statusOk}>
												{user.locked ? "locked" : "active"}
											</span>
										</div>
										<div className={styles.rowMeta}>
											{user.gamesPlayed} trận / {formatPercent(user.wins, user.gamesPlayed)}
										</div>
										<div className={styles.rowAction}>
											<button
												className={styles.inlineButton}
												onClick={() => setSelectedUserId(user.id)}
											>
												Xem chi tiết
												<ChevronRight size={14} />
											</button>
										</div>
									</div>
								))}
							</div>
							{userFilters.nextCursor ? (
								<div className={styles.loadMoreRow}>
									<button className={styles.ghostButton} onClick={() => loadUsers(true)}>
										Tải thêm 50
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
								<option value="all">Mọi trạng thái</option>
								<option value="pending">Pending</option>
								<option value="reviewed">Reviewed</option>
								<option value="actioned">Actioned</option>
								<option value="dismissed">Dismissed</option>
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
								<option value="all">Mọi lý do</option>
								<option value="abuse">abuse</option>
								<option value="spam">spam</option>
								<option value="offensive_name">offensive_name</option>
								<option value="cheating">cheating</option>
								<option value="other">other</option>
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
								<option value="1">Hôm nay</option>
								<option value="7">7 ngày</option>
								<option value="30">30 ngày</option>
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
								<option value="newest">Mới nhất</option>
								<option value="oldest">Cũ nhất</option>
								<option value="priority">Ưu tiên cao</option>
							</select>
							<button className={styles.primaryButton} onClick={() => loadReports()}>
								<RefreshCw size={16} />
								<span>Lọc</span>
							</button>
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>Danh sách báo cáo</h2>
								<span className={styles.muted}>
									{reportsBusy ? "Đang tải..." : `${reports.length} báo cáo`}
								</span>
							</div>
							<div className={styles.table}>
								<div className={styles.tableHead}>
									<span>Target</span>
									<span>Reason</span>
									<span>Priority</span>
									<span>Trạng thái</span>
									<span></span>
								</div>
								{reports.map((report) => (
									<div key={report.id} className={styles.tableRow}>
										<div>
											<div className={styles.rowTitle}>{report.target.nickname}</div>
											<div className={styles.rowMeta}>
												Reporter: {report.reporter.nickname}
											</div>
										</div>
										<div>{report.reason}</div>
										<div>{report.priority}</div>
										<div>
											<span className={styles.statusInfo}>{report.status}</span>
										</div>
										<div className={styles.rowAction}>
											<button
												className={styles.inlineButton}
												onClick={() => setSelectedReportId(report.id)}
											>
												Xử lý
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
							<select value={monitoringRange} onChange={(event) => setMonitoringRange(event.target.value)}>
								<option value="5m">5 phút</option>
								<option value="1h">1 giờ</option>
								<option value="24h">24 giờ</option>
								<option value="7d">7 ngày</option>
							</select>
							<select value={logLevel} onChange={(event) => setLogLevel(event.target.value)}>
								<option value="all">Tất cả log</option>
								<option value="info">Info</option>
								<option value="warn">Warn</option>
								<option value="error">Error</option>
							</select>
							<button className={styles.primaryButton} onClick={() => loadMonitoring()}>
								<RefreshCw size={16} />
								<span>Làm mới</span>
							</button>
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
								<span>CSV</span>
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
								<span>JSON</span>
							</button>
						</div>
						<div className={styles.statsGrid}>
							<StatCard label="API requests" value={monitoring?.summary?.apiRequests ?? "-"} />
							<StatCard label="5xx errors" value={monitoring?.summary?.api5xx ?? "-"} />
							<StatCard label="Socket connections" value={monitoring?.summary?.socketConnections ?? "-"} />
							<StatCard label="DB latency" value={monitoring?.summary?.dbLatencyMs ?? "-"} description="ms" />
						</div>
						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>Service health</h2>
								<span className={styles.muted}>{monitoringBusy ? "Đang tải..." : monitoring?.checkedAt || ""}</span>
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
								<h2>Biểu đồ hoạt động</h2>
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
									<h2>Alerts</h2>
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
										<div className={styles.emptyState}>Không có cảnh báo trong khoảng thời gian này.</div>
									)}
								</div>
							</div>
							<div className={styles.panel}>
								<div className={styles.panelHeader}>
									<h2>Logs</h2>
								</div>
								<div className={styles.logList}>
									{monitoring?.logs.length ? (
										monitoring.logs.map((entry, index) => (
											<div key={`${entry.timestamp}-${index}`} className={styles.logRow}>
												<div className={styles.rowMeta}>{formatDateTime(entry.timestamp)}</div>
												<div className={styles.rowTitle}>{entry.level.toUpperCase()}</div>
												<div>{entry.message}</div>
											</div>
										))
									) : (
										<div className={styles.emptyState}>Không có log phù hợp.</div>
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
								<h2>Cấu hình bot</h2>
								<span className={styles.muted}>{botsBusy ? "Đang tải..." : `${bots.length} bot`}</span>
							</div>
							<div className={styles.cardGrid}>
								{bots.map((bot) => (
									<div key={bot.id} className={styles.configCard}>
										<div className={styles.configHeader}>
											<div>
												<div className={styles.rowTitle}>{bot.nickname}</div>
												<div className={styles.rowMeta}>
													{bot.games_played} trận / win rate {formatPercent(bot.wins, bot.games_played)}
												</div>
											</div>
											<button className={styles.primaryButton} onClick={() => onSubmitBot(bot)}>
												Lưu
											</button>
										</div>
										{(["ambition", "composure", "vision"] as const).map((field) => (
											<label key={field} className={styles.sliderField}>
												<div className={styles.sliderHeader}>
													<span>{BOT_LABELS[field]}</span>
													<strong>{bot[field]}</strong>
												</div>
												<input
													type="range"
													min={1}
													max={200}
													value={bot[field]}
													onChange={(event) =>
														onSaveBot(bot.id, field, Number(event.target.value))
													}
												/>
											</label>
										))}
										<div className={styles.helpText}>
											`Tactical Vision` hiện mới là tham số lưu cấu hình; logic live chưa dùng sâu như hai chỉ số còn lại.
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}

				{tab === "events" && (
					<section className={styles.sectionStack}>
						<form className={styles.panel} onSubmit={onSubmitEvent}>
							<div className={styles.panelHeader}>
								<h2>Tạo sự kiện mới</h2>
							</div>
							<div className={styles.formGrid}>
								<label className={styles.field}>
									<span>Tên sự kiện</span>
									<input
										value={eventDraft.name}
										onChange={(event) =>
											setEventDraft((state) => ({ ...state, name: event.target.value }))
										}
										required
									/>
								</label>
								<label className={styles.field}>
									<span>Trạng thái</span>
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
									<span>Bắt đầu</span>
									<input
										type="datetime-local"
										value={eventDraft.startsAt}
										onChange={(event) =>
											setEventDraft((state) => ({ ...state, startsAt: event.target.value }))
										}
									/>
								</label>
								<label className={styles.field}>
									<span>Kết thúc</span>
									<input
										type="datetime-local"
										value={eventDraft.endsAt}
										onChange={(event) =>
											setEventDraft((state) => ({ ...state, endsAt: event.target.value }))
										}
									/>
								</label>
								<label className={`${styles.field} ${styles.fieldWide}`}>
									<span>Mô tả</span>
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
							</div>
							<div className={styles.formActions}>
								<button className={styles.primaryButton} type="submit">
									Tạo sự kiện
								</button>
							</div>
						</form>

						<div className={styles.panel}>
							<div className={styles.panelHeader}>
								<h2>Sự kiện hiện có</h2>
								<span className={styles.muted}>{eventsBusy ? "Đang tải..." : `${events.length} sự kiện`}</span>
							</div>
							<div className={styles.cardGrid}>
								{events.map((item) => (
									<div key={item.id} className={styles.configCard}>
										<div className={styles.rowTitle}>{item.name}</div>
										<div className={styles.rowMeta}>{item.status}</div>
										<div className={styles.helpText}>{item.description || "Không có mô tả"}</div>
										<div className={styles.keyValueGrid}>
											<div>
												<span>Bắt đầu</span>
												<strong>{formatDateTime(item.startsAt)}</strong>
											</div>
											<div>
												<span>Kết thúc</span>
												<strong>{formatDateTime(item.endsAt)}</strong>
											</div>
										</div>
										<div className={styles.formActions}>
											<button
												className={styles.ghostButton}
												onClick={() => setEditingEvent(item)}
											>
												Chỉnh sửa
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
					title="Chi tiết người dùng"
					onClose={() => {
						setSelectedUserId(null);
						setSelectedUser(null);
					}}
					wide
				>
					{selectedUserBusy || !selectedUser ? (
						<div className={styles.emptyState}>Đang tải chi tiết người dùng...</div>
					) : (
						<div className={styles.modalLayout}>
							<div className={styles.sectionStack}>
								<form className={styles.panel} onSubmit={onSaveUser}>
									<div className={styles.panelHeader}>
										<h2>Thông tin cơ bản</h2>
										{selectedUser.user.locked ? (
											<span className={styles.statusDanger}>locked</span>
										) : (
											<span className={styles.statusOk}>active</span>
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
											<span>Vai trò</span>
											<select name="role" defaultValue={selectedUser.user.role}>
												<option value="player">player</option>
												<option value="admin">admin</option>
											</select>
										</label>
										<label className={`${styles.field} ${styles.fieldWide}`}>
											<span>Thông tin cá nhân</span>
											<textarea
												name="personalInfo"
												defaultValue={selectedUser.user.personalInfo || ""}
												rows={4}
											/>
										</label>
									</div>
									<div className={styles.formActions}>
										<button className={styles.primaryButton} type="submit">
											Lưu chỉnh sửa
										</button>
										{selectedUser.user.locked ? (
											<button
												type="button"
												className={styles.ghostButton}
												onClick={() => onUnlockUser(selectedUser.user.id)}
											>
												Mở khóa
											</button>
										) : null}
									</div>
								</form>

								<form className={styles.panel} onSubmit={onLockUser}>
									<div className={styles.panelHeader}>
										<h2>Khóa tài khoản</h2>
									</div>
									<div className={styles.formGrid}>
										<label className={styles.field}>
											<span>Mode</span>
											<select name="mode" defaultValue="temporary">
												<option value="temporary">temporary</option>
												<option value="permanent">permanent</option>
											</select>
										</label>
										<label className={styles.field}>
											<span>Duration Days</span>
											<input type="number" name="durationDays" min={1} max={365} defaultValue={7} />
										</label>
										<label className={`${styles.field} ${styles.fieldWide}`}>
											<span>Lý do</span>
											<textarea name="reason" required rows={3} />
										</label>
									</div>
									<div className={styles.formActions}>
										<button className={styles.dangerButton} type="submit">
											<Lock size={16} />
											<span>Khóa tài khoản</span>
										</button>
									</div>
								</form>

								{selectedUser.user.role === "admin" && currentUser.canGrantAdminPermissions ? (
									<form className={styles.panel} onSubmit={onSavePermissions}>
										<div className={styles.panelHeader}>
											<h2>Phân quyền admin</h2>
										</div>
										<div className={styles.checkboxGrid}>
											{ALL_PERMISSIONS.map((permission) => (
												<label key={permission} className={styles.checkboxLabel}>
													<input
														type="checkbox"
														name={permission}
														defaultChecked={selectedUser.user.grantedPermissions.includes(permission)}
													/>
													<span>{permission}</span>
												</label>
											))}
										</div>
										<div className={styles.formActions}>
											<button className={styles.primaryButton} type="submit">
												Cập nhật quyền
											</button>
										</div>
									</form>
								) : null}
							</div>

							<div className={styles.sectionStack}>
								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Thống kê</h2>
									</div>
									<div className={styles.keyValueGrid}>
										<div>
											<span>Games Played</span>
											<strong>{selectedUser.user.gamesPlayed}</strong>
										</div>
										<div>
											<span>Wins</span>
											<strong>{selectedUser.user.wins}</strong>
										</div>
										<div>
											<span>Win Rate</span>
											<strong>
												{formatPercent(selectedUser.user.wins, selectedUser.user.gamesPlayed)}
											</strong>
										</div>
										<div>
											<span>Warnings</span>
											<strong>{selectedUser.user.warningCount}</strong>
										</div>
										<div>
											<span>Last Login</span>
											<strong>{formatDateTime(selectedUser.user.lastLoginAt)}</strong>
										</div>
										<div>
											<span>Last Logout</span>
											<strong>{formatDateTime(selectedUser.user.lastLogoutAt)}</strong>
										</div>
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Hoạt động</h2>
										<select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
											<option value="">Tất cả</option>
											<option value="admin.auth">admin.auth</option>
											<option value="admin.user">admin.user</option>
											<option value="admin.report">admin.report</option>
											<option value="system.user">system.user</option>
										</select>
									</div>
									<div className={styles.stackList}>
										{selectedUser.activity.map((entry) => (
											<div key={entry.id} className={styles.timelineItem}>
												<div className={styles.rowTitle}>{entry.action}</div>
												<div className={styles.rowMeta}>{formatDateTime(entry.createdAt)}</div>
												<div>{entry.reason || entry.metadata || "-"}</div>
											</div>
										))}
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Báo cáo liên quan</h2>
									</div>
									<div className={styles.stackList}>
										{selectedUser.relatedReports.map((entry) => (
											<div key={entry.id} className={styles.timelineItem}>
												<div className={styles.rowTitle}>{entry.reason}</div>
												<div className={styles.rowMeta}>
													{entry.status} / {formatDateTime(entry.createdAt)}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					)}
				</Modal>
			) : null}

			{selectedReportId ? (
				<Modal
					title="Chi tiết báo cáo"
					onClose={() => {
						setSelectedReportId(null);
						setSelectedReport(null);
					}}
					wide
				>
					{selectedReportBusy || !selectedReport ? (
						<div className={styles.emptyState}>Đang tải chi tiết báo cáo...</div>
					) : (
						<div className={styles.modalLayout}>
							<div className={styles.sectionStack}>
								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Nội dung báo cáo</h2>
										<span className={styles.statusInfo}>{selectedReport.report.status}</span>
									</div>
									<div className={styles.keyValueGrid}>
										<div>
											<span>Reason</span>
											<strong>{selectedReport.report.reason}</strong>
										</div>
										<div>
											<span>Match ID</span>
											<strong>{selectedReport.report.matchId || "-"}</strong>
										</div>
										<div>
											<span>Created At</span>
											<strong>{formatDateTime(selectedReport.report.createdAt)}</strong>
										</div>
										<div>
											<span>Action</span>
											<strong>{selectedReport.report.actionType || "-"}</strong>
										</div>
									</div>
									<div className={styles.noteBox}>{selectedReport.report.description || "Không có mô tả."}</div>
								</div>

								<form className={styles.panel} onSubmit={onHandleReport}>
									<div className={styles.panelHeader}>
										<h2>Xử lý báo cáo</h2>
									</div>
									<div className={styles.formGrid}>
										<label className={styles.field}>
											<span>Hành động</span>
											<select name="action" defaultValue="review">
												<option value="review">review</option>
												<option value="dismiss">dismiss</option>
												<option value="warning">warning</option>
												<option value="temporary_ban">temporary_ban</option>
												<option value="permanent_ban">permanent_ban</option>
											</select>
										</label>
										<label className={styles.field}>
											<span>Duration Days</span>
											<input type="number" name="durationDays" min={1} max={365} defaultValue={7} />
										</label>
										<label className={`${styles.field} ${styles.fieldWide}`}>
											<span>Lý do quyết định</span>
											<textarea name="adminNote" required rows={4} defaultValue={selectedReport.report.adminNote || ""} />
										</label>
									</div>
									<div className={styles.formActions}>
										<button className={styles.primaryButton} type="submit">
											Xác nhận xử lý
										</button>
									</div>
								</form>
							</div>

							<div className={styles.sectionStack}>
								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Reporter / Target</h2>
									</div>
									<div className={styles.stackList}>
										<div className={styles.timelineItem}>
											<div className={styles.rowTitle}>
												Reporter: {selectedReport.report.reporter?.nickname || "Đã xóa"}
											</div>
											<div className={styles.rowMeta}>
												{selectedReport.report.reporter?.email || "-"}
											</div>
										</div>
										<div className={styles.timelineItem}>
											<div className={styles.rowTitle}>
												Target: {selectedReport.report.target?.nickname || "Đã xóa"}
											</div>
											<div className={styles.rowMeta}>
												Warnings: {selectedReport.report.target?.warningCount || 0}
											</div>
										</div>
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Pattern lý do</h2>
									</div>
									<div className={styles.stackList}>
										{Object.entries(selectedReport.targetReasonPatterns).map(([reason, count]) => (
											<div key={reason} className={styles.timelineItem}>
												<div className={styles.rowTitle}>{reason}</div>
												<div className={styles.rowMeta}>{count} lần</div>
											</div>
										))}
									</div>
								</div>

								<div className={styles.panel}>
									<div className={styles.panelHeader}>
										<h2>Match participants</h2>
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
					)}
				</Modal>
			) : null}

			{editingEvent ? (
				<Modal
					title="Chỉnh sửa sự kiện"
					onClose={() => setEditingEvent(null)}
				>
					<form className={styles.sectionStack} onSubmit={onUpdateEvent}>
						<label className={styles.field}>
							<span>Tên sự kiện</span>
							<input name="name" defaultValue={editingEvent.name} required />
						</label>
						<label className={styles.field}>
							<span>Trạng thái</span>
							<select name="status" defaultValue={editingEvent.status}>
								<option value="draft">draft</option>
								<option value="scheduled">scheduled</option>
								<option value="active">active</option>
								<option value="ended">ended</option>
							</select>
						</label>
						<label className={styles.field}>
							<span>Bắt đầu</span>
							<input
								type="datetime-local"
								name="startsAt"
								defaultValue={editingEvent.startsAt?.slice(0, 16) || ""}
							/>
						</label>
						<label className={styles.field}>
							<span>Kết thúc</span>
							<input
								type="datetime-local"
								name="endsAt"
								defaultValue={editingEvent.endsAt?.slice(0, 16) || ""}
							/>
						</label>
						<label className={styles.field}>
							<span>Mô tả</span>
							<textarea
								name="description"
								rows={4}
								defaultValue={editingEvent.description}
							/>
						</label>
						<div className={styles.modalActions}>
							<button type="button" className={styles.ghostButton} onClick={() => setEditingEvent(null)}>
								Hủy
							</button>
							<button className={styles.primaryButton} type="submit">
								Lưu cập nhật
							</button>
						</div>
					</form>
				</Modal>
			) : null}
		</div>
	);
};
