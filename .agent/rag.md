# Phân tích: Vấn đề của RAG hiện tại & Kế hoạch nâng cấp
Vấn đề cốt lõi: Tài liệu viết tay ≠ Sự thật game
RAG hiện tại hoạt động trên 7 file markdown viết tay (builds.md, counters.md, formations.md, etc.) — đây là ý kiến chủ quan, không phải dữ liệu kiểm chứng. Ví dụ:

builds.md nói "Agnigon is best carry" — nhưng chưa ai chạy 10,000 trận để chứng minh Agnigon thắng nhiều hơn AV8R hay Kirkanon
counters.md nói "Water counter Fire" — typeRelations code cho thấy overcomeBy bonus là 1.7x, nhưng liệu có đủ bù cho sự chênh lệch stat/synergy/items không? Chưa biết
items.md nói "Infinity Edge best on carry" — nhưng Bloodthirster + lifesteal có thể tốt hơn trong meta sustain. Chưa có data
formations.md mô tả 6 formations — nhưng chưa có benchmark nào so sánh Tank Front vs Spread Backline trên các matchups cụ thể
Nguồn sự thật thực sự đã có trong codebase
Game đã có đầy đủ combat engine deterministic:

Thành phần	File	Công thức
Damage	getHitDamage.ts	ceil((ATK/DEF) * typeBonus * 8)
Type bonus	typeRelations.ts	Overcome=1.7x, Generated=0.3x
Stats	definitionClass.ts	baseStat + ceil(build * cost * modifier * 20/80/210)
Cooldown	getCooldownForSpeed.ts	ceil((180-speed)/24)
Skill damage	skill.ts	ceil((ATK/DEF) * 8 * SKILL_MULTIPLIER)
Synergies	elementSynergyBalance.ts	Fire=ATK%, Water=mana, Earth=DEF%, etc.
Pool	cardDeck.ts	Cost 1=29 copies, 2=22, 3=18, 4=10, 5=9
Roll odds	cardDeck.ts	CARD_COST_CHANCES[cost-1][level-1]
Tất cả đều có thể tính toán chính xác — không cần đoán.

Kế hoạch nâng cấp: Data-Driven RAG
Thay vì RAG dựa trên markdown viết tay → RAG dựa trên data tính toán từ engine thật.

Phase 1: Auto-generate knowledge base từ game engine
Viết script tính toán tất cả stats, matchups, DPS từ source code rồi sinh ra markdown chính xác:

auto-creature-stats.md — Bảng stats thực (HP/ATK/DEF/SPD) của tất cả 47 creatures ở 3 stages, tính từ definitionClass.ts
auto-dps-ranking.md — DPS thực = damage_per_hit / cooldown, ranking theo cost và stage
auto-matchup-matrix.md — Ma trận matchup 1v1 (ATK/DEF/typeBonus) giữa mọi cặp creatures
auto-synergy-breakpoints.md — Synergy bonus thực ở từng tier, với ảnh hưởng % lên stats
auto-item-efficiency.md — Item efficiency thực: stat gain / slot cho từng role
auto-roll-odds.md — Bảng xác suất roll chính xác theo level
Phase 2: Battle simulation data
Chạy battle simulator headless cho N trận để có win-rate thực giữa các team comps → feed vào RAG.

Phase 3: Thay thế markdown viết tay
Game guides hiện tại giữ làm "editorial opinion", nhưng RAG ưu tiên retrieval từ auto-generated data.


# Chi tiết kế hoạch: Data-Driven RAG
Phase 1: Auto-generate Knowledge Base
1A. auto-creature-stats.md — Bảng stats thực
Script sẽ replicate công thức từ definitionClass.ts và tính stats cho tất cả 47 creatures × 3 stages:

python
## Công thức từ source code:
## points = cost * 1.5 * [20, 80, 210][stage]
## stat = baseStat(10) + ceil(build_ratio * points)
## hp = stat * 5

## Ví dụ output cho Agnigon (cost 5, fire+valiant):
## valiant build: hp=0.4, atk=0.2, def=0.3, spd=0.2
Output mẫu:

