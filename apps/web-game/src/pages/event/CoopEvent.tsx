import React, { useState } from "react";
import { Users, Gift } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";

// Points milestones for the event
const MILESTONES = [
  { points: 500, reward: "50 🪙 Vàng" },
  { points: 1500, reward: "150 💎 Gem" },
  { points: 3000, reward: "Skin đặc biệt 🎨" },
  { points: 5000, reward: "Nhân vật huyền thoại 🐉" },
];

type Props = { event: EventData };

export const CoopEvent: React.FC<Props> = ({ event }) => {
  // Fake user code based on event id
  const myCode = event.id.slice(0, 6).toUpperCase();
  const [inputCode, setInputCode] = useState("");
  const [submitResult, setSubmitResult] = useState<null | "success" | "error">(null);
  const [totalPoints, setTotalPoints] = useState(820); // mock current points

  const handleSubmit = () => {
    if (inputCode.length < 4) { setSubmitResult("error"); return; }
    // TODO: real backend call
    setTotalPoints(p => p + 250);
    setSubmitResult("success");
    setInputCode("");
    setTimeout(() => setSubmitResult(null), 3000);
  };

  const milestones = event.rewards.length > 0
    ? event.rewards.map((r, i) => ({
        points: (i + 1) * 1000,
        reward: `${r.amount} ${r.type === "gems" ? "💎 Gem" : "🪙 Vàng"}`,
        title: r.title,
      }))
    : MILESTONES;

  const nextMilestone = milestones.find(m => totalPoints < m.points);
  const progressToNext = nextMilestone
    ? Math.min(100, (totalPoints / nextMilestone.points) * 100)
    : 100;

  return (
    <div>
      {/* Community progress bar */}
      <div className={styles.card} style={{ marginBottom: 32 }}>
        <div className={styles.cardTitle}><Users size={18} style={{ display: "inline", marginRight: 8 }} />Tiến Độ Cộng Đồng</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Nhập mã của nhau để cộng điểm chung tay!</div>
        <div style={{ marginTop: 8 }}>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack} style={{ height: 16 }}>
              <div className={styles.progressFill} style={{ width: `${progressToNext}%` }} />
            </div>
            <div className={styles.progressLabel}>
              <span>⭐ {totalPoints.toLocaleString()} điểm</span>
              <span>{nextMilestone ? `→ ${nextMilestone.points.toLocaleString()} điểm` : "🎉 Tất cả đã nhận"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* My code + Enter code */}
      <div className={styles.coopBox}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "#94a3b8" }}>🏷️ Mã của bạn (chia sẻ cho bạn bè)</div>
        <div className={styles.myCodeDisplay}>{myCode}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Mỗi người nhập mã của bạn = +250 điểm cộng đồng</div>

        <hr style={{ width: "100%", borderColor: "rgba(255,255,255,0.06)", margin: "8px 0" }} />

        <div style={{ fontWeight: 800, fontSize: 16, color: "#94a3b8" }}>🔑 Nhập mã bạn bè</div>
        <input
          className={styles.coopInput}
          maxLength={8}
          placeholder="NHẬP MÃ"
          value={inputCode}
          onChange={e => setInputCode(e.target.value.toUpperCase())}
        />
        {submitResult === "success" && <div style={{ color: "#34d399", fontWeight: 700 }}>✅ +250 điểm cộng đồng!</div>}
        {submitResult === "error" && <div style={{ color: "#ef4444", fontWeight: 700 }}>❌ Mã không hợp lệ</div>}
        <button className={styles.coopSubmitBtn} onClick={handleSubmit}>Nộp Mã</button>
      </div>

      {/* Milestones */}
      <div style={{ marginTop: 40 }}>
        <div className={styles.sectionHeader}><Gift size={22} /> Mốc Phần Thưởng</div>
        <div className={styles.progressMilestones}>
          {milestones.map((m, i) => {
            const done = totalPoints >= m.points;
            return (
              <div key={i} className={styles.milestoneRow}>
                <span className={styles.milestoneIcon}>{done ? "🏆" : "🔒"}</span>
                <div className={styles.milestoneInfo}>
                  <div className={styles.milestoneName}>{(m as any).title || `Mốc ${i + 1}`}</div>
                  <div className={styles.milestonePoints}>Yêu cầu: {m.points.toLocaleString()} điểm cộng đồng</div>
                </div>
                <div className={styles.milestoneReward}>{m.reward}</div>
                {done
                  ? <button className={styles.claimBtn} style={{ width: "auto", padding: "8px 16px" }} onClick={() => alert("Đã nhận thưởng!")}>Nhận</button>
                  : <span className={styles.milestoneLock}>🔒</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
