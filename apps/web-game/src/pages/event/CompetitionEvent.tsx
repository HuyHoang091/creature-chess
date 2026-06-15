import React from "react";
import { Trophy, Medal } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";

// Mock leaderboard data (in production: fetched from backend)
const MOCK_PLAYERS = [
  { rank: 1, name: "DragonSlayer99", score: 4821, prize: "1000 💎 + Skin rồng" },
  { rank: 2, name: "PhoenixRider", score: 3990, prize: "500 💎" },
  { rank: 3, name: "ShadowWolf", score: 3501, prize: "200 💎" },
  { rank: 4, name: "IronFist42", score: 2870, prize: "100 💎" },
  { rank: 5, name: "StarlightMage", score: 2755, prize: "50 💎" },
  { rank: 6, name: "ThunderBolt", score: 2340 },
  { rank: 7, name: "NightOwl88", score: 2100 },
  { rank: 8, name: "CrimsonAce", score: 1998 },
  { rank: 9, name: "GoldenArrow", score: 1760 },
  { rank: 10, name: "SilverBlade", score: 1580 },
];

function getRankStyle(rank: number) {
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
  const daysLeft = msLeft > 0 ? Math.floor(msLeft / (1000 * 60 * 60 * 24)) : 0;
  const hoursLeft = msLeft > 0 ? Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;

  // Use event tasks to define metric (e.g. "win_games" = win count)
  const metric = event.tasks[0]?.type === "win_games" ? "Wins" :
                 event.tasks[0]?.type === "play_games" ? "Games Played" : "Score";

  return (
    <div>
      {/* Live timer */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {[
          { label: "Ngày còn lại", value: daysLeft },
          { label: "Giờ còn lại", value: hoursLeft },
        ].map(item => (
          <div key={item.label} style={{
            flex: 1, minWidth: 120,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, padding: "18px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--tc, #3b82f6)" }}>{item.value}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
        <div style={{
          flex: 2, minWidth: 200,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14, padding: "18px 24px",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Chỉ tiêu xếp hạng</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginTop: 4 }}>{metric}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Cập nhật mỗi 5 phút</div>
        </div>
      </div>

      {/* Prize structure */}
      {event.rewards.length > 0 && (
        <div className={styles.card} style={{ marginBottom: 32 }}>
          <div className={styles.cardTitle}><Trophy size={18} style={{ display: "inline", marginRight: 8 }} />Cơ Cấu Giải Thưởng</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {event.rewards.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 18, minWidth: 28 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
                <span style={{ flex: 1, fontWeight: 700 }}>{r.title || `Top ${i + 1}`}</span>
                <span style={{ color: "#f59e0b", fontWeight: 800 }}>{r.amount} {r.type === "gems" ? "💎" : "🪙"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className={styles.sectionHeader}><Medal size={24} /> Bảng Xếp Hạng</div>
      <div className={styles.leaderboard}>
        {MOCK_PLAYERS.map(p => (
          <div key={p.rank} className={`${styles.leaderboardRow} ${getRankStyle(p.rank)}`}>
            <div className={styles.rank}>{getRankEmoji(p.rank)}</div>
            <div className={styles.playerName}>{p.name}</div>
            <div className={styles.playerScore}>{p.score.toLocaleString()} {metric}</div>
            {p.prize && <div className={styles.prizeTag}>{p.prize}</div>}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 20, color: "#334155", fontSize: 13 }}>
        * Bảng xếp hạng cập nhật theo thời gian thực
      </div>
    </div>
  );
};