Creature	Cost	Traits	Stage	HP	ATK	DEF	SPD	Attack Type	Skill
Agnigon	5	fire,valiant	★	350	40	55	40	melee	Flame Burst (AoE, 100 mana)
Agnigon	5	fire,valiant	★★	1250	130	190	130	melee	Flame Burst
Agnigon	5	fire,valiant	★★★	3200	325	483	325	melee	Flame Burst
AV8R	5	metal,cunning	★	285	130	25	148	melee	Laser Beam (line, 80 mana)
Kirkanon	5	metal,arcane	★	350	70	40	55	ranged(2)	Fatal Thrust (single, 60 mana)
→ Giá trị: LLM biết chính xác "Agnigon ★★ có 1250 HP, 130 ATK" thay vì đoán "Agnigon is tanky + high damage"

1B. auto-dps-ranking.md — DPS thực tế
python
## DPS = damage_per_hit / (cooldown_turns * turn_duration)
## cooldown = ceil((180 - speed) / 24)
## damage_vs_average = ceil((ATK / avg_DEF) * 8)
Output mẫu:

Rank	Creature	Cost	Stage	ATK	SPD	Cooldown	DMG/hit (vs avg DEF)	Effective DPS	Role
1	AV8R ★★	5	★★	490	530	0 turns	~78	highest	cunning assassin
2	Cardinale ★★	5	★★	490	530	0 turns	~78	highest	cunning assassin
3	Kirkanon ★★	5	★★	250	190	0 turns	~40	high (ranged)	arcane carry
...
→ Giá trị: Biết chính xác DPS ranking, không đoán "AV8R is fast"

1C. auto-matchup-matrix.md — Ma trận 1v1
python
## Tính damage A→B và B→A cho mọi cặp cost-5 creatures
## typeBonus: overcome=1.7x, generated=0.3x, neutral=1.0x
## Kết quả: "A kills B in N hits", "B kills A in M hits"
Output mẫu (★★ stage):

Attacker →	Agnigon	AV8R	Kirkanon	Nudikill	Grintrock
Agnigon	-	Loses (4 vs 2 hits)	Wins (3 vs 5 hits)	Loses (water 1.7x)	Wins (fire→earth 1.7x)
AV8R	Wins	-	Wins (higher DPS)	Neutral	Loses (fire→metal 1.7x)
Grintrock	Loses (fire 1.7x)	Wins (tank)	Wins (tank)	Wins (earth→water 1.7x)	-
→ Giá trị: LLM biết "AV8R beats Agnigon 1v1" thay vì đoán dựa trên mô tả

1D. auto-synergy-breakpoints.md — Synergy impact thực
python
## Tính % stat increase thực tế khi kích hoạt synergy tier
## Ví dụ: Fire 4 = +16% ATK → trên Agnigon ★★ (ATK 130) = +21 ATK
Output mẫu:

Synergy	Tier	Requirement	Bonus	Impact trên cost-5 ★★	Đáng không?
Fire	2	2 fire	+8% ATK	+10 ATK trên Agnigon	Nhỏ, chỉ splash
Fire	4	4 fire	+16% ATK	+21 ATK	Tốt nếu có 4 fire tự nhiên
Fire	6	6 fire	+28% ATK	+36 ATK	Mạnh, nhưng khó đủ 6
Earth	4	4 earth	+8% DEF, +3% HP	+15 DEF, +38 HP trên Grintrock	Solid tank bonus
Water	4	4 water	+20 starting mana	Nudikill cast skill sớm hơn ~2 turns	Rất mạnh cho skill users
→ Giá trị: Biết "Fire 4 chỉ tăng 21 ATK, không đáng ép 4 fire nếu phải dùng quân yếu"

1E. auto-item-efficiency.md — Item efficiency thực
python
## So sánh: Infinity Edge (+40 ATK) vs Bloodthirster (+20 ATK, lifesteal 20%)
## Trên Agnigon ★★ (ATK 130):
##   IE: 130→170 ATK = +31% DPS increase
##   BT: 130→150 ATK = +15% DPS + heal 20% damage dealt
Output mẫu:

