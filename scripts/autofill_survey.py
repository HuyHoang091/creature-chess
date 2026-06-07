#!/usr/bin/env python
# -*- coding: utf-8 -*-

import urllib.request
import urllib.parse
import random
import time
import argparse
import sys
from datetime import datetime

# URL gửi response của Google Form
SUBMIT_URL = "https://docs.google.com/forms/u/0/d/e/1FAIpQLSfK2wqxguJtEOtwQqeYu5wvCAE4kpIZeR6uQsXffMztMeRRkg/formResponse"

# Khai báo các câu hỏi và các lựa chọn tương ứng từ Google Form
# entry_id: ID của trường dữ liệu trong form HTML
FORM_SCHEMA = {
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
        "is_checkbox": True
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
        "is_checkbox": True
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
        "is_checkbox": True
    },
    "chuc_nang_he_thong": {
        "id": "entry.1770047157",
        "name": "Các chức năng nào bạn cho là cần có trong một game online nhiều người chơi?",
        "options": ["Đăng ký/đăng nhập", "Chơi thử bằng tài khoản khách", "Ghép trận tự động", "Tạo phòng riêng", "Mời bạn bè", "Xem lịch sử trận đấu", "Thống kê cá nhân", "Báo cáo người chơi vi phạm"],
        "is_checkbox": True
    },
    "chuc_nang_gameplay": {
        "id": "entry.1432016977",
        "name": "Các chức năng gameplay nào bạn thấy quan trọng trong game auto-battler?",
        "options": ["Mua sinh vật/quân cờ", "Làm mới cửa hàng", "Mua kinh nghiệm/tăng cấp", "Xếp đội hình", "Trang bị vật phẩm", "Chế tạo vật phẩm", "Kích hoạt tộc/hệ", "Xem đội hình đối thủ", "Khóa cửa hàng"],
        "is_checkbox": True
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
        "is_checkbox": True
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
        "is_checkbox": True
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
}

