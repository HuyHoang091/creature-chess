import React from "react";

import {
	Activity,
	CalendarDays,
	Cpu,
	Flag,
	Moon,
	RefreshCw,
	Server,
	Shield,
	Sun,
	Users,
} from "lucide-react";
import { useSelector } from "react-redux";
import {
	Bar,
	BarChart,
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
	AdminBot,
	AdminEvent,
	AdminOverview,
	AdminReport,
	AdminServerStatus,
	AdminUser,
	createAdminEvent,
	fetchAdminBots,
	fetchAdminEvents,
	fetchAdminOverview,
	fetchAdminReports,
	fetchAdminServerStatus,
	fetchAdminUsers,
	lockAdminUser,
	unlockAdminUser,
	updateAdminBot,
	updateAdminEvent,
	updateAdminReport,
	updateAdminUser,
} from "~/services/adminApi";
import { AppState } from "~/store/state";

import styles from "./AdminPage.module.css";

type AdminTab = "overview" | "users" | "reports" | "bots" | "server" | "events";

type AdminPageProps = {
	standalone?: boolean;
	isBootstrapped?: boolean;
	isAuthenticated?: boolean;
	canAccess?: boolean;
};

const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
	{ id: "overview", label: "Overview", icon: <Activity size={18} /> },
	{ id: "users", label: "Users", icon: <Users size={18} /> },
	{ id: "reports", label: "Reports", icon: <Flag size={18} /> },
	{ id: "bots", label: "Bots", icon: <Cpu size={18} /> },
	{ id: "server", label: "Server", icon: <Server size={18} /> },
	{ id: "events", label: "Events", icon: <CalendarDays size={18} /> },
];

const parseTab = (): AdminTab => {
	const query = new URLSearchParams(window.location.search);
	const tab = query.get("tab");
	return tabs.some((item) => item.id === tab) ? (tab as AdminTab) : "overview";
};

const setAdminTabQuery = (tab: AdminTab) => {
	const url = new URL(window.location.href);
	url.searchParams.set("tab", tab);
	window.history.replaceState({}, "", url.toString());
};

const formatUptime = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
};

const BOT_FIELD_META = {
	ambition: {
		label: "Economy Aggression",
		short:
			"High values make the bot spend harder on XP and rerolls when it sees momentum.",
	},
	composure: {
		label: "Pressure Control",
		short:
			"Low values make the bot react more urgently when health or economy gets shaky.",
	},
	vision: {
		label: "Tactical Vision",
		short:
			"Reserved field. Stored with the bot profile, but not consumed by the current live rule-based bot.",
	},
} as const;

// Reusable Modal Component
const Modal = ({
	title,
	onClose,
	children,
	footer,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	footer?: React.ReactNode;
}) => (
	<div className={styles.modalOverlay} onClick={onClose}>
		<div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
			<div className={styles.modalHeader}>
				<h3>{title}</h3>
				<button className={styles.ghostButton} onClick={onClose} style={{ padding: "4px 8px" }}>
					✕
				</button>
			</div>
			<div className={styles.modalBody}>{children}</div>
			{footer && <div className={styles.modalFooter}>{footer}</div>}
		</div>
	</div>
);

const AdminStatus = ({
	title,
	description,
	actionLabel,
	onAction,
}: {
	title: string;
	description: string;
	actionLabel?: string;
	onAction?: () => void;
}) => (
	<div className={styles.statusShell}>
		<div className={styles.statusCard}>
			<div className={styles.statusIcon}>
				<Shield size={32} />
			</div>
			<h1>{title}</h1>
			<p>{description}</p>
			<div className={styles.statusActions}>
				<button
					className={styles.ghostButton}
					onClick={() => (window.location.href = window.location.origin)}
				>
					Back to game
				</button>
				{actionLabel && onAction && (
					<button className={styles.primaryButton} onClick={onAction}>
						{actionLabel}
					</button>
				)}
			</div>
		</div>
	</div>
);

