import React from "react";
import { Trophy, Medal } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";

// Mock leaderboard data (in production: fetched from backend)
const MOCK_PLAYERS = [
  { rank: 1, name: "DragonSlayer99",  score: 4821, prize: "1000 💎 + Skin rồng" },
  { rank: 2, name: "PhoenixRider",    score: 3990, prize: "500 💎" },
  { rank: 3, name: "ShadowWolf",      score: 3501, prize: "200 💎" },
  { rank: 4, name: "IronFist42",      score: 2870, prize: "100 💎" },
  { rank: 5, name: "StarlightMage",   score: 2755, prize: "50 💎" },
  { rank: 6, name: "ThunderBolt",     score: 2340 },
  { rank: 7, name: "NightOwl88",      score: 2100 },
  { rank: 8, name: "CrimsonAce",      score: 1998 },
  { rank: 9, name: "GoldenArrow",     score: 1760 },
  { rank: 10, name: "SilverBlade",    score: 1580 },
];

function getRankClass(rank: number) {
  if (rank === 1) return styles.gold;
  if (rank === 2) return styles.silver;
  if (rank === 3) return styles.bronze;
  return "";
}

function getRankEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

type Props = { event: EventData };

export const CompetitionEvent: React.FC<Props> = ({ event }) => {
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const now = new Date();
  const msLeft = endsAt ? endsAt.getTime() - now.getTime() : 0;
  const daysLeft  = msLeft > 0 ? Math.floor(msLeft / (1000 * 60 * 60 * 24)) : 0;
  const hoursLeft = msLeft > 0 ? Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;
  const minsLeft  = msLeft > 0 ? Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60)) : 0;

  const metric =
    event.tasks[0]?.type === "win_games"  ? "Wins" :
    event.tasks[0]?.type === "play_games" ? "Games Played" : "Score";

  // Stat tiles
  const stats = [
    { label: "Ngày còn lại", value: String(daysLeft), icon: "📅" },
    { label: "Giờ còn lại",  value: String(hoursLeft), icon: "⏰" },
    { label: "Phút còn lại", value: String(minsLeft),  icon: "⏱️" },
  ];

  return (
    <div>
      {/* Time tiles */}
      <div style={{ display: "flex", gap: 14, marginBottom: 32, flexWrap: "wrap" }}>
        {stats.map(s => (
          <div key={s.label} className={styles.card} style={{ flex: 1, minWidth: 110, alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div className={styles.statBig}>{s.value}</div>
            <div className={styles.cardDesc}>{s.label}</div>
          </div>
        ))}
        <div className={styles.card} style={{ flex: 2, minWidth: 200, justifyContent: "center" }}>
          <div className={styles.cardDesc}>Chỉ tiêu xếp hạng</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f5e7c1", marginTop: 4 }}>{metric}</div>
          <div className={styles.cardDesc} style={{ marginTop: 4 }}>
            🔄 Cập nhật mỗi 5 phút
          </div>
        </div>
      </div>

      {/* Prize structure */}
      {event.rewards.length > 0 && (
        <div className={styles.card} style={{ marginBottom: 36 }}>
          <div className={styles.cardTitle}>
            <Trophy size={17} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
            Cơ Cấu Giải Thưởng
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {event.rewards.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: i === 0 ? "rgba(234,179,8,0.07)" : i === 1 ? "rgba(203,213,225,0.04)" : i === 2 ? "rgba(180,83,9,0.06)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${i === 0 ? "rgba(234,179,8,0.22)" : i === 1 ? "rgba(203,213,225,0.18)" : i === 2 ? "rgba(180,83,9,0.22)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <span style={{ fontSize: 20, minWidth: 28 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span style={{ flex: 1, fontWeight: 700, color: "#f0e6d2" }}>
                  {r.title || `Top ${i + 1}`}
                </span>
                <span style={{ color: "#f0c674", fontWeight: 900, fontSize: 15 }}>
                  {r.amount} {r.type === "gems" ? "💎" : "🪙"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className={styles.sectionHeader}>
        <Medal size={22} /> Bảng Xếp Hạng
      </div>
      <div className={styles.leaderboard}>
        {MOCK_PLAYERS.map(p => (
          <div key={p.rank} className={`${styles.leaderboardRow} ${getRankClass(p.rank)}`}>
            <div className={styles.rank}>{getRankEmoji(p.rank)}</div>
            <div className={styles.playerName}>{p.name}</div>
            <div className={styles.playerScore}>
              {p.score.toLocaleString()} {metric}
            </div>
            {p.prize && <div className={styles.prizeTag}>{p.prize}</div>}
          </div>
        ))}
      </div>

      <div style={{
        textAlign: "center", marginTop: 20,
        fontSize: 12, color: "rgba(240,230,210,0.25)",
        letterSpacing: "0.3px",
      }}>
        * Bảng xếp hạng cập nhật theo thời gian thực
      </div>
    </div>
  );
};
