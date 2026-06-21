import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Users, Gift, Copy, Check } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

const MILESTONES = [
  { points: 500,  reward: "50 🪙 Vàng" },
  { points: 1500, reward: "150 💎 Gem" },
  { points: 3000, reward: "Skin đặc biệt 🎨" },
  { points: 5000, reward: "Nhân vật huyền thoại 🐉" },
];

type Props = { event: EventData };

export const CoopEvent: React.FC<Props> = ({ event }) => {
  const dispatch = useDispatch();
  const token = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);

  const myCode = event.id.slice(0, 6).toUpperCase();
  const storageKey = `coop_${event.id}`;

  const [inputCode, setInputCode] = useState("");
  const [submitResult, setSubmitResult] = useState<null | "success" | "error" | "self">(null);
  const [copied, setCopied] = useState(false);

  // Persist totalPoints to localStorage
  const [totalPoints, setTotalPoints] = useState<number>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return typeof data.totalPoints === "number" ? data.totalPoints : 0;
    } catch { return 0; }
  });

  // Persist claimed milestones to localStorage
  const [claimedMilestones, setClaimedMilestones] = useState<string[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return data.claimedMilestones || [];
    } catch { return []; }
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
    })();
    localStorage.setItem(storageKey, JSON.stringify({
      ...existing,
      totalPoints,
      claimedMilestones,
    }));
  }, [totalPoints, claimedMilestones, storageKey]);

  const handleCopy = () => {
    navigator.clipboard.writeText(myCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (inputCode.length < 4) { setSubmitResult("error"); return; }

    // Prevent self-code entry
    if (inputCode.toUpperCase() === myCode) {
      setSubmitResult("self");
      setInputCode("");
      setTimeout(() => setSubmitResult(null), 3000);
      return;
    }

    // If logged in, call API
    if (token) {
      try {
        const res = await claimEventReward(token, event.id, `coop_code_${inputCode.toUpperCase()}`);
        if (currentUser && res.balances) {
          dispatch(ProfileCommands.setCurrentUser({
            ...currentUser,
            currencies: res.balances,
          }));
        }
      } catch {
        // If API fails, still add local points as fallback
      }
    }

    setTotalPoints(p => p + 250);
    setSubmitResult("success");
    setInputCode("");
    setTimeout(() => setSubmitResult(null), 3000);
  };

  const milestones = event.rewards.length > 0
    ? event.rewards.map((r, i) => ({
        id: r.id,
        points: (i + 1) * 1000,
        reward: `${r.amount} ${r.type === "gems" ? "💎 Gem" : "🪙 Vàng"}`,
        title: r.title,
      }))
    : MILESTONES.map((m, i) => ({ ...m, id: `milestone_${i}` }));

  const nextMilestone = milestones.find(m => totalPoints < m.points);
  const prevTarget = milestones.slice().reverse().find(m => totalPoints >= m.points)?.points ?? 0;
  const nextTarget = nextMilestone?.points ?? prevTarget;
  const progressPct = nextMilestone
    ? Math.min(100, ((totalPoints - prevTarget) / (nextTarget - prevTarget)) * 100)
    : 100;

  const claimMilestone = async (milestoneId: string) => {
    if (!token) { alert("Vui lòng đăng nhập!"); return; }
    try {
      const res = await claimEventReward(token, event.id, `coop_milestone_${milestoneId}`);
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({
          ...currentUser,
          currencies: res.balances,
        }));
      }
      setClaimedMilestones(prev => [...prev, milestoneId]);
      alert(`🎉 Nhận thành công! ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận thưởng.");
    }
  };

  return (
    <div>
      {/* Community progress */}
      <div className={styles.card} style={{ marginBottom: 32 }}>
        <div className={styles.cardTitle}>
          <Users size={17} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
          Tiến Độ Cộng Đồng
        </div>
        <div className={styles.cardDesc}>Nhập mã của nhau để cộng điểm — chung tay mở khoá phần thưởng!</div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
          <span className={styles.statBig} style={{ fontSize: 32 }}>{totalPoints.toLocaleString()}</span>
          <span style={{ color: "rgba(240,230,210,0.45)", fontSize: 13 }}>điểm cộng đồng</span>
          {nextMilestone && (
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(240,230,210,0.4)" }}>
              → {nextMilestone.points.toLocaleString()} điểm
            </span>
          )}
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack} style={{ height: 14 }}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span>{nextMilestone ? `Mốc kế: ${nextMilestone.points.toLocaleString()} điểm` : "🎉 Tất cả mốc đã mở!"}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
        </div>
      </div>

      {/* Code exchange box */}
      <div className={styles.coopBox}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(240,230,210,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>
          🏷️ Mã của bạn
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className={styles.myCodeDisplay}>{myCode}</div>
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px", borderRadius: 10,
              background: copied ? "rgba(16,185,129,0.12)" : "rgba(200,170,110,0.07)",
              border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(200,170,110,0.2)"}`,
              color: copied ? "#6ee7b7" : "rgba(200,170,110,0.9)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Đã sao" : "Copy"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "rgba(240,230,210,0.35)", letterSpacing: "0.2px" }}>
          Chia sẻ mã này — mỗi lần nhập = <strong style={{ color: "rgba(200,170,110,0.8)" }}>+250 điểm</strong>
        </div>

        <hr style={{ width: "100%", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)", margin: "4px 0" }} />

        <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(240,230,210,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>
          🔑 Nhập mã bạn bè
        </div>
        <input
          className={styles.coopInput}
          maxLength={8}
          placeholder="NHẬP MÃ"
          value={inputCode}
          onChange={e => setInputCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {submitResult === "success" && (
          <div style={{ color: "#34d399", fontWeight: 700, fontSize: 14, animation: "fadeIn 0.3s" }}>
            ✅ +250 điểm cộng đồng!
          </div>
        )}
        {submitResult === "self" && (
          <div style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>
            ❌ Không thể nhập mã của chính mình!
          </div>
        )}
        {submitResult === "error" && (
          <div style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>
            ❌ Mã không hợp lệ hoặc quá ngắn
          </div>
        )}

        <button className={styles.coopSubmitBtn} onClick={handleSubmit}>
          Nộp Mã
        </button>
      </div>

      {/* Milestones */}
      <div style={{ marginTop: 40 }}>
        <div className={styles.sectionHeader}>
          <Gift size={20} /> Mốc Phần Thưởng
        </div>
        <div className={styles.progressMilestones}>
          {milestones.map((m, i) => {
            const done = totalPoints >= m.points;
            const isClaimed = claimedMilestones.includes(m.id);
            return (
              <div key={i} className={styles.milestoneRow}>
                <span className={styles.milestoneIcon}>{done ? "🏆" : "🔒"}</span>
                <div className={styles.milestoneInfo}>
                  <div className={styles.milestoneName}>{(m as any).title || `Mốc ${i + 1}`}</div>
                  <div className={styles.milestonePoints}>
                    Yêu cầu: {m.points.toLocaleString()} điểm cộng đồng
                  </div>
                </div>
                <div className={styles.milestoneReward}>{m.reward}</div>
                {done
                  ? (
                    <button
                      className={`${styles.claimBtn} ${isClaimed ? styles.claimed : ""}`}
                      style={{ width: "auto", padding: "8px 20px" }}
                      disabled={isClaimed}
                      onClick={() => claimMilestone(m.id)}
                    >
                      {isClaimed ? "✅ Đã Nhận" : "Nhận"}
                    </button>
                  ) : (
                    <span className={styles.milestoneLock}>🔒</span>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
