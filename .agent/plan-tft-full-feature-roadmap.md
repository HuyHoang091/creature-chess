# TFT Full Feature Roadmap

## 1. Muc tieu

Hoan thien project tu mot game chi co gameplay thanh mot san pham TFT co day du vong doi nguoi dung:

- Dang nhap, dang ky, guest mode
- Ho so nguoi choi
- Trang chu va menu day du
- Party, moi ban, ket ban
- Lobby rieng, lobby cong khai, matchmaking
- Social/chat/co-presence
- Hau game, lich su tran, tien trinh tai khoan
- Cong cu van hanh va moderation co ban

Plan nay dua tren hien trang code:

- Frontend da co `MenuPage`, `LobbyPage`, `GamePage`, `LoginPage`, `RegistrationPage`.
- `AppRouter` hien chi co 3 state: menu, lobby, game.
- `server-game` hien dang matchmaking tu dong vao lobby mo, du nguoi thi vao game.
- `server-info` moi co guest session, current user, cap nhat profile dang ky lan dau.
- Prisma schema moi co `users`, `guests`, `bots`, chua co bang social/party/match-history.

## 2. Danh gia hien trang

### Da co

- Gameplay core, battle, lobby settings co ban, socket handshake.
- Guest session API.
- Auth hook/co so cho Auth0.
- Form login va registration giao dien co san.
- Redux store va socket service cho game/lobby.

### Chua du cho mot game TFT hoan chinh

- Khong co home hub/sanh dung nghia san pham.
- Khong co friend system.
- Khong co party/invite.
- Khong co custom lobby/private room.
- Khong co ranked/casual queue tach biet.
- Khong co persistent profile progression va lich su tran.
- Khong co end-of-match UX day du.
- Khong co social presence, notifications, block/report, moderation workflow.
- Khong co admin/ops view cho online players, lobbies, invite abuse, friend abuse.

## 3. Pham vi tinh nang can bo sung

### P0 - Foundation de game dung duoc nhu mot san pham

1. Xac thuc va tai khoan
- Guest mode giu lai.
- Dang nhap/dang ky that su qua Auth0 hoac provider khac.
- Link guest account vao account that sau khi dang nhap.
- Session refresh, logout, unauthorized handling.

2. Home hub / Main menu
- Trang chu sau login: Play, Party, Friends, Profile, History, Settings.
- Hien user card, currency placeholder, rank placeholder, online status.
- Tach `MenuPage` hien tai thanh landing/login va home hub sau xac thuc.

3. Matchmaking co cau truc
- Casual queue.
- Ranked queue placeholder.
- Bot fill policy cau hinh duoc.
- Queue state ro rang: searching, estimated wait, cancel queue, reconnect queue.

4. Lobby/room day du
- Private lobby co room code.
- Public lobby do party lead tao.
- Owner/leader controls: start, invite, kick, chuyen setting.
- Ready state tung thanh vien.

5. Hau game
- Match result screen.
- XP/account progression placeholder.
- Damage chart, placement, rewards.
- Play again, return to lobby, add friend sau tran.

### P1 - Social loop can co cho TFT

6. Friend system
- Tim kiem nguoi choi theo nickname/ID.
- Gui/nhan/tu choi/thu hoi loi moi ket ban.
- Danh sach ban be, online/offline/in-game status.
- Xoa ban, block user.

7. Party system
- Tao party 2-8 nguoi.
- Moi ban vao party tu friend list.
- Join/decline invite.
- Party chat co ban.
- Party leader queue cho ca nhom.

8. Social notifications
- Toast/inbox cho friend request, party invite, lobby invite, match found.
- Notification center luu cac su kien chua doc.

9. Presence va chat
- Presence service: online, in menu, in lobby, in game, away.
- Chat pham vi: party, lobby, in-game quick chat, direct message placeholder.

### P2 - Retention, van hanh, an toan