export const AdminPage = ({
	standalone = false,
	isBootstrapped = true,
	isAuthenticated = true,
	canAccess = true,
}: AdminPageProps) => {
	const token = useSelector((state: AppState) => state.auth.accessToken);
	const currentUser = useSelector(
		(state: AppState) => state.profile.currentUser
	);
	const [tab, setTab] = React.useState<AdminTab>(parseTab);
	const [overview, setOverview] = React.useState<AdminOverview | null>(null);
	const [users, setUsers] = React.useState<AdminUser[]>([]);
	const [reports, setReports] = React.useState<AdminReport[]>([]);
	const [bots, setBots] = React.useState<AdminBot[]>([]);
	const [server, setServer] = React.useState<AdminServerStatus | null>(null);
	const [events, setEvents] = React.useState<AdminEvent[]>([]);
	const [query, setQuery] = React.useState("");
	const [theme, setTheme] = React.useState<"light" | "dark">("light");

	// Modal States
	const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);
	const [editingBot, setEditingBot] = React.useState<AdminBot | null>(null);
	const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);

	const [editDraft, setEditDraft] = React.useState({
		nickname: "",
		personalInfo: "",
		role: "player" as "player" | "admin",
	});
	const [botDraft, setBotDraft] = React.useState<AdminBot | null>(null);
	const [eventDraft, setEventDraft] = React.useState({
		name: "",
		description: "",
		status: "draft" as AdminEvent["status"],
		startsAt: "",
		endsAt: "",
	});

	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const loadedOnce = React.useRef(false);

	const loadAll = React.useCallback(async () => {
		if (!token) {
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const [
				overviewResponse,
				userResponse,
				reportResponse,
				botResponse,
				serverResponse,
				eventResponse,
			] = await Promise.all([
				fetchAdminOverview(token),
				fetchAdminUsers(token, query),
				fetchAdminReports(token),
				fetchAdminBots(token),
				fetchAdminServerStatus(token),
				fetchAdminEvents(token),
			]);
			setOverview(overviewResponse);
			setUsers(userResponse.users);
			setReports(reportResponse.reports);
			setBots(botResponse.bots);
			setServer(serverResponse);
			setEvents(eventResponse.events);
		} catch (loadError) {
			setError((loadError as Error).message);
		} finally {
			setLoading(false);
		}
	}, [query, token]);

	React.useEffect(() => {
		if (!loadedOnce.current && token && canAccess) {
			loadedOnce.current = true;
			loadAll();
		}
	}, [canAccess, loadAll, token]);

	React.useEffect(() => {
		if (standalone) {
			document.title = "Creature Chess Admin";
		}
	}, [standalone]);

	const onTabChange = (nextTab: AdminTab) => {
		setTab(nextTab);
		if (standalone) {
			setAdminTabQuery(nextTab);
		}
	};

	// --- Handlers ---
	const startEditUser = (user: AdminUser) => {
		setEditingUser(user);
		setEditDraft({
			nickname: user.nickname || "",
			personalInfo: user.personalInfo || "",
			role: user.role,
		});
	};

	const saveUser = async () => {
		if (!token || !editingUser) {
			return;
		}
		await updateAdminUser(token, editingUser.id, editDraft);
		setEditingUser(null);
		await loadAll();
	};

	const startEditBot = (bot: AdminBot) => {
		setEditingBot(bot);
		setBotDraft({ ...bot });
	};

	const saveBot = async () => {
		if (!token || !editingBot || !botDraft) {
			return;
		}
		await updateAdminBot(token, editingBot.id, {
			ambition: botDraft.ambition,
			composure: botDraft.composure,
			vision: botDraft.vision,
		});
		setEditingBot(null);
		await loadAll();
	};

	const setReportStatus = async (
		report: AdminReport,
		status: AdminReport["status"]
	) => {
		if (!token) {
			return;
		}
		const adminNote =
			status === "resolved" || status === "dismissed"
				? window.prompt("Admin note", report.adminNote || "") || ""
				: report.adminNote || "";
		await updateAdminReport(token, report.id, { status, adminNote });
		await loadAll();
	};

	const createEvent = async () => {
		if (!token || !eventDraft.name.trim()) {
			return;
		}
		await createAdminEvent(token, {
			name: eventDraft.name.trim(),
			description: eventDraft.description.trim(),
			status: eventDraft.status,
			startsAt: eventDraft.startsAt || null,
			endsAt: eventDraft.endsAt || null,
		});
		setIsEventModalOpen(false);
		setEventDraft({
			name: "",
			description: "",
			status: "draft",
			startsAt: "",
			endsAt: "",
		});
		await loadAll();
	};

	if (standalone && !isBootstrapped) {
		return (
			<AdminStatus
				title="Loading session"
				description="Checking permissions before opening the dashboard."
			/>
		);
	}

	if (standalone && !isAuthenticated) {
		return (
			<AdminStatus
				title="Sign-in required"
				description="You must be authenticated to view this page."
			/>
		);
	}

	if (standalone && !canAccess) {
		return (
			<AdminStatus
				title="Access denied"
				description="This account does not have administrator privileges."
			/>
		);
	}

	if (!token) {
		return (
			<div className={styles.inlineError}>Admin access requires an account.</div>
		);
	}

	const currentTabInfo = tabs.find((item) => item.id === tab);

	// --- Mock Data for Charts ---
	const overviewChartData = [
		{ name: "Mon", users: Math.floor((overview?.users || 100) * 0.7), matches: Math.floor((overview?.matches || 50) * 0.6) },
		{ name: "Tue", users: Math.floor((overview?.users || 100) * 0.75), matches: Math.floor((overview?.matches || 50) * 0.65) },
		{ name: "Wed", users: Math.floor((overview?.users || 100) * 0.8), matches: Math.floor((overview?.matches || 50) * 0.7) },
		{ name: "Thu", users: Math.floor((overview?.users || 100) * 0.85), matches: Math.floor((overview?.matches || 50) * 0.75) },
		{ name: "Fri", users: Math.floor((overview?.users || 100) * 0.9), matches: Math.floor((overview?.matches || 50) * 0.85) },
		{ name: "Sat", users: Math.floor((overview?.users || 100) * 0.95), matches: Math.floor((overview?.matches || 50) * 0.9) },
		{ name: "Sun", users: overview?.users || 120, matches: overview?.matches || 60 },
	];

	const serverMemoryData = [
		{ name: "RSS", value: server?.memory.rssMb || 0, fill: "#3b82f6" },
		{ name: "Heap", value: server?.memory.heapUsedMb || 0, fill: "#10b981" },
	];

	return (
		<div
			className={standalone ? styles.adminShell : styles.embeddedShell}
			data-theme={theme}
		>
			{/* Left Sidebar */}
			<aside className={styles.sidebar}>
				<div className={styles.sidebarHeader}>
					Admin<span>Panel</span>
				</div>
				<nav className={styles.tabList}>
					{tabs.map((item) => (
						<button
							key={item.id}
							className={`${styles.tabButton} ${tab === item.id ? styles.activeTab : ""}`}
							onClick={() => onTabChange(item.id)}
						>
							{item.icon}
							{item.label}
						</button>
					))}
				</nav>
			</aside>

			{/* Main Container */}
			<div className={styles.mainWrapper}>
				{/* Top Header */}
				<header className={styles.header}>
					<h1 className={styles.headerTitle}>{currentTabInfo?.label}</h1>
					<div className={styles.headerActions}>
						<button
							className={styles.themeButton}
							onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
							aria-label="Toggle theme"
						>
							{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
						</button>
						<button className={styles.ghostButton} onClick={loadAll}>
							<RefreshCw size={16} /> Refresh
						</button>
						{standalone && (
							<button
								className={styles.ghostButton}
								onClick={() => (window.location.href = window.location.origin)}
							>
								Exit
							</button>
						)}
						<div className={styles.operatorCard}>
							<span>Admin</span>
							<strong>
								{currentUser?.nickname || currentUser?.email || "Unknown"}
							</strong>
						</div>
					</div>
				</header>

				{/* Scrollable Content Area */}
				<main className={styles.mainContent}>
					{error && <div className={styles.inlineError}>{error}</div>}
					{loading && <div className={styles.inlineMuted}>Loading data...</div>}

					{/* OVERVIEW TAB */}
					{tab === "overview" && overview && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>System Snapshot</h2>
									<p>Real-time metrics and historical trends.</p>
								</div>
							</div>
							<div className={styles.metricGrid}>
								<div className={styles.metricCard}>
									<span>Players</span>
									<strong>{overview.users}</strong>
								</div>
								<div className={styles.metricCard}>
									<span>Matches</span>
									<strong>{overview.matches}</strong>
								</div>
								<div className={styles.metricCard}>
									<span>Open Reports</span>
									<strong>{overview.openReports}</strong>
								</div>
								<div className={styles.metricCard}>
									<span>Uptime</span>
									<strong>{formatUptime(overview.server.uptimeSeconds)}</strong>
								</div>
							</div>

							<div className={styles.panelCard} style={{ height: "400px", marginTop: "32px" }}>
								<h3 style={{ marginTop: 0, marginBottom: "24px" }}>Weekly Activity Trend</h3>
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={overviewChartData}>
										<CartesianGrid strokeDasharray="3 3" opacity={0.2} />
										<XAxis dataKey="name" stroke={theme === 'dark' ? "#94a3b8" : "#6b7280"} />
										<YAxis stroke={theme === 'dark' ? "#94a3b8" : "#6b7280"} />
										<Tooltip 
											contentStyle={{ 
												backgroundColor: theme === 'dark' ? "#1e293b" : "#fff",
												borderColor: theme === 'dark' ? "#334155" : "#e5e7eb",
												color: theme === 'dark' ? "#f8fafc" : "#111827"
											}}
										/>
										<Legend />
										<Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
										<Line type="monotone" dataKey="matches" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
									</LineChart>
								</ResponsiveContainer>
							</div>
						</div>
					)}

					{/* USERS TAB */}
					{tab === "users" && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>User Management</h2>
									<p>Search, edit, and moderate player accounts.</p>
								</div>
							</div>
							<div className={styles.controlRow}>
								<input
									className={styles.inputField}
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Search by nickname or email..."
								/>
								<button className={styles.primaryButton} onClick={loadAll}>
									Search
								</button>
							</div>

							<div className={styles.dataTable}>
								<div className={styles.tableHeader}>
									<div>Account</div>
									<div>Performance</div>
									<div>Role</div>
									<div>Status</div>
									<div>Actions</div>
								</div>
								{users.map((user) => (
									<div className={styles.tableRow} key={user.id}>
										<div className={styles.cellPrimary}>
											<strong>{user.nickname || "Unregistered"}</strong>
											<span>{user.email || user.id}</span>
										</div>
										<div className={styles.cellPrimary}>
											<span>
												{user.wins}W / {user.gamesPlayed}G
											</span>
										</div>
										<div>
											<span className={styles.badge}>{user.role}</span>
										</div>
										<div>
											{user.locked ? (
												<span className={`${styles.badge} ${styles.badgeDanger}`}>
													Locked
												</span>
											) : (
												<span className={`${styles.badge} ${styles.badgeSuccess}`}>
													Active
												</span>
											)}
										</div>
										<div className={styles.actionRow}>
											<button
												className={styles.ghostButton}
												onClick={() => startEditUser(user)}
											>
												Edit
											</button>
											{user.locked ? (
												<button
													className={styles.primaryButton}
													onClick={() =>
														token && unlockAdminUser(token, user.id).then(loadAll)
													}
												>
													Unlock
												</button>
											) : (
												<button
													className={styles.dangerButton}
													onClick={() =>
														token &&
														lockAdminUser(token, user.id, "Policy violation").then(
															loadAll
														)
													}
												>
													Lock
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* REPORTS TAB */}
					{tab === "reports" && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>Reports</h2>
									<p>Review player flags and assign moderation actions.</p>
								</div>
							</div>
							<div className={styles.dataTable}>
								<div
									className={styles.tableHeader}
									style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1.5fr" }}
								>
									<div>Reported User</div>
									<div>Reason</div>
									<div>Date</div>
									<div>Status</div>
									<div>Actions</div>
								</div>
								{reports.map((report) => (
									<div
										key={report.id}
										className={styles.tableRow}
										style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1.5fr" }}
									>
										<div className={styles.cellPrimary}>
											<strong>{report.target.nickname}</strong>
											<span>By: {report.reporter.nickname}</span>
										</div>
										<div className={styles.cellPrimary}>
											<strong>{report.reason}</strong>
										</div>
										<div className={styles.cellPrimary}>
											<span>{new Date(report.createdAt).toLocaleDateString()}</span>
										</div>
										<div>
											<span className={styles.badge}>{report.status}</span>
										</div>
										<div className={styles.actionRow}>
											<button
												className={styles.ghostButton}
												onClick={() => setReportStatus(report, "reviewing")}
											>
												Review
											</button>
											<button
												className={styles.primaryButton}
												onClick={() => setReportStatus(report, "resolved")}
											>
												Resolve
											</button>
											<button
												className={styles.dangerButton}
												onClick={() => setReportStatus(report, "dismissed")}
											>
												Dismiss
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* BOTS TAB */}
					{tab === "bots" && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>Bot Tuning</h2>
									<p>Adjust AI behavior parameters for live matches.</p>
								</div>
							</div>
							<div className={styles.botGrid}>
								{bots.map((bot) => (
									<div key={bot.id} className={styles.panelCard}>
										<div
											className={styles.sectionHeader}
											style={{ marginBottom: "16px" }}
										>
											<div>
												<h2 style={{ fontSize: "18px" }}>{bot.nickname}</h2>
												<p style={{ fontSize: "13px" }}>
													{bot.wins} wins / {bot.games_played} games
												</p>
											</div>
										</div>
										<div className={styles.actionRow}>
											<button
												className={styles.ghostButton}
												onClick={() => startEditBot(bot)}
											>
												Configure Bot
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* SERVER TAB */}
					{tab === "server" && server && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>Server Status</h2>
									<p>Live technical diagnostics of the node process.</p>
								</div>
							</div>
							<div className={styles.metricGrid}>
								<div className={styles.metricCard}>
									<span>Process Status</span>
									<strong>{server.status}</strong>
								</div>
								<div className={styles.metricCard}>
									<span>Database</span>
									<strong>{server.databaseStatus}</strong>
								</div>
								<div className={styles.metricCard}>
									<span>Node Version</span>
									<strong>{server.nodeVersion}</strong>
								</div>
							</div>

							<div className={styles.panelCard} style={{ height: "400px", marginTop: "32px" }}>
								<h3 style={{ marginTop: 0, marginBottom: "24px" }}>Memory Usage (MB)</h3>
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={serverMemoryData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
										<CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
										<XAxis type="number" stroke={theme === 'dark' ? "#94a3b8" : "#6b7280"} />
										<YAxis dataKey="name" type="category" stroke={theme === 'dark' ? "#94a3b8" : "#6b7280"} width={80} />
										<Tooltip 
											contentStyle={{ 
												backgroundColor: theme === 'dark' ? "#1e293b" : "#fff",
												borderColor: theme === 'dark' ? "#334155" : "#e5e7eb",
												color: theme === 'dark' ? "#f8fafc" : "#111827"
											}}
										/>
										<Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40} />
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					)}

					{/* EVENTS TAB */}
					{tab === "events" && (
						<div>
							<div className={styles.sectionHeader}>
								<div>
									<h2>Events</h2>
									<p>Create and manage special server events.</p>
								</div>
								<button className={styles.primaryButton} onClick={() => setIsEventModalOpen(true)}>
									+ New Event
								</button>
							</div>

							<div className={styles.dataTable}>
								<div
									className={styles.tableHeader}
									style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
								>
									<div>Event Details</div>
									<div>Status</div>
									<div>Update</div>
								</div>
								{events.map((event) => (
									<div
										key={event.id}
										className={styles.tableRow}
										style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
									>
										<div className={styles.cellPrimary}>
											<strong>{event.name}</strong>
											<span>{event.description || "No description."}</span>
										</div>
										<div>
											<span className={styles.badge}>{event.status}</span>
										</div>
										<div>
											<select
												className={styles.selectField}
												value={event.status}
												onChange={(changeEvent) =>
													token &&
													updateAdminEvent(token, event.id, {
														status: changeEvent.target.value as AdminEvent["status"],
													}).then(loadAll)
												}
											>
												<option value="draft">Draft</option>
												<option value="scheduled">Scheduled</option>
												<option value="active">Active</option>
												<option value="ended">Ended</option>
											</select>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</main>
			</div>

			{/* --- MODALS --- */}

			{/* Edit User Modal */}
			{editingUser && (
				<Modal
					title={`Edit User: ${editingUser.nickname || "Unregistered"}`}
					onClose={() => setEditingUser(null)}
					footer={
						<>
							<button className={styles.ghostButton} onClick={() => setEditingUser(null)}>
								Cancel
							</button>
							<button className={styles.primaryButton} onClick={saveUser}>
								Save Changes
							</button>
						</>
					}
				>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Nickname</label>
						<input
							className={styles.inputField}
							value={editDraft.nickname}
							onChange={(event) =>
								setEditDraft((prev) => ({
									...prev,
									nickname: event.target.value,
								}))
							}
							placeholder="Nickname"
						/>
					</div>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Role</label>
						<select
							className={styles.selectField}
							value={editDraft.role}
							onChange={(event) =>
								setEditDraft((prev) => ({
									...prev,
									role: event.target.value as "player" | "admin",
								}))
							}
						>
							<option value="player">Player</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Profile Note</label>
						<textarea
							className={styles.inputField}
							value={editDraft.personalInfo}
							onChange={(event) =>
								setEditDraft((prev) => ({
									...prev,
									personalInfo: event.target.value,
								}))
							}
							placeholder="Profile note"
							style={{ minHeight: "80px", resize: "vertical" }}
						/>
					</div>
				</Modal>
			)}

			{/* Edit Bot Modal */}
			{editingBot && botDraft && (
				<Modal
					title={`Configure Bot: ${editingBot.nickname}`}
					onClose={() => setEditingBot(null)}
					footer={
						<>
							<button className={styles.ghostButton} onClick={() => setEditingBot(null)}>
								Cancel
							</button>
							<button className={styles.primaryButton} onClick={saveBot}>
								Save Configuration
							</button>
						</>
					}
				>
					<div className={styles.sliderStack}>
						{(["ambition", "composure", "vision"] as const).map((key) => (
							<div key={key} className={styles.sliderField}>
								<div className={styles.sliderHeader}>
									<div>
										<h4>{BOT_FIELD_META[key].label}</h4>
										<p>{BOT_FIELD_META[key].short}</p>
									</div>
									<span className={styles.sliderValue}>{botDraft[key]}</span>
								</div>
								<input
									type="range"
									min={1}
									max={200}
									value={botDraft[key]}
									onChange={(event) =>
										setBotDraft((prev) => prev && {
											...prev,
											[key]: Number(event.target.value),
										})
									}
								/>
							</div>
						))}
					</div>
				</Modal>
			)}

			{/* Create Event Modal */}
			{isEventModalOpen && (
				<Modal
					title="Create New Event"
					onClose={() => setIsEventModalOpen(false)}
					footer={
						<>
							<button className={styles.ghostButton} onClick={() => setIsEventModalOpen(false)}>
								Cancel
							</button>
							<button className={styles.primaryButton} onClick={createEvent}>
								Create Event
							</button>
						</>
					}
				>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Event Name</label>
						<input
							className={styles.inputField}
							value={eventDraft.name}
							onChange={(event) =>
								setEventDraft((prev) => ({
									...prev,
									name: event.target.value,
								}))
							}
							placeholder="E.g., Weekend Tournament"
						/>
					</div>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Description</label>
						<textarea
							className={styles.inputField}
							value={eventDraft.description}
							onChange={(event) =>
								setEventDraft((prev) => ({
									...prev,
									description: event.target.value,
								}))
							}
							placeholder="Event details..."
							style={{ minHeight: "80px", resize: "vertical" }}
						/>
					</div>
					<div className={styles.sliderField}>
						<label className={styles.sliderHeader}>Status</label>
						<select
							className={styles.selectField}
							value={eventDraft.status}
							onChange={(event) =>
								setEventDraft((prev) => ({
									...prev,
									status: event.target.value as AdminEvent["status"],
								}))
							}
						>
							<option value="draft">Draft</option>
							<option value="scheduled">Scheduled</option>
							<option value="active">Active</option>
							<option value="ended">Ended</option>
						</select>
					</div>
				</Modal>
			)}
		</div>
	);
};
