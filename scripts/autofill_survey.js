#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

// Google Form Submit URL
const SUBMIT_URL = "https://docs.google.com/forms/u/0/d/e/1FAIpQLSfK2wqxguJtEOtwQqeYu5wvCAE4kpIZeR6uQsXffMztMeRRkg/formResponse";

const FORM_SCHEMA = {
    "doi_tuong": {
        "id": "entry.177449101",
        "name": "Bạn thuộc nhóm đối tượng nào?",
        "options": ["Sinh viên CNTT", "Sinh viên ngành khác", "Người đi làm", "Người chơi game phổ thông"]
    },
    "tan_suat": {
        "id": "entry.390271669",
        "name": "Bạn có thường xuyên chơi game trực tuyến không?",
        "options": ["3–5 lần/tuần", "1–2 lần/tuần", "Thỉnh thoảng", "Hầu như không", "Gần như hằng ngày"]
    },
    "thiet_bi": {
        "id": "entry.1568775449",
        "name": "Thiết bị bạn thường dùng để chơi game là gì?",
        "options": ["Máy tính để bàn", "Laptop", "Điện thoại", "Máy tính bảng"],
        "is_checkbox": true
    },
    "biet_auto_battler": {
        "id": "entry.498607222",
        "name": "Bạn đã từng chơi hoặc biết đến game chiến thuật tự động/auto-battler chưa?",
        "options": ["Chưa từng biết", "Đã nghe qua", "Đã chơi thử", "Đã chơi nhiều lần", "Đang chơi thường xuyên"]
    },
    "biet_game_nao": {
        "id": "entry.1246269630",
        "name": "Bạn biết hoặc từng chơi game nào sau đây?",
        "options": ["Teamfight Tactics", "Dota Auto Chess", "Auto Chess Mobile", "Hearthstone Battlegrounds", "Game tương tự khác", "Chưa từng chơi"],
        "is_checkbox": true
    },
    "hung_thu_browser": {
        "id": "entry.1655346710",
        "name": "Bạn có hứng thú với một game chiến thuật tự động chơi trực tiếp trên trình duyệt web không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "quan_trong_no_install": {
        "id": "entry.1392278946",
        "name": "Việc không cần cài đặt, chỉ cần mở trình duyệt để chơi có quan trọng với bạn không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "kho_khan_game_hien_tai": {
        "id": "entry.1116472983",
        "name": "Khi chơi các game online hiện nay, bạn thường gặp khó khăn nào?",
        "options": ["Phải tải/cài đặt game", "Dung lượng lớn", "Cập nhật lâu", "Máy yếu khó chạy mượt", "Luật chơi phức tạp", "Khó biết cách xây dựng đội hình", "Không có hướng dẫn rõ ràng"],
        "is_checkbox": true
    },
    "chuc_nang_he_thong": {
        "id": "entry.1770047157",
        "name": "Các chức năng nào bạn cho là cần có trong một game online nhiều người chơi?",
        "options": ["Đăng ký/đăng nhập", "Chơi thử bằng tài khoản khách", "Ghép trận tự động", "Tạo phòng riêng", "Mời bạn bè", "Xem lịch sử trận đấu", "Thống kê cá nhân", "Báo cáo người chơi vi phạm"],
        "is_checkbox": true
    },
    "chuc_nang_gameplay": {
        "id": "entry.1432016977",
        "name": "Các chức năng gameplay nào bạn thấy quan trọng trong game auto-battler?",
        "options": ["Mua sinh vật/quân cờ", "Làm mới cửa hàng", "Mua kinh nghiệm/tăng cấp", "Xếp đội hình", "Trang bị vật phẩm", "Chế tạo vật phẩm", "Kích hoạt tộc/hệ", "Xem đội hình đối thủ", "Khóa cửa hàng"],
        "is_checkbox": true
    },
    "choi_thu_ko_reg": {
        "id": "entry.347292542",
        "name": "Bạn có muốn game cho phép chơi thử mà không cần đăng ký tài khoản không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "kho_khan_game_chien_thuat": {
        "id": "entry.1141135564",
        "name": "Khi chơi game chiến thuật, bạn thường gặp khó khăn ở điểm nào?",
        "options": ["Không hiểu luật chơi", "Không biết nên mua quân nào", "Không biết xếp đội hình", "Không biết ghép vật phẩm", "Không biết đội hình nào mạnh", "Không biết khắc chế đối thủ", "Không biết quản lý vàng/tài nguyên", "Không gặp khó khăn đáng kể"],
        "is_checkbox": true
    },
    "can_huong_dan_trong_game": {
        "id": "entry.1002457694",
        "name": "Bạn có cần hệ thống hướng dẫn luật chơi, vật phẩm và đội hình ngay trong game không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "muon_ai_coach": {
        "id": "entry.548662296",
        "name": "Bạn có muốn game có trợ lý AI để trả lời câu hỏi về luật chơi và chiến thuật không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "ai_ho_tro_gi": {
        "id": "entry.1217270139",
        "name": "Những dạng hỗ trợ AI nào bạn thấy hữu ích?",
        "options": ["Giải thích luật chơi", "Giải thích sinh vật/vật phẩm", "Gợi ý đội hình", "Gợi ý cách xếp quân", "Gợi ý chọn vật phẩm", "Phân tích đội hình hiện tại", "Phân tích đối thủ", "Phân tích sau trận đấu"],
        "is_checkbox": true
    },
    "ai_coach_vai_tro": {
        "id": "entry.1538998426",
        "name": "Theo bạn, AI Coach nên đóng vai trò như thế nào trong game?",
        "options": ["Chỉ giải thích luật chơi", "Gợi ý tham khảo, người chơi tự quyết định", "Gợi ý chi tiết nhưng không tự động chơi thay", "Đưa ra phương án tối ưu càng nhiều càng tốt", "Không nên có AI Coach"]
    },
    "chap_nhan_tra_phi_ai": {
        "id": "entry.2074719491",
        "name": "Bạn có chấp nhận mô hình game miễn phí, trong đó AI Coach nâng cao là chức năng mở rộng không?",
        "options": ["1", "2", "3", "4", "5"]
    },
    "hinh_thuc_thu_phi": {
        "id": "entry.1657998320",
        "name": "Nếu có gói AI Coach nâng cao, hình thức nào phù hợp hơn?",
        "options": ["Miễn phí hoàn toàn", "Miễn phí giới hạn lượt hỏi", "Trả phí theo lượt sử dụng", "Trả phí theo tháng", "Gói ưu đãi cho sinh viên", "Không quan tâm"]
    }
};

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSample(arr, num) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
}