# Các Profile giả lập hành vi người dùng để sinh số liệu khảo sát một cách thực tế
def generate_response_by_profile():
    profile_type = random.choices(["it_student", "casual_gamer", "professional"], weights=[45, 35, 20], k=1)[0]
    
    answers = []
    
    if profile_type == "it_student":
        # 1. Đối tượng
        answers.append(("entry.177449101", random.choice(["Sinh viên CNTT", "Người đi làm"])))
        # 2. Tần suất
        answers.append(("entry.390271669", random.choice(["Gần như hằng ngày", "3–5 lần/tuần"])))
        # 3. Thiết bị (Checkbox)
        devices = random.sample(["Máy tính để bàn", "Laptop"], random.randint(1, 2))
        if random.random() < 0.3:
            devices.append("Điện thoại")
        for d in devices:
            answers.append(("entry.1568775449", d))
        # 5. Biết auto-battler
        answers.append(("entry.498607222", random.choice(["Đang chơi thường xuyên", "Đã chơi nhiều lần"])))
        # 6. Biết game nào (Checkbox)
        games = random.sample(["Teamfight Tactics", "Dota Auto Chess", "Hearthstone Battlegrounds"], random.randint(1, 3))
        if random.random() < 0.4:
            games.append("Auto Chess Mobile")
        for g in games:
            answers.append(("entry.1246269630", g))
        # 7. Hứng thú browser (1-5)
        answers.append(("entry.1655346710", random.choice(["4", "5"])))
        # 8. Quan trọng no-install (1-5)
        answers.append(("entry.1392278946", random.choice(["4", "5"])))
        # 9. Khó khăn game hiện tại (Checkbox)
        issues = random.sample(["Dung lượng lớn", "Máy yếu khó chạy mượt", "Cập nhật lâu"], random.randint(1, 3))
        for i in issues:
            answers.append(("entry.1116472983", i))
        # 11. Chức năng hệ thống (Checkbox)
        sys_funcs = random.sample(["Đăng ký/đăng nhập", "Ghép trận tự động", "Xem lịch sử trận đấu", "Mời bạn bè"], random.randint(2, 4))
        for sf in sys_funcs:
            answers.append(("entry.1770047157", sf))
        # 12. Chức năng gameplay (Checkbox)
        gp_funcs = random.sample(["Mua sinh vật/quân cờ", "Làm mới cửa hàng", "Xếp đội hình", "Trang bị vật phẩm", "Kích hoạt tộc/hệ"], random.randint(3, 5))
        for gf in gp_funcs:
            answers.append(("entry.1432016977", gf))
        # 13. Chơi thử ko reg
        answers.append(("entry.347292542", random.choice(["4", "5"])))
        # 15. Khó khăn game chiến thuật (Checkbox)
        strat_issues = random.sample(["Không biết ghép vật phẩm", "Không biết đội hình nào mạnh", "Không biết khắc chế đối thủ"], random.randint(1, 3))
        for si in strat_issues:
            answers.append(("entry.1141135564", si))
        # 16. Cần HD trong game
        answers.append(("entry.1002457694", random.choice(["4", "5"])))
        # 17. Muốn AI Coach
        answers.append(("entry.548662296", random.choice(["4", "5"])))
        # 18. AI hỗ trợ gì (Checkbox)
        ai_funcs = random.sample(["Gợi ý đội hình", "Phân tích đội hình hiện tại", "Gợi ý chọn vật phẩm", "Phân tích sau trận đấu"], random.randint(2, 4))
        for af in ai_funcs:
            answers.append(("entry.1217270139", af))
        # 19. Vai trò AI Coach
        answers.append(("entry.1538998426", random.choice(["Gợi ý chi tiết nhưng không tự động chơi thay", "Đưa ra phương án tối ưu càng nhiều càng tốt"])))
        # 21. Chấp nhận trả phí AI (1-5)
        answers.append(("entry.2074719491", random.choice(["3", "4", "5"])))
        # 22. Hình thức thu phí
        answers.append(("entry.1657998320", random.choice(["Miễn phí giới hạn lượt hỏi", "Gói ưu đãi cho sinh viên", "Trả phí theo tháng"])))
        
    elif profile_type == "casual_gamer":
        # 1. Đối tượng
        answers.append(("entry.177449101", random.choice(["Sinh viên ngành khác", "Người chơi game phổ thông"])))
        # 2. Tần suất
        answers.append(("entry.390271669", random.choice(["1–2 lần/tuần", "Thỉnh thoảng"])))
        # 3. Thiết bị (Checkbox)
        devices = ["Điện thoại"]
        if random.random() < 0.6:
            devices.append("Laptop")
        for d in devices:
            answers.append(("entry.1568775449", d))
        # 5. Biết auto-battler
        answers.append(("entry.498607222", random.choice(["Đã nghe qua", "Đã chơi thử", "Chưa từng biết"])))
        # 6. Biết game nào (Checkbox)
        if random.random() < 0.5:
            answers.append(("entry.1246269630", "Teamfight Tactics"))
        else:
            answers.append(("entry.1246269630", "Chưa từng chơi"))
        # 7. Hứng thú browser (1-5)
        answers.append(("entry.1655346710", random.choice(["3", "4"])))
        # 8. Quan trọng no-install (1-5)
        answers.append(("entry.1392278946", random.choice(["4", "5"])))
        # 9. Khó khăn game hiện tại (Checkbox)
        issues = random.sample(["Phải tải/cài đặt game", "Luật chơi phức tạp", "Khó biết cách xây dựng đội hình"], random.randint(1, 2))
        for i in issues:
            answers.append(("entry.1116472983", i))
        # 11. Chức năng hệ thống (Checkbox)
        sys_funcs = random.sample(["Chơi thử bằng tài khoản khách", "Tạo phòng riêng", "Mời bạn bè"], random.randint(1, 3))
        for sf in sys_funcs:
            answers.append(("entry.1770047157", sf))
        # 12. Chức năng gameplay (Checkbox)
        gp_funcs = random.sample(["Mua sinh vật/quân cờ", "Xếp đội hình", "Trang bị vật phẩm"], random.randint(1, 3))
        for gf in gp_funcs:
            answers.append(("entry.1432016977", gf))
        # 13. Chơi thử ko reg
        answers.append(("entry.347292542", random.choice(["4", "5"])))
        # 15. Khó khăn game chiến thuật (Checkbox)
        strat_issues = random.sample(["Không hiểu luật chơi", "Không biết nên mua quân nào", "Không biết xếp đội hình"], random.randint(1, 2))
        for si in strat_issues:
            answers.append(("entry.1141135564", si))
        # 16. Cần HD trong game
        answers.append(("entry.1002457694", random.choice(["4", "5"])))
        # 17. Muốn AI Coach
        answers.append(("entry.548662296", random.choice(["4", "5"])))
        # 18. AI hỗ trợ gì (Checkbox)
        ai_funcs = random.sample(["Giải thích luật chơi", "Giải thích sinh vật/vật phẩm", "Gợi ý đội hình"], random.randint(1, 3))
        for af in ai_funcs:
            answers.append(("entry.1217270139", af))
        # 19. Vai trò AI Coach
        answers.append(("entry.1538998426", random.choice(["Gợi ý tham khảo, người chơi tự quyết định", "Chỉ giải thích luật chơi"])))
        # 21. Chấp nhận trả phí AI (1-5)
        answers.append(("entry.2074719491", random.choice(["2", "3", "4"])))
        # 22. Hình thức thu phí
        answers.append(("entry.1657998320", random.choice(["Miễn phí hoàn toàn", "Miễn phí giới hạn lượt hỏi"])))
        
    else: # professional
        # 1. Đối tượng
        answers.append(("entry.177449101", "Người đi làm"))
        # 2. Tần suất
        answers.append(("entry.390271669", random.choice(["Thỉnh thoảng", "1–2 lần/tuần"])))
        # 3. Thiết bị (Checkbox)
        devices = random.sample(["Laptop", "Điện thoại", "Máy tính bảng"], random.randint(1, 2))
        for d in devices:
            answers.append(("entry.1568775449", d))
        # 5. Biết auto-battler
        answers.append(("entry.498607222", random.choice(["Đã nghe qua", "Đã chơi thử", "Chưa từng biết"])))
        # 6. Biết game nào (Checkbox)
        if random.random() < 0.4:
            answers.append(("entry.1246269630", "Teamfight Tactics"))
        else:
            answers.append(("entry.1246269630", "Chưa từng chơi"))
        # 7. Hứng thú browser (1-5)
        answers.append(("entry.1655346710", random.choice(["3", "4"])))
        # 8. Quan trọng no-install (1-5)
        answers.append(("entry.1392278946", random.choice(["4", "5"])))
        # 9. Khó khăn game hiện tại (Checkbox)
        issues = random.sample(["Phải tải/cài đặt game", "Cập nhật lâu", "Luật chơi phức tạp"], random.randint(1, 2))
        for i in issues:
            answers.append(("entry.1116472983", i))
        # 11. Chức năng hệ thống (Checkbox)
        sys_funcs = random.sample(["Đăng ký/đăng nhập", "Chơi thử bằng tài khoản khách", "Tạo phòng riêng"], random.randint(1, 3))
        for sf in sys_funcs:
            answers.append(("entry.1770047157", sf))
        # 12. Chức năng gameplay (Checkbox)
        gp_funcs = random.sample(["Mua sinh vật/quân cờ", "Xếp đội hình"], random.randint(1, 2))
        for gf in gp_funcs:
            answers.append(("entry.1432016977", gf))
        # 13. Chơi thử ko reg
        answers.append(("entry.347292542", random.choice(["4", "5"])))
        # 15. Khó khăn game chiến thuật (Checkbox)
        strat_issues = random.sample(["Không hiểu luật chơi", "Không gặp khó khăn đáng kể"], random.randint(1, 2))
        for si in strat_issues:
            answers.append(("entry.1141135564", si))
        # 16. Cần HD trong game
        answers.append(("entry.1002457694", random.choice(["3", "4"])))
        # 17. Muốn AI Coach
        answers.append(("entry.548662296", random.choice(["3", "4"])))
        # 18. AI hỗ trợ gì (Checkbox)
        ai_funcs = random.sample(["Giải thích luật chơi", "Gợi ý đội hình"], random.randint(1, 2))
        for af in ai_funcs:
            answers.append(("entry.1217270139", af))
        # 19. Vai trò AI Coach
        answers.append(("entry.1538998426", "Gợi ý tham khảo, người chơi tự quyết định"))
        # 21. Chấp nhận trả phí AI (1-5)
        answers.append(("entry.2074719491", random.choice(["3", "4"])))
        # 22. Hình thức thu phí
        answers.append(("entry.1657998320", random.choice(["Trả phí theo tháng", "Trả phí theo lượt sử dụng", "Miễn phí hoàn toàn"])))
        
    return profile_type, answers

