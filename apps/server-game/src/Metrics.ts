import { Counter, Histogram, Gauge } from "prom-client";

export const gamesStarted = new Counter({
	name: "tong_so_tran_da_bat_dau",
	help: "Tổng số trận đấu đã bắt đầu trên máy chủ",
});

export const activeGames = new Gauge({
	name: "so_tran_dang_dien_ra",
	help: "Số lượng trận đấu đang diễn ra trên máy chủ hiện tại",
});

export const battlesStarted = new Counter({
	name: "tong_so_giao_tranh_da_bat_dau",
	help: "Tổng số lần giao tranh đã diễn ra",
});

export const turnDurationMs = new Histogram({
	name: "thoi_gian_mot_luot_ms",
	help: "Thời lượng mỗi lượt chơi (tính bằng milli-giây) - Được chia theo nhiều mức độ",
	buckets: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000],
});

export const activeBattles = new Gauge({
	name: "so_giao_tranh_dang_dien_ra",
	help: "Số lượng giao tranh đang diễn ra hiện tại",
});

export const socketInBytes = new Counter({
	name: "tong_so_byte_nhan_qua_socket",
	help: "Tổng dung lượng dữ liệu nhận được qua Socket.IO (bytes)",
	labelNames: ["event"],
});

export const socketOutBytes = new Counter({
	name: "tong_so_byte_gui_qua_socket",
	help: "Tổng dung lượng dữ liệu đã gửi qua Socket.IO (bytes)",
	labelNames: ["event"],
});