function generateResponseByProfile() {
    const rand = Math.random() * 100;
    let profileType = "it_student";
    if (rand > 45 && rand <= 80) profileType = "casual_gamer";
    else if (rand > 80) profileType = "professional";

    const answers = [];

    if (profileType === "it_student") {
        answers.push(["entry.177449101", getRandomElement(["Sinh viên CNTT", "Người đi làm"])]);
        answers.push(["entry.390271669", getRandomElement(["Gần như hằng ngày", "3–5 lần/tuần"])]);
        const devices = getRandomSample(["Máy tính để bàn", "Laptop"], Math.floor(Math.random() * 2) + 1);
        if (Math.random() < 0.3) devices.push("Điện thoại");
        devices.forEach(d => answers.push(["entry.1568775449", d]));

        answers.push(["entry.498607222", getRandomElement(["Đang chơi thường xuyên", "Đã chơi nhiều lần"])]);
        const games = getRandomSample(["Teamfight Tactics", "Dota Auto Chess", "Hearthstone Battlegrounds"], Math.floor(Math.random() * 3) + 1);
        if (Math.random() < 0.4) games.push("Auto Chess Mobile");
        games.forEach(g => answers.push(["entry.1246269630", g]));

        answers.push(["entry.1655346710", getRandomElement(["4", "5"])]);
        answers.push(["entry.1392278946", getRandomElement(["4", "5"])]);

        const issues = getRandomSample(["Dung lượng lớn", "Máy yếu khó chạy mượt", "Cập nhật lâu"], Math.floor(Math.random() * 3) + 1);
        issues.forEach(i => answers.push(["entry.1116472983", i]));

        const sysFuncs = getRandomSample(["Đăng ký/đăng nhập", "Ghép trận tự động", "Xem lịch sử trận đấu", "Mời bạn bè"], Math.floor(Math.random() * 3) + 2);
        sysFuncs.forEach(sf => answers.push(["entry.1770047157", sf]));

        const gpFuncs = getRandomSample(["Mua sinh vật/quân cờ", "Làm mới cửa hàng", "Xếp đội hình", "Trang bị vật phẩm", "Kích hoạt tộc/hệ"], Math.floor(Math.random() * 3) + 3);
        gpFuncs.forEach(gf => answers.push(["entry.1432016977", gf]));

        answers.push(["entry.347292542", getRandomElement(["4", "5"])]);

        const stratIssues = getRandomSample(["Không biết ghép vật phẩm", "Không biết đội hình nào mạnh", "Không biết khắc chế đối thủ"], Math.floor(Math.random() * 3) + 1);
        stratIssues.forEach(si => answers.push(["entry.1141135564", si]));

        answers.push(["entry.1002457694", getRandomElement(["4", "5"])]);
        answers.push(["entry.548662296", getRandomElement(["4", "5"])]);

        const aiFuncs = getRandomSample(["Gợi ý đội hình", "Phân tích đội hình hiện tại", "Gợi ý chọn vật phẩm", "Phân tích sau trận đấu"], Math.floor(Math.random() * 3) + 2);
        aiFuncs.forEach(af => answers.push(["entry.1217270139", af]));

        answers.push(["entry.1538998426", getRandomElement(["Gợi ý chi tiết nhưng không tự động chơi thay", "Đưa ra phương án tối ưu càng nhiều càng tốt"])]);
        answers.push(["entry.2074719491", getRandomElement(["3", "4", "5"])]);
        answers.push(["entry.1657998320", getRandomElement(["Miễn phí giới hạn lượt hỏi", "Gói ưu đãi cho sinh viên", "Trả phí theo tháng"])]);

    } else if (profileType === "casual_gamer") {
        answers.push(["entry.177449101", getRandomElement(["Sinh viên ngành khác", "Người chơi game phổ thông"])]);
        answers.push(["entry.390271669", getRandomElement(["1–2 lần/tuần", "Thỉnh thoảng"])]);
        const devices = ["Điện thoại"];
        if (Math.random() < 0.6) devices.push("Laptop");
        devices.forEach(d => answers.push(["entry.1568775449", d]));

        answers.push(["entry.498607222", getRandomElement(["Đã nghe qua", "Đã chơi thử", "Chưa từng biết"])]);
        if (Math.random() < 0.5) answers.push(["entry.1246269630", "Teamfight Tactics"]);
        else answers.push(["entry.1246269630", "Chưa từng chơi"]);

        answers.push(["entry.1655346710", getRandomElement(["3", "4"])]);
        answers.push(["entry.1392278946", getRandomElement(["4", "5"])]);

        const issues = getRandomSample(["Phải tải/cài đặt game", "Luật chơi phức tạp", "Khó biết cách xây dựng đội hình"], Math.floor(Math.random() * 2) + 1);
        issues.forEach(i => answers.push(["entry.1116472983", i]));

        const sysFuncs = getRandomSample(["Chơi thử bằng tài khoản khách", "Tạo phòng riêng", "Mời bạn bè"], Math.floor(Math.random() * 3) + 1);
        sysFuncs.forEach(sf => answers.push(["entry.1770047157", sf]));

        const gpFuncs = getRandomSample(["Mua sinh vật/quân cờ", "Xếp đội hình", "Trang bị vật phẩm"], Math.floor(Math.random() * 3) + 1);
        gpFuncs.forEach(gf => answers.push(["entry.1432016977", gf]));

        answers.push(["entry.347292542", getRandomElement(["4", "5"])]);

        const stratIssues = getRandomSample(["Không hiểu luật chơi", "Không biết nên mua quân nào", "Không biết xếp đội hình"], Math.floor(Math.random() * 2) + 1);
        stratIssues.forEach(si => answers.push(["entry.1141135564", si]));

        answers.push(["entry.1002457694", getRandomElement(["4", "5"])]);
        answers.push(["entry.548662296", getRandomElement(["4", "5"])]);

        const aiFuncs = getRandomSample(["Giải thích luật chơi", "Giải thích sinh vật/vật phẩm", "Gợi ý đội hình"], Math.floor(Math.random() * 3) + 1);
        aiFuncs.forEach(af => answers.push(["entry.1217270139", af]));

        answers.push(["entry.1538998426", getRandomElement(["Gợi ý tham khảo, người chơi tự quyết định", "Chỉ giải thích luật chơi"])]);
        answers.push(["entry.2074719491", getRandomElement(["2", "3", "4"])]);
        answers.push(["entry.1657998320", getRandomElement(["Miễn phí hoàn toàn", "Miễn phí giới hạn lượt hỏi"])]);

    } else { // professional
        answers.push(["entry.177449101", "Người đi làm"]);
        answers.push(["entry.390271669", getRandomElement(["Thỉnh thoảng", "1–2 lần/tuần"])]);
        const devices = getRandomSample(["Laptop", "Điện thoại", "Máy tính bảng"], Math.floor(Math.random() * 2) + 1);
        devices.forEach(d => answers.push(["entry.1568775449", d]));

        answers.push(["entry.498607222", getRandomElement(["Đã nghe qua", "Đã chơi thử", "Chưa từng biết"])]);
        if (Math.random() < 0.4) answers.push(["entry.1246269630", "Teamfight Tactics"]);
        else answers.push(["entry.1246269630", "Chưa từng chơi"]);

        answers.push(["entry.1655346710", getRandomElement(["3", "4"])]);
        answers.push(["entry.1392278946", getRandomElement(["4", "5"])]);

        const issues = getRandomSample(["Phải tải/cài đặt game", "Cập nhật lâu", "Luật chơi phức tạp"], Math.floor(Math.random() * 2) + 1);
        issues.forEach(i => answers.push(["entry.1116472983", i]));

        const sysFuncs = getRandomSample(["Đăng ký/đăng nhập", "Chơi thử bằng tài khoản khách", "Tạo phòng riêng"], Math.floor(Math.random() * 3) + 1);
        sysFuncs.forEach(sf => answers.push(["entry.1770047157", sf]));

        const gpFuncs = getRandomSample(["Mua sinh vật/quân cờ", "Xếp đội hình"], Math.floor(Math.random() * 2) + 1);
        gpFuncs.forEach(gf => answers.push(["entry.1432016977", gf]));

        answers.push(["entry.347292542", getRandomElement(["4", "5"])]);

        const stratIssues = getRandomSample(["Không hiểu luật chơi", "Không gặp khó khăn đáng kể"], Math.floor(Math.random() * 2) + 1);
        stratIssues.forEach(si => answers.push(["entry.1141135564", si]));

        answers.push(["entry.1002457694", getRandomElement(["3", "4"])]);
        answers.push(["entry.548662296", getRandomElement(["3", "4"])]);

        const aiFuncs = getRandomSample(["Giải thích luật chơi", "Gợi ý đội hình"], Math.floor(Math.random() * 2) + 1);
        aiFuncs.forEach(af => answers.push(["entry.1217270139", af]));

        answers.push(["entry.1538998426", "Gợi ý tham khảo, người chơi tự quyết định"]);
        answers.push(["entry.2074719491", getRandomElement(["3", "4"])]);
        answers.push(["entry.1657998320", getRandomElement(["Trả phí theo tháng", "Trả phí theo lượt sử dụng", "Miễn phí hoàn toàn"])]);
    }

    return { profileType, answers };
}