10. Profile va progression
- Profile page.
- Match history.
- Basic stats: top 1, top 4, average placement, total games.
- Avatar/title tu dong bo sung sau.

11. Moderation va safety
- Report player.
- Block list.
- Rate limit friend invites, party invites, chat spam.
- Audit log cac action social quan trong.

12. Live ops / admin tools
- Dashboard noi bo: online players, active lobbies, active games.
- Force close lobby, mute player, xem invite abuse.

## 4. Thiet ke san pham de xay dung

### User flow muc tieu

1. User vao game.
2. Neu chua co account: choi guest hoac dang nhap.
3. Sau login: vao Home.
4. User co the:
- Queue solo.
- Tao party va moi ban.
- Tao custom room.
- Mo friend list, chap nhan loi moi.
- Xem profile/history.
5. Khi match xong:
- Xem result.
- Chon play again, ve party, them ban, report.

### Man hinh can co

- Landing/Login
- Registration / Complete profile
- Home hub
- Friends panel
- Party panel
- Invite modal
- Matchmaking state modal
- Custom lobby room
- Existing game lobby refined
- Match result page
- Profile page
- Match history page
- Settings page

## 5. Thay doi du lieu va backend

### Database schema moi de them

1. User social
- `friendships`
- `friend_requests`
- `blocks`
- `party_members`
- `party_invites`
- `notifications`

2. Match va progression
- `matches`
- `match_participants`
- `player_stats_snapshot`
- `rank_progression` hoac `season_stats`

3. Lobby/room
- `lobbies` hoac luu ephemeral trong memory + Redis
- `lobby_invites`
- `queue_entries`

### Nguyen tac modeling

- Friend relationship la undirected, request la directed.
- Party/lobby state nen de realtime memory + Redis; DB chi luu invite/audit neu can.
- Match result va player stats phai persist sau moi tran.
- Guest account can co luong merge vao `users`.

### API/Service can them trong `server-info`

- `POST /auth/guest/upgrade`
- `GET /friends`
- `POST /friends/request`
- `POST /friends/request/:id/accept`
- `POST /friends/request/:id/decline`
- `DELETE /friends/:id`
- `POST /block/:id`
- `DELETE /block/:id`
- `GET /profile/:id`
- `GET /matches/history`
- `GET /notifications`
- `POST /notifications/:id/read`

### Realtime/event can them trong `server-game` hoac service moi

- Party invite events
- Friend presence updates
- Lobby invite events
- Queue status updates
- Match found accept/decline flow neu muon matchmaking chat che
- Notification push events

## 6. Thay doi frontend

### Kien truc route/state

Can doi `AppRouter` tu state-based minimal sang app shell co route/man hinh ro rang:

- `/` landing
- `/home`
- `/party`
- `/lobby/:code`
- `/match/:id` hoac state game
- `/profile`
- `/history`
- `/settings`

Neu chua muon dua react-router, van co the dung state machine trung tam, nhung ve trung han nen chuyen sang router that su.

### Store slices can them

- `auth`
- `profile`
- `friends`
- `party`
- `notifications`
- `presence`
- `matchHistory`
- `matchmaking`

### UI component can them

- Friend list item
- Invite modal
- Party roster
- Queue status card
- Result scoreboard
- Notification tray
- Social sidebar
- Empty/loading/error states cho moi social page

## 7. Kien truc he thong de xuat

### Phuong an thuc dung cho repo hien tai

1. Giu `server-game` cho real-time game/lobby flow.
2. Mo rong `server-info` thanh social/profile API.
3. Them mot lop realtime social nho:
- Cach A: dung chung socket namespace trong `server-game`.
- Cach B: tach `server-social`.

De giam rui ro, nen bat dau bang Cach A:

- cung auth/session
- cung socket handshake
- it chi phi van hanh

### Can bo sung shared modules

- `@creature-chess/social-models`
- `@creature-chess/profile-models`
- bo packet definitions cho party/friend/invite/presence

