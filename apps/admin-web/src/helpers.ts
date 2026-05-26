import type { AdminPermission, AdminSessionUser } from "./api";
import { TRANSLATIONS } from "./translations";

export const APP_VERSION = "0.7.3";

export const APP_ADMIN_API_URL =
	typeof window !== "undefined" && (window as any).__CC_ADMIN_API_URL
		? (window as any).__CC_ADMIN_API_URL
		: typeof process !== "undefined" && process.env?.ADMIN_API_URL
		? process.env.ADMIN_API_URL
		: "http://localhost:3003";

export const ALL_PERMISSIONS: AdminPermission[] = [
	"user_management",
	"report_management",
	"server_monitoring",
	"bot_management",
	"event_management",
	"admin_permissions",
];

export const BOT_LABELS = {
	ambition: "Economy Aggression",
	composure: "Pressure Control",
	vision: "Tactical Vision",
} as const;

// --- Label helpers ---

export const getStatusLabel = (status: string, currentLang: "vi" | "en") => {
	const map = TRANSLATIONS[currentLang] as Record<string, string>;
	return map[status] || status;
};

export const getRoleLabel = (role: string, currentLang: "vi" | "en") => {
	const map: Record<string, string> = {
		player: currentLang === "vi" ? "Người chơi" : "Player",
		admin: currentLang === "vi" ? "Quản trị viên" : "Admin",
	};
	return map[role] || role;
};

export const getReasonLabelStr = (reason: string, currentLang: "vi" | "en") => {
	const map = TRANSLATIONS[currentLang] as Record<string, string>;
	return map[reason] || reason;
};

export const getActionTypeLabel = (action: string | null, currentLang: "vi" | "en") => {
	if (!action) return "-";
	const map = TRANSLATIONS[currentLang] as Record<string, string>;
	return map[action] || action;
};

export const getPermissionLabel = (permission: string, langState: "vi" | "en") => {
	const maps = {
		vi: {
			user_management: "Quản lý User",
			report_management: "Quản lý Báo cáo",
			server_monitoring: "Giám sát Máy chủ",
			bot_management: "Quản lý Bot AI",
			event_management: "Quản lý Sự kiện",
			admin_permissions: "Phân quyền Admin",
		},
		en: {
			user_management: "User Management",
			report_management: "Report Management",
			server_monitoring: "Server Monitoring",
			bot_management: "AI Bot Management",
			event_management: "Event Management",
			admin_permissions: "Admin Permissions",
		},
	};
	return maps[langState][permission as keyof typeof maps.vi] || permission;
};

export const getActivityActionLabel = (action: string, langState: "vi" | "en") => {
	const maps = {
		vi: {
			"admin.auth.login": "Đăng nhập admin",
			"admin.auth.logout": "Đăng xuất admin",
			"admin.user.updated": "Cập nhật thông tin user",
			"admin.user.temp_locked": "Khóa tài khoản tạm thời",
			"admin.user.locked": "Khóa tài khoản vĩnh viễn",
			"admin.user.unlocked": "Mở khóa tài khoản",
			"admin.user.permissions_updated": "Cập nhật phân quyền admin",
			"admin.report.handled": "Xử lý báo cáo",
			"system.user.auto_unlocked": "Hệ thống tự động mở khóa",
		},
		en: {
			"admin.auth.login": "Admin login",
			"admin.auth.logout": "Admin logout",
			"admin.user.updated": "Updated user info",
			"admin.user.temp_locked": "Temporarily locked user",
			"admin.user.locked": "Permanently locked user",
			"admin.user.unlocked": "Unlocked user",
			"admin.user.permissions_updated": "Updated admin permissions",
			"admin.report.handled": "Handled report",
			"system.user.auto_unlocked": "System auto-unlocked user",
		},
	};
	return maps[langState][action as keyof typeof maps.vi] || action;
};

export const formatActivityMeta = (entry: any, langState: "vi" | "en") => {
	if (!entry.metadata) return null;
	try {
		const data =
			typeof entry.metadata === "string"
				? JSON.parse(entry.metadata)
				: entry.metadata;
		if (data.newValue) {
			const changes = [];
			for (const [key, val] of Object.entries(data.newValue)) {
				const oldVal = data.oldValue?.[key];
				if (JSON.stringify(oldVal) !== JSON.stringify(val)) {
					changes.push(`${key}: ${oldVal ?? "null"} → ${val ?? "null"}`);
				}
			}
			return changes.length > 0
				? langState === "vi"
					? `Thay đổi: ${changes.join(", ")}`
					: `Changes: ${changes.join(", ")}`
				: null;
		}
		if (data.permissions) {
			const list = data.permissions
				.map((p: string) => getPermissionLabel(p, langState))
				.join(", ");
			return langState === "vi"
				? `Quyền mới: ${list || "Không có"}`
				: `New permissions: ${list || "None"}`;
		}
		if (data.durationDays) {
			return langState === "vi"
				? `Thời hạn: ${data.durationDays} ngày. Lý do: ${entry.reason || "-"}`
				: `Duration: ${data.durationDays} days. Reason: ${entry.reason || "-"}`;
		}
		return typeof data === "object" ? JSON.stringify(data) : String(data);
	} catch (e) {
		return String(entry.metadata);
	}
};

// --- Formatters ---

export const formatDateTime = (
	value: string | null | undefined,
	langState: "vi" | "en" = "vi"
) =>
	value
		? new Date(value).toLocaleString(langState === "vi" ? "vi-VN" : "en-US")
		: "-";

export const formatDuration = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${minutes}m`;
};

export const formatPercent = (wins: number, gamesPlayed: number) => {
	if (!gamesPlayed) {
		return "0%";
	}
	return `${Math.round((wins / gamesPlayed) * 100)}%`;
};

// --- Utilities ---

export const hasPermission = (
	user: AdminSessionUser | null,
	permission?: AdminPermission
) => !permission || Boolean(user?.permissions.includes(permission));

export const downloadWithToken = async (
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