function getFbzx() {
    return new Promise((resolve) => {
        const viewUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfK2wqxguJtEOtwQqeYu5wvCAE4kpIZeR6uQsXffMztMeRRkg/viewform?usp=pp_url";
        https.get(viewUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const match = data.match(/name="fbzx"\s+value="([^"]+)"/);
                resolve(match ? match[1] : null);
            });
        }).on('error', () => {
            resolve(null);
        });
    });
}

async function submitForm(answers) {
    const fbzx = await getFbzx();
    
    const allParams = [...answers];
    allParams.push(["fvv", "1"]);
    allParams.push(["pageHistory", "0,1,2,3,4"]);
    if (fbzx) {
        allParams.push(["fbzx", fbzx]);
    }

    return new Promise((resolve, reject) => {
        const postData = allParams
            .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
            .join('&');

        const parsedUrl = new URL(SUBMIT_URL);

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                const success = data.includes("Câu trả lời của bạn đã được ghi lại") || data.includes("Your response has been recorded");
                resolve(success);
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    // Basic argument parsing
    const args = process.argv.slice(2);
    let num = 10;
    let delay = 1.5;

    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '-n' || args[i] === '--num') && args[i+1]) {
            num = parseInt(args[i+1], 10);
        }
        if ((args[i] === '-d' || args[i] === '--delay') && args[i+1]) {
            delay = parseFloat(args[i+1]);
        }
    }

    console.log("============================================================");
    console.log("      SCRIPT KHẢO SÁT TỰ ĐỘNG GOOGLE FORM (CREATURE CHESS)");
    console.log("============================================================");
    console.log(`[*] Mục tiêu: ${SUBMIT_URL}`);
    console.log(`[*] Số lượng cần gửi: ${num}`);
    console.log(`[*] Thời gian nghỉ: ${delay} giây`);
    console.log("[*] Đang khởi tạo...");
    console.log("------------------------------------------------------------");

    let successCount = 0;
    let failureCount = 0;
    
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const logFilename = `survey_fill_log_${timestamp}.log`;
    const logStream = fs.createWriteStream(logFilename, { flags: 'w', encoding: 'utf8' });

    logStream.write(`--- BẮT ĐẦU KHẢO SÁT LÚC ${new Date().toISOString()} ---\n`);
    logStream.write(`Mục tiêu: ${SUBMIT_URL}\n\n`);

    for (let idx = 1; idx <= num; idx++) {
        const { profileType, answers } = generateResponseByProfile();
        
        const logMsg = `[${idx}/${num}] Đang gửi form với Profile: ${profileType.toUpperCase()}...\n`;
        console.log(logMsg.trim());
        logStream.write(logMsg);

        answers.forEach(([entry_id, val]) => {
            let qName = "Unknown";
            for (const key in FORM_SCHEMA) {
                if (FORM_SCHEMA[key].id === entry_id) {
                    qName = FORM_SCHEMA[key].name;
                    break;
                }
            }
            logStream.write(`   - ${qName} (${entry_id}): ${val}\n`);
        });

        try {
            const success = await submitForm(answers);
            if (success) {
                successCount++;
                const statusStr = `[+] Lần gửi ${idx} THÀNH CÔNG!`;
                console.log(statusStr);
                logStream.write(statusStr + "\n\n");
            } else {
                failureCount++;
                const statusStr = `[-] Lần gửi ${idx} THẤT BẠI (Không tìm thấy dòng xác nhận thành công từ Google)!`;
                console.log(statusStr);
                logStream.write(statusStr + "\n\n");
            }
        } catch (err) {
            failureCount++;
            const statusStr = `[!] Lần gửi ${idx} LỖI: ${err.message}`;
            console.log(statusStr);
            logStream.write(statusStr + "\n\n");
        }

        if (idx < num) {
            await sleep(delay * 1000);
        }
    }

    console.log("------------------------------------------------------------");
    const summaryStr = `Hoàn thành! Thành công: ${successCount}/${num}, Thất bại: ${failureCount}/${num}`;
    console.log(summaryStr);
    console.log(`Chi tiết lịch sử khảo sát đã được ghi lại trong file: ${logFilename}`);
    console.log("============================================================");

    logStream.write(`\n--- KẾT THÚC KHẢO SÁT LÚC ${new Date().toISOString()} ---\n`);
    logStream.write(summaryStr + "\n");
    logStream.end();
}

main().catch(err => {
    console.error("Critical error in main:", err);
});