## 8. Roadmap trien khai de xuat

### Phase 1 - Product foundation

Muc tieu: nguoi choi vao duoc game, co home screen, co profile, co queue ro rang.

Cong viec:
- Hoan thien auth flow login/logout/guest.
- Them home hub.
- Tach landing va home.
- Chuan hoa `current user` bootstrap.
- Refactor matchmaking state tren client.
- Them result screen sau tran.

Deliverable:
- Solo player co the dang nhap, vao home, queue tran, xem ket qua, quay lai home.

### Phase 2 - Party va lobby

Muc tieu: choi cung ban theo luong TFT co ban.

Cong viec:
- DB schema party/invite.
- Party service + socket events.
- Private lobby room code.
- Leader controls.
- Join/leave/invite/kick.
- Party queue.

Deliverable:
- 2-8 nguoi vao party, leader queue chung, vao lobby/game cung nhau.

### Phase 3 - Friend system

Muc tieu: tao social graph va retention loop.

Cong viec:
- Friend request flow.
- Friend list UI.
- Presence updates.
- Invite tu friend list.
- Block flow co ban.

Deliverable:
- User ket ban, thay trang thai, moi vao party/lobby.

### Phase 4 - Progression va history

Muc tieu: game co ly do quay lai.

Cong viec:
- Persist match results.
- Profile stats.
- Match history page.
- Rank/season placeholder.
- Post-match rewards/XP.

Deliverable:
- User co profile, lich su va so lieu sau nhieu tran.

### Phase 5 - Safety va ops

Muc tieu: he thong chiu duoc su dung that.

Cong viec:
- Rate limit invite/chat.
- Report/block.
- Admin dashboard toi thieu.
- Audit log cac action social.

Deliverable:
- Giam spam, de quan tri va debug production.

## 9. Thu tu ky thuat chi tiet nen lam

1. Chuan hoa model user va bootstrap auth tren frontend.
2. Refactor menu thanh `landing + authenticated home`.
3. Them slice `matchmaking`, `party`, `friends`, `notifications`.
4. Mo rong Prisma schema cho social + match history.
5. Tao REST API cho social/profile/history.
6. Mo rong socket protocol cho party/lobby/presence.
7. Refactor `Lobby` tren server tu auto-fill don gian thanh:
- public queue lobby
- private custom lobby
- party-owned lobby
8. Them result persistence va result screen.
9. Them moderation/rate limit/admin hooks.

## 10. Rui ro va luu y

- `server-game` hien dang gom ca matchmaking va game runtime, neu nhan them social logic se nhanh to. Can tach ro package/service layer du code chua tach service.
- Guest ID dang ngan va tam thoi, khong nen dung lam dinh danh social dai han.
- Schema user hien chua co email/public id/display discriminator phuc vu search va privacy.
- `AppRouter` hien rat don gian; neu tiep tuc nhan them state se nhanh kho bao tri.
- Cac flow social can auth that su; guest khong nen co day du quyen friend/party persistent.

## 11. De xuat pham vi phien ban dau tien nen build

Neu muon ra mot ban "day du co the choi va giu nguoi" nhanh nhat, nen chot MVP nhu sau:

- Login + guest
- Home hub
- Solo queue
- Party invite
- Private/public lobby
- Friend list + friend request
- Presence online/in-game
- Match result
- Match history co ban

Khong nen lam ngay trong MVP:

- Ranked MMR day du
- Direct message full
- Guild/clan
- Reward economy phuc tap
- Admin dashboard day du

## 12. De xuat file/task breakdown tiep theo

Sau plan tong quan nay, nen tao them 4 plan con:

1. `plan-auth-and-home-hub.md`
2. `plan-party-and-lobby-social.md`
3. `plan-friend-and-presence.md`
4. `plan-match-history-and-progression.md`

Muc dich:
- de chia sprint
- de map task backend/frontend/schema
- de lam theo thu tu it rui ro nhat
