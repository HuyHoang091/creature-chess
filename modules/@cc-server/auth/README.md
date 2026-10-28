# @cc-server/auth

Module xác thực và quản lý phiên đăng nhập (Authentication & Session Handling) cho hệ thống Creature Chess.

---

## Chức năng chính

- **Xác thực phiên khách (Guest Session)**: Cho phép người chơi trải nghiệm game ngay lập tức mà không cần tạo tài khoản trước, tự động cấp mã định danh duy nhất (UUID).
- **Tích hợp Auth0**: Hỗ trợ đăng nhập Single Sign-On (SSO) an toàn qua giao thức JWT.
- **Quản lý Token**: Mã hóa và xác thực token truy cập giữa client và các backend services (`server-game`, `server-info`).

---

## Sử dụng

Module được sử dụng nội bộ bởi các package server trong Monorepo:

```typescript
import { verifySession, createGuestToken } from "@cc-server/auth";

// Tạo phiên chơi khách
const guestSession = await createGuestToken();

// Xác thực token gửi lên từ client
const user = await verifySession(token);
```
