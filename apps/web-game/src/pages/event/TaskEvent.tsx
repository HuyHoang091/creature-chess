import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Target, Gift, CheckCircle } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

type Props = { event: EventData };

export const TaskEvent: React.FC<Props> = ({ event }) => {
  const dispatch = useDispatch();
  const token = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);
  const storageKey = `task_claimed_${event.id}`;
  const [claimed, setClaimed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  });
  const [progress] = useState<Record<string, number>>(() => {
    const p: Record<string, number> = {};
    event.tasks.forEach(t => {
      if (t.type === "play_games") p[t.id] = currentUser?.stats?.gamesPlayed || 0;
      else if (t.type === "win_games") p[t.id] = currentUser?.stats?.wins || 0;
      else p[t.id] = 0;
    });
    return p;
  });

  const claimTask = async (taskId: string) => {
    if (!token) {
      alert("Vui lòng đăng nhập để nhận quà!");
      return;
    }
    try {
      const res = await claimEventReward(token, event.id, taskId);
      const next = [...claimed, taskId];
      setClaimed(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({
          ...currentUser,
          currencies: res.balances
        }));
      }
      alert(`🎉 Nhận thành công: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận quà.");
    }
  };

  const typeLabel: Record<string, string> = {
    play_games: "Chơi Game",
    win_games: "Thắng Game",
    custom: "Nhiệm Vụ",
  };

  const completedCount = event.tasks.filter(t => (progress[t.id] ?? 0) >= t.target).length;
  const totalTasks = event.tasks.length;

  return (
    <div>
      {/* Overall progress */}
      <div className={styles.card} style={{ marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div className={styles.cardDesc}>Tiến độ nhiệm vụ tổng thể</div>
          <div style={{ marginTop: 12 }}>
            <div className={styles.progressWrap}>
              <div className={styles.progressTrack} style={{ height: 14 }}>
                <div className={styles.progressFill} style={{ width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%` }} />
              </div>
              <div className={styles.progressLabel}>
                <span>✅ {completedCount} hoàn thành</span>
                <span>{totalTasks} nhiệm vụ</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "0 16px" }}>
          <div style={{ fontSize: 40, fontWeight: 900, color: "var(--tc, #3b82f6)" }}>{completedCount}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>/ {totalTasks}</div>
        </div>
      </div>

      {/* Task list */}
      {event.tasks.length > 0 && (
        <div>
          <div className={styles.sectionHeader}><Target size={24} /> Danh Sách Nhiệm Vụ</div>
          <div className={styles.grid2}>
            {event.tasks.map((task) => {
              const cur = progress[task.id] ?? 0;
              const target = task.target;
              const pct = Math.min(100, Math.round((cur / target) * 100));
              const done = cur >= target;
              const isClaimed = claimed.includes(task.id);
              return (
                <div key={task.id} className={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div className={styles.cardTitle}>{task.title}</div>
                    {done && <CheckCircle size={18} color="#34d399" style={{ flexShrink: 0 }} />}
                  </div>
                  {task.description && <div className={styles.cardDesc}>{task.description}</div>}
                  <div className={styles.cardDesc} style={{ marginTop: 2 }}>
                    Loại: {typeLabel[task.type] ?? task.type}
                  </div>

                  <div className={styles.progressWrap}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.progressLabel}>
                      <span>{cur} / {target}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>

                  {/* Reward info */}
                  {task.reward && (
                    <div style={{ fontSize: 13, color: "#f59e0b", fontWeight: 700 }}>
                      Phần thưởng: {task.reward.gems ? `${task.reward.gems} 💎` : task.reward.gold ? `${task.reward.gold} 🪙` : task.reward.item ?? ""}
                    </div>
                  )}

                  <button
                    className={`${styles.claimBtn} ${isClaimed ? styles.claimed : ""}`}
                    disabled={!done || isClaimed}
                    onClick={() => claimTask(task.id)}
                  >
                    {isClaimed ? "✅ Đã Nhận" : done ? "🎁 Nhận Thưởng" : "Chưa Hoàn Thành"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rewards showcase */}
      {event.rewards.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className={styles.sectionHeader}><Gift size={24} /> Phần Thưởng Sự Kiện</div>
          <div className={styles.grid2}>
            {event.rewards.map(r => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardTitle}>{r.title}</div>
                {r.description && <div className={styles.cardDesc}>{r.description}</div>}
                <div style={{ fontSize: 24, fontWeight: 900, color: "#f59e0b", marginTop: 4 }}>
                  {r.type === "gems" ? "💎" : "🪙"} {r.amount} {r.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
