# Chiến Thuật Đội Hình - Creature Chess

## Bố Cục Bàn
- Kích thước bàn: 7 cột (x: 0-6) x 3 hàng (y: 0-2) mỗi người chơi
- Hàng 0 = hàng trước (gần địch nhất)
- Hàng 2 = hàng sau (xa địch nhất)
- Số quái tối đa trên bàn phụ thuộc cấp người chơi

## Mẫu Đội Hình

### 1. Tank Hàng Trước
- **Khi nào**: Có tank dũng mãnh/thổ và carry tầm xa
- **Bố trí**: Tank ở hàng 0, carry ở hàng 2
- **Điểm mạnh**: Bảo vệ carry, bắt buộc địch phải đi qua hàng trước
- **Điểm yếu**: Dễ bị sát thủ đánh sau lưng

### 2. Dàn Trải Hàng Sau
- **Khi nào**: Địch có sát thương AoE (đội Lửa)
- **Bố trí**: Tất cả đơn vị dàn trải hàng 2, cách nhau 2 ô
- **Điểm mạnh**: Giảm thiểu sát thương AoE
- **Điểm yếu**: Không có hàng trước bảo vệ

### 3. Chống Nhảy (Chống Sát Thủ)
- **Khi nào**: Địch có quái xảo quyệt/sát thủ
- **Bố trí**: Carry ở góc (0,2 hoặc 6,2), tank bao quanh carry
- **Điểm mạnh**: Sát thủ khó tiếp cận carry
- **Điểm yếu**: Sát thương giảm do bố trí phòng thủ

### 4. Tập Trung Góc
- **Khi nào**: Muốn dồn sát thương vào 1 khu vực
- **Bố trí**: Tất cả đơn vị góc trái trên (x: 0-2, y: 0-1)
- **Điểm mạnh**: Đơn vị hỗ trợ lẫn nhau, hỏa lực tập trung
- **Điểm yếu**: Dễ bị AoE, địch dàn trải

### 5. Bảo Vệ Trái/Phải
- **Khi nào**: Có 1 carry mạnh cần sống sót
- **Bố trí**: Carry 1 bên, tank phía trước và cạnh bên
- **Điểm mạnh**: Bảo vệ tối đa cho đơn vị then chốt
- **Điểm yếu**: 1 bên bàn trống

### 6. Sát Thủ Đánh Sau
- **Khi nào**: Có quái xảo quyệt nhanh
- **Bố trí**: Sát thủ ở cạnh (x: 0 và x: 6), còn lại ở giữa
- **Điểm mạnh**: Sát thủ vượt qua hàng trước để lao vào carry địch
- **Điểm yếu**: Sát thủ có thể chết nhanh nếu không có hỗ trợ

## Mẹo Vị Trí

### Quy Tắc Chung
1. **Luôn bảo vệ carry** — Đặt DPS cao nhất sau tank
2. **Tank đi trước** — Quái dũng mãnh luôn ở hàng 0
3. **Tầm xa sau cận chiến** — Huyền bí (tầm 2) ở hàng 1-2
4. **Dàn trải vs AoE** — Nếu địch có Lửa/Thổ AoE, đừng tụ bóng
5. **Carry góc vs sát thủ** — Nếu địch có xảo quyệt nhanh, dùng góc

### Khi Nào Đổi Vị Trí
- Sau khi xem bàn địch ở màn hình xem trước
- Khi địch thay đổi đội hình
- Khi thêm/bớt quái trên bàn
- Giữa các vòng để khắc chế những gì bạn thấy