Item	Best on Role	DPS gain% (cost-5 ★★)	Survival gain	When to use
Infinity Edge	Cunning carry	+31% ATK	None	Short fights, burst meta
Bloodthirster	Melee carry	+15% ATK	+20% lifesteal	Long fights, sustain meta
Warmog (+400 HP)	Valiant tank	0%	+32% EHP on Grintrock	Always good on main tank
Guardian Angel	Key unit	+12% ATK, +24% DEF	Revive 50% HP	Protect carries vs assassins
Rapid Firecannon	Ranged carry	0% ATK, +30% SPD	None	Reduce cooldown significantly
1F. auto-roll-odds.md — Xác suất roll chính xác
Data đã có trong CARD_COST_CHANCES và CARD_DEFINITION_QUANTITIES:

Output mẫu:

Level	Cost 1	Cost 2	Cost 3	Cost 4	Cost 5
1	100%	0%	0%	0%	0%
5	40%	35%	23%	5%	1%
7	30%	30%	30%	12%	5%
9	22%	30%	25%	20%	10%
Xác suất tìm specific cost-5 unit trong 1 shop (5 cards):

Level 7: ~2.3% per card × 5 = ~11% at least one
Level 9: ~6.4% per card × 5 = ~28% at least one
→ Giá trị: LLM nói "Ở level 7, roll 10 gold (2 rerolls = 10 cards) chỉ có ~21% tìm được Agnigon" — thay vì nói xuông "level up to find cost-5 carries"

Phase 2: Battle Simulation Data
2A. Headless battle simulator
Reuse simulateTurn từ @creature-chess/battle nhưng chạy không UI, không saga, thuần logic:

typescript
// Pseudo-code
function simulateMatch(teamA: PieceModel[], teamB: PieceModel[]): MatchResult {
  let board = createBoard(teamA, teamB);
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    board = simulateTurn(turn, board, ...);
    if (isATeamDefeated(board)) break;
  }
  return { winner, turnsPlayed, remainingHP };
}
2B. Team comp benchmarks
Chạy 1000 trận cho mỗi team comp matchup:

Fire+Metal (Agnigon, AV8R, Pyraminx, Cardinale, Grintrock)
  vs Earth+Wood (Grintrock, Arbelder, Narcileaf, Aardart, Bamboon)
  → Win rate: 58% / 42%
  → Average fight duration: 18 turns
  → Key factor: Fire AoE out-damages Wood healing
2C. Formation benchmarks
So sánh Tank Front vs Spread vs Corner cho cùng một team:

Team: Agnigon, AV8R, Grintrock, Arbelder, Nudikill
  Tank Front: 54% win vs random opponents
  Spread:     48% win
  Corner:     51% win
  → Kết luận: Tank Front tốt nhất cho team này
2D. Output → auto-battle-data.md
Kết quả simulation feed vào RAG như data chính xác.

Phase 3: Tích hợp vào RAG
Thay đổi trong DocumentProcessor
Hiện tại chỉ load từ data/game-guides/*.md. Sau nâng cấp:

data/
├── game-guides/          ← Giữ nguyên (editorial opinion)
├── auto-generated/       ← Phase 1: tính toán từ engine
│   ├── creature-stats.md
│   ├── dps-ranking.md
│   ├── matchup-matrix.md
│   ├── synergy-breakpoints.md
│   ├── item-efficiency.md
│   └── roll-odds.md
└── battle-data/          ← Phase 2: kết quả simulation
    ├── team-comp-winrates.md
    └── formation-benchmarks.md
Thay đổi trong retrieval
Auto-generated data được ưu tiên cao hơn (weight boost) trong hybrid search vì đây là fact, không phải opinion.

Tổng kết sự khác biệt
Hiện tại	Sau nâng cấp
Nguồn dữ liệu	7 file markdown viết tay	Auto-gen từ engine + battle sim
Độ chính xác	Ý kiến chủ quan	Công thức chính xác
Ví dụ	"Agnigon is best carry"	"Agnigon ★★: 1250 HP, 130 ATK, DPS rank #4"
Counter advice	"Water counters Fire"	"Water vs Fire: 1.7x bonus = +56% dmg, win rate 62%"
Item advice	"IE best on carry"	"IE on AV8R: +31% DPS. BT: +15% DPS + lifesteal"
Roll advice	"Level up to find carries"	"Level 7: 11% chance per shop for specific cost-5"
