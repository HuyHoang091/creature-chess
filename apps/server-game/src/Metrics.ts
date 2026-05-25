import { Counter, Gauge, Histogram } from "prom-client";

export const gamesStarted = new Counter({
	name: "tong_so_tran_da_bat_dau",
	help: "Tong so tran da bat dau tren may chu",
});

export const activeGames = new Gauge({
	name: "so_tran_dang_dien_ra",
	help: "So luong tran dau dang dien ra tren may chu hien tai",
});

export const battlesStarted = new Counter({
	name: "tong_so_giao_tranh_da_bat_dau",
	help: "Tong so lan giao tranh da dien ra",
});

export const turnDurationMs = new Histogram({
	name: "thoi_gian_mot_luot_ms",
	help: "Thoi luong moi luot choi tinh bang milli giay",
	buckets: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000],
});

export const activeBattles = new Gauge({
	name: "so_giao_tranh_dang_dien_ra",
	help: "So luong giao tranh dang dien ra hien tai",
});

export const socketInBytes = new Counter({
	name: "tong_so_byte_nhan_qua_socket",
	help: "Tong dung luong du lieu nhan duoc qua Socket.IO bytes",
	labelNames: ["event"],
});

export const socketOutBytes = new Counter({
	name: "tong_so_byte_gui_qua_socket",
	help: "Tong dung luong du lieu da gui qua Socket.IO bytes",
	labelNames: ["event"],
});

export const activePlayers = new Gauge({
	name: "so_nguoi_choi_dang_hoat_dong",
	help: "So nguoi choi account dang hien dien",
});

export const playersInRoom = new Gauge({
	name: "so_nguoi_choi_trong_phong",
	help: "So nguoi choi account dang o private room",
});

export const playersInGame = new Gauge({
	name: "so_nguoi_choi_trong_tran",
	help: "So nguoi choi account dang o runtime tran dau",
});

export const activeRooms = new Gauge({
	name: "so_phong_choi_dang_mo",
	help: "So private room dang mo",
});

export const socketConnections = new Gauge({
	name: "so_ket_noi_socket_hoat_dong",
	help: "Tong so ket noi socket hien tai",
});