def get_fbzx():
    import re
    view_url = "https://docs.google.com/forms/d/e/1FAIpQLSfK2wqxguJtEOtwQqeYu5wvCAE4kpIZeR6uQsXffMztMeRRkg/viewform?usp=pp_url"
    req = urllib.request.Request(
        view_url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')
            fbzx_match = re.search(r'name="fbzx"\s+value="([^"]+)"', html)
            if fbzx_match:
                return fbzx_match.group(1)
    except Exception as e:
        print(f"  [!] Lỗi khi lấy token fbzx: {e}")
    return None

def submit_form(answers):
    # Lấy fbzx dynamically
    fbzx = get_fbzx()
    
    # Tạo danh sách các tham số POST bao gồm cả pageHistory và fvv
    post_params = list(answers) # Copy answers list
    post_params.append(("fvv", "1"))
    post_params.append(("pageHistory", "0,1,2,3,4"))
    if fbzx:
        post_params.append(("fbzx", fbzx))
        
    # Encode dữ liệu để POST
    encoded_data = urllib.parse.urlencode(post_params).encode("utf-8")
    
    # Tạo request với User-Agent giả lập
    req = urllib.request.Request(
        SUBMIT_URL,
        data=encoded_data,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    )
    
    # Gửi request
    with urllib.request.urlopen(req, timeout=10) as response:
        html = response.read().decode("utf-8")
        
    # Kiểm tra xem phản hồi có chứa từ xác nhận đã gửi thành công không
    success = "Câu trả lời của bạn đã được ghi lại" in html or "Your response has been recorded" in html
    return success

def main():
    # Cấu hình stdout hiển thị tốt tiếng Việt
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Script tự động khảo sát ý kiến Google Forms.")
    parser.add_argument("-n", "--num", type=int, default=10, help="Số lượng form cần gửi (mặc định: 10)")
    parser.add_argument("-d", "--delay", type=float, default=1.5, help="Khoảng thời gian nghỉ giữa các lần gửi tính bằng giây (mặc định: 1.5)")
    args = parser.parse_args()

    print("=" * 60)
    print("      SCRIPT KHẢO SÁT TỰ ĐỘNG GOOGLE FORM (CREATURE CHESS)")
    print("=" * 60)
    print(f"[*] Mục tiêu: {SUBMIT_URL}")
    print(f"[*] Số lượng cần gửi: {args.num}")
    print(f"[*] Thời gian nghỉ: {args.delay} giây")
    print("[*] Đang khởi tạo...")
    print("-" * 60)

    success_count = 0
    failure_count = 0
    
    log_filename = f"survey_fill_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

    with open(log_filename, "w", encoding="utf-8") as log_file:
        log_file.write(f"--- BẮT ĐẦU KHẢO SÁT LÚC {datetime.now()} ---\n")
        log_file.write(f"Mục tiêu: {SUBMIT_URL}\n\n")

        for idx in range(1, args.num + 1):
            profile, answers = generate_response_by_profile()
            
            # Ghi lại thông tin log cho lần gửi này
            log_msg = f"[{idx}/{args.num}] Đang gửi form với Profile: {profile.upper()}...\n"
            print(log_msg.strip())
            log_file.write(log_msg)
            
            # In chi tiết các câu trả lời ra log file
            for entry_id, val in answers:
                # Tìm tên câu hỏi tương ứng trong schema
                q_name = "Unknown"
                for q_key, q_info in FORM_SCHEMA.items():
                    if q_info["id"] == entry_id:
                        q_name = q_info["name"]
                        break
                log_file.write(f"   - {q_name} ({entry_id}): {val}\n")
                
            try:
                # Gửi form
                success = submit_form(answers)
                if success:
                    success_count += 1
                    status_str = f"[+] Lần gửi {idx} THÀNH CÔNG!"
                    print(status_str)
                    log_file.write(status_str + "\n\n")
                else:
                    failure_count += 1
                    status_str = f"[-] Lần gửi {idx} THẤT BẠI (Không tìm thấy dòng xác nhận thành công từ Google)!"
                    print(status_str)
                    log_file.write(status_str + "\n\n")
                    
            except Exception as e:
                failure_count += 1
                status_str = f"[!] Lần gửi {idx} LỖI: {e}"
                print(status_str)
                log_file.write(status_str + "\n\n")
            
            # Nghỉ giữa các lần gửi để tránh spam blocker của Google
            if idx < args.num:
                time.sleep(args.delay)

        print("-" * 60)
        summary_str = f"Hoàn thành! Thành công: {success_count}/{args.num}, Thất bại: {failure_count}/{args.num}"
        print(summary_str)
        print(f"Chi tiết lịch sử khảo sát đã được ghi lại trong file: {log_filename}")
        print("=" * 60)
        log_file.write(f"\n--- KẾT THÚC KHẢO SÁT LÚC {datetime.now()} ---\n")
        log_file.write(summary_str + "\n")

if __name__ == "__main__":
    main()
