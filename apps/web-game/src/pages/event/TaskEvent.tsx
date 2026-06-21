import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Target, Gift, CheckCircle, Lock } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

type Props = { event: EventData };

export const TaskEvent: React.FC<Props> = ({ event }) => {
  const dispatch    = useDispatch();
  const token       = useSelector((state: AppState) => state.auth.accessToken);
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
    if (!token) { alert("Vui lòng đăng nhập để nhận quà!"); return; }
    try {
      const res = await claimEventReward(token, event.id, taskId);
      const next = [...claimed, taskId];
      setClaimed(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({ ...currentUser, currencies: res.balances }));
      }
      alert(`🎉 Nhận thành công: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận quà.");
    }
  };

  const typeLabel: Record<string, string> = {
    play_games: "🎮 Chơi Game",
    win_games:  "🏆 Thắng Game",
    custom:     "⭐ Nhiệm Vụ",
  };

  const completedCount = event.tasks.filter(t => (progress[t.id] ?? 0) >= t.target).length;
  const totalTasks     = event.tasks.length;
  const overallPct     = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <div>
      {/* Overall progress header */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <div className={styles.card} style={{ flex: 2, minWidth: 220 }}>
          <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={18} style={{ flexShrink: 0 }} /> Tiến Độ Nhiệm Vụ
          </div>
          <div className={styles.cardDesc}>Hoàn thành nhiệm vụ để mở khoá phần thưởng</div>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack} style={{ height: 14 }}>
              <div className={styles.progressFill} style={{ width: `${overallPct}%` }} />
            </div>
            <div className={styles.progressLabel}>
              <span>✅ {completedCount} hoàn thành</span>
              <span>{overallPct}%</span>
            </div>
          </div>
        </div>
        <div
          className={styles.card}
          style={{ flex: 1, minWidth: 120, alignItems: "center", textAlign: "center", justifyContent: "center" }}
        >
          <div className={styles.statBig}>{completedCount}</div>
          <div style={{ fontSize: 13, color: "rgba(240,230,210,0.4)", fontWeight: 600 }}>
            / {totalTasks} nhiệm vụ
          </div>
        </div>
      </div>

      {/* Task grid */}
      {event.tasks.length > 0 && (
        <div>
          <div className={styles.sectionHeader}>
            <Target size={20} /> Danh Sách Nhiệm Vụ
          </div>
          <div className={styles.grid2}>
            {event.tasks.map((task) => {
              const cur       = progress[task.id] ?? 0;
              const target    = task.target;
              const pct       = Math.min(100, Math.round((cur / target) * 100));
              const done      = cur >= target;
              const isClaimed = claimed.includes(task.id);

              return (
                <div key={task.id} className={styles.card}>
                  {/* Task header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div className={styles.cardTitle}>{task.title}</div>
                    {isClaimed
                      ? <CheckCircle size={17} color="#34d399" style={{ flexShrink: 0, marginTop: 1 }} />
                      : done
                        ? <CheckCircle size={17} color="#f0c674" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <Lock size={15} style={{ flexShrink: 0, marginTop: 1, opacity: 0.3 }} />
                    }
                  </div>

                  {task.description && (
                    <div className={styles.cardDesc}>{task.description}</div>
                  )}

                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                    color: "rgba(200,170,110,0.6)",
                    background: "rgba(200,170,110,0.06)",
                    border: "1px solid rgba(200,170,110,0.1)",
                    borderRadius: 20, padding: "3px 10px",
                    width: "fit-content",
                  }}>
                    {typeLabel[task.type] ?? task.type}
                  </div>

                  <div className={styles.progressWrap}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.progressLabel}>
                      <span>{cur.toLocaleString()} / {target.toLocaleString()}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>

                  {/* Reward pill */}
                  {task.reward && (
                    <div style={{
                      fontSize: 13, color: "#f0c674", fontWeight: 800,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      🎁 Phần thưởng:{" "}
                      {task.reward.gems  ? `${task.reward.gems} 💎`   :
                       task.reward.gold  ? `${task.reward.gold} 🪙`   :
                       task.reward.item  ?? ""}
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

      {/* Event rewards showcase */}
      {event.rewards.length > 0 && (
        <div style={{ marginTop: 44 }}>
          <div className={styles.sectionHeader}>
            <Gift size={20} /> Phần Thưởng Sự Kiện
          </div>
          <div className={styles.grid2}>
            {event.rewards.map(r => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardTitle}>{r.title}</div>
                {r.description && (
                  <div className={styles.cardDesc}>{r.description}</div>
                )}
                <div style={{ fontSize: 26, fontWeight: 900, color: "#f0c674", marginTop: 4 }}>
                  {r.type === "gems" ? "💎" : "🪙"} {r.amount.toLocaleString()}
                  <span style={{ fontSize: 13, color: "rgba(240,230,210,0.45)", fontWeight: 600, marginLeft: 8 }}>
                    {r.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
