import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { CheckCircle, Gift, Lock } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

// ─── helpers ──────────────────────────────────────────────────────────────────
function getDaysInEvent(startsAt: string | null, endsAt: string | null): Date[] {
  if (!startsAt || !endsAt) return [];
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days.slice(0, 28); // max 28 days shown
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

type Props = { event: EventData };

export const DailyLoginEvent: React.FC<Props> = ({ event }) => {
  const dispatch = useDispatch();
  const token = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);
  const days = getDaysInEvent(event.startsAt, event.endsAt);
  const today = new Date();
  const storageKey = `daily_claimed_${event.id}`;
  const [claimed, setClaimed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  });

  const claim = async (day: Date, dayIndex: number) => {
    if (!token) {
      alert("Vui lòng đăng nhập để điểm danh!");
      return;
    }
    const key = day.toDateString();
    if (claimed.includes(key)) return;

    try {
      const res = await claimEventReward(token, event.id, `daily_login_day_${dayIndex}`);
      const next = [...claimed, key];
      setClaimed(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({
          ...currentUser,
          currencies: res.balances
        }));
      }
      alert(`🎉 Điểm danh thành công! Nhận: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi điểm danh.");
    }
  };

  const claimMilestone = async (milestoneId: string) => {
    if (!token) return;
    try {
      const res = await claimEventReward(token, event.id, `daily_login_milestone_${milestoneId}`);
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({
          ...currentUser,
          currencies: res.balances
        }));
      }
      alert(`🎉 Nhận thành công! Nhận: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận mốc quà.");
    }
  };

  // build reward schedule — cycle through event.rewards
  const getRewardForDay = (index: number) => {
    if (!event.rewards.length) return null;
    return event.rewards[index % event.rewards.length];
  };

  const totalDays = days.length;
  const totalClaimed = claimed.length;

  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <div className={styles.sectionHeader} style={{ marginBottom: 4 }}>
            <span>📅</span> Điểm Danh Hàng Ngày
          </div>
          <div style={{ color: "#64748b", fontSize: 14 }}>Đăng nhập mỗi ngày để nhận phần thưởng</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "var(--tc, #3b82f6)" }}>{totalClaimed}/{totalDays}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>ngày đã điểm danh</div>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {days.map((day, idx) => {
          const key = day.toDateString();
          const isPast = day < new Date(today.toDateString());
          const isToday = isSameDay(day, today);
          const isFuture = day > new Date(today.toDateString());
          const isClaimed = claimed.includes(key);
          const reward = getRewardForDay(idx);

          let cls = styles.calendarDay;
          if (isClaimed) cls += ` ${styles.claimed}`;
          else if (isToday) cls += ` ${styles.today}`;
          else if (isPast) cls += ` ${styles.past}`;
          else if (isFuture) cls += ` ${styles.future}`;

          return (
            <div key={key} className={cls} onClick={() => isToday && !isClaimed && claim(day, idx)} title={isToday && !isClaimed ? "Click để điểm danh" : ""}>
              <span className={styles.dayLabel}>Ngày {idx + 1}</span>
              {isClaimed ? (
                <span className={styles.checkMark}>✅</span>
              ) : isToday ? (
                <span style={{ fontSize: 20 }}>🎁</span>
              ) : isFuture ? (
                <Lock size={14} style={{ opacity: 0.3 }} />
              ) : (
                <span style={{ fontSize: 20, opacity: 0.3 }}>⬜</span>
              )}
              {reward && <span className={styles.dayReward}>{reward.amount}{reward.type === "gems" ? "💎" : "🪙"}</span>}
            </div>
          );
        })}
      </div>

      {/* Milestone rewards row */}
      {event.rewards.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className={styles.sectionHeader}><Gift size={22} /> Phần Thưởng Tích Luỹ</div>
          <div className={styles.progressMilestones}>
            {event.rewards.map((r, i) => {
              const milestone = Math.ceil(totalDays / event.rewards.length) * (i + 1);
              const done = totalClaimed >= milestone;
              return (
                <div key={r.id} className={styles.milestoneRow}>
                  <span className={styles.milestoneIcon}>{done ? "🏆" : "🔒"}</span>
                  <div className={styles.milestoneInfo}>
                    <div className={styles.milestoneName}>{r.title}</div>
                    <div className={styles.milestonePoints}>Yêu cầu: {milestone} ngày điểm danh</div>
                  </div>
                  <div className={styles.milestoneReward}>{r.amount} {r.type === "gems" ? "💎" : "🪙"}</div>
                  {done
                    ? <button className={`${styles.claimBtn}`} style={{ width: "auto", padding: "8px 16px" }} onClick={() => claimMilestone(r.id)}>Nhận</button>
                    : <Lock size={16} className={styles.milestoneLock} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
