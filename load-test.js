const { io } = require("socket.io-client");
const axios = require("axios");

// Cấu hình test tải
const SERVER_URL = "https://covuasinhvat.xyz";
const AUTH_URL = "https://covuasinhvat.xyz/api/guest/session";
const MAX_CLIENTS = 1000; // Số lượng kết nối đồng thời muốn tạo
const CLIENT_CREATION_INTERVAL_IN_MS = 100; // Tốc độ tạo client mới (càng thấp càng dồn dập)
const EMIT_INTERVAL_IN_MS = 1000; // Tần suất gửi event (để tạo tải CPU cho server)

let clientCount = 0;
let connectedCount = 0;
let authenticatedCount = 0;
let errorCount = 0;
const clients = [];

console.log(`🚀 Bắt đầu giả lập ${MAX_CLIENTS} guest tham gia đấu trường (${SERVER_URL})...`);

async function createClient() {
    try {
        // 1. Lấy token guest hợp lệ từ server auth
        const response = await axios.get(AUTH_URL, {
            headers: {
                "User-Agent": "LoadTester"
            }
        });

        // Lấy token từ header Set-Cookie trả về
        const cookies = response.headers["set-cookie"];
        if (!cookies || cookies.length === 0) {
            throw new Error("Không nhận được cookie guest-token");
        }

        const guestTokenCookie = cookies.find(c => c.includes("guest-token="));
        if (!guestTokenCookie) {
            throw new Error("Không tìm thấy guest-token trong cookie");
        }

        const token = guestTokenCookie.split("guest-token=")[1].split(";")[0];

        // 2. Kết nối tới server game bằng Socket.IO
        const socket = io(SERVER_URL, {
            path: "/game/socket.io",
            transports: ["websocket"], // Ép dùng websocket thay vì polling để chuẩn tải thực
            reconnection: false, // Tạm tắt kết nối lại tự động để đo chính xác số bị rớt
            parser: require("socket.io-msgpack-parser")
        });

        socket.on("connect", () => {
            connectedCount++;
            console.log(`[+] Client Socket ${socket.id} đã kết nối mạng. Đang chứng thực...`);

            // Gửi tay bắt mặt mừng (Handshake) để vào sảnh ghép trận (Matchmaking)
            socket.emit("authenticate", {
                type: "guest",
                data: {
                    accessToken: token
                }
            });
        });

        socket.on("handshake_success", () => {
            authenticatedCount++;
            console.log(`[✔] Client ${socket.id} đã authenticate xong và tham gia Hàng Chờ (Matchmaking) (${authenticatedCount}/${MAX_CLIENTS})`);
        });

        socket.on("handshake_failure", (err) => {
            console.error(`[X] Client ${socket.id} bị từ chối chứng thực:`, err);
        });

        socket.on("connect_error", (err) => {
            errorCount++;
            console.error(`[!] Lỗi Socket client thứ ${clientCount}: ${err.message}`);
        });

        socket.on("disconnect", (reason) => {
            connectedCount--;
            console.log(`[-] Client ngắt kết nối: ${reason}. Đang duy trì: ${connectedCount}`);
        });

        // Giả lập traffic: gửi event liên tục để bắt server phải xử lý
        setInterval(() => {
            if (socket.connected) {
                // Gửi thông tin hành động ngẫu nhiên để server phải chạy các file game loop
                socket.emit("room_action", { timestamp: Date.now(), workload: "Z".repeat(50) });
            }
        }, EMIT_INTERVAL_IN_MS);

        clients.push(socket);

    } catch (error) {
        errorCount++;
        console.error(`[!] Lỗi tạo guest: ${error.message}`);
    }
}

const interval = setInterval(() => {
    createClient();
    clientCount++;

    if (clientCount >= MAX_CLIENTS) {
        clearInterval(interval);
        console.log(`\n✅ Đã spam xong lệnh tạo ${MAX_CLIENTS} clients. Chờ hệ thống ổn định...`);
        console.log(`👉 Vào http://localhost:3001/metrics để xem lượng RAM/CPU của server đang tăng lên (nếu đã cài Basic Auth)`);
        console.log(`👉 Bạn cũng sẽ thấy log terminal có thông báo tạo mới Lobby liên tục.`);
    }
}, CLIENT_CREATION_INTERVAL_IN_MS);

// In trạng thái mỗi 5 giây
setInterval(() => {
    console.log(`\n📊 [Thống kê nhanh] Đã tạo game: ${authenticatedCount}/${MAX_CLIENTS}. Lỗi: ${errorCount}\n`);
}, 5000);
