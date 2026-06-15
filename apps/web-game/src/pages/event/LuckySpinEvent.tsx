import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

// Build prize pool from event.rewards or use defaults
const DEFAULT_PRIZES = [
  { emoji: "💎", name: "100 Gem", color: "#818cf8" },
  { emoji: "🪙", name: "500 Vàng", color: "#f59e0b" },
  { emoji: "❌", name: "Thử lại", color: "#ef4444" },
  { emoji: "🎁", name: "50 Gem", color: "#60a5fa" },
  { emoji: "⭐", name: "Item hiếm", color: "#10b981" },
  { emoji: "💰", name: "200 Vàng", color: "#f59e0b" },
  { emoji: "🏆", name: "Skin độc", color: "#ec4899" },
  { emoji: "💫", name: "Thử lại", color: "#64748b" },
];

type Prize = { emoji: string; name: string; color: string };

function buildPrizes(event: EventData): Prize[] {
  if (!event.rewards.length) return DEFAULT_PRIZES;
  return event.rewards.map(r => ({
    emoji: r.type === "gems" ? "💎" : r.type === "gold" ? "🪙" : "🎁",
    name: `${r.amount} ${r.title || r.type}`,
    color: r.type === "gems" ? "#818cf8" : "#f59e0b",
  })).concat(
    Array(Math.max(0, 8 - event.rewards.length)).fill({ emoji: "❌", name: "Thử lại", color: "#ef4444" })
  ).slice(0, 8);
}

type Props = { event: EventData };

export const LuckySpinEvent: React.FC<Props> = ({ event }) => {
  const token = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);
  const dispatch = useDispatch();

  const prizes = buildPrizes(event);
  const storageKey = `lucky_spin_${event.id}`;
  
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonIndex, setWonIndex] = useState<number | null>(null);
  const [claimedCurrent, setClaimedCurrent] = useState(false);
  
  const [spinsLeft, setSpinsLeft] = useState<number>(() => {
    try { const data = JSON.parse(localStorage.getItem(storageKey) || "{}"); return typeof data.spinsLeft === 'number' ? data.spinsLeft : 3; } catch { return 3; }
  });
  const [history, setHistory] = useState<Prize[]>(() => {
    try { const data = JSON.parse(localStorage.getItem(storageKey) || "{}"); return data.history || []; } catch { return []; }
  });
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ spinsLeft, history }));
  }, [spinsLeft, history, storageKey]);

  const spin = () => {
    if (spinning || spinsLeft === 0) return;
    setWonIndex(null);
    setClaimedCurrent(false);
    setSpinning(true);
    setSpinsLeft((s: number) => s - 1);

    // random sector
    const targetIdx = Math.floor(Math.random() * prizes.length);
    const sectorAngle = 360 / prizes.length;
    const extraSpins = 5; // 5 full rotations
    const targetAngle = extraSpins * 360 + (360 - targetIdx * sectorAngle - sectorAngle / 2);
    const newRotation = rotation + targetAngle;

    setRotation(newRotation);
    if (wheelRef.current) {
      wheelRef.current.style.transition = "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)";
      wheelRef.current.style.transform = `rotate(${newRotation}deg)`;
    }

    setTimeout(() => {
      setSpinning(false);
      setWonIndex(targetIdx);
      setHistory(h => [prizes[targetIdx], ...h].slice(0, 10));
    }, 4200);
  };

  const handleClaim = async () => {
    if (!token) return alert("Vui lòng đăng nhập!");
    if (wonIndex === null || claimedCurrent) return;
    
    try {
      // Create a unique task ID for this specific spin outcome
      const taskId = `spin_${Date.now()}`;
      const res = await claimEventReward(token, event.id, taskId);
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({
          ...currentUser,
          currencies: res.balances
        }));
      }
      setClaimedCurrent(true);
      alert(`🎉 Nhận thành công! Nhận: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận phần thưởng.");
    }
  };

  const segmentAngle = 360 / prizes.length;
  const wheelColors = ["#1e3a5f", "#1e3a4f", "#1a3040", "#1e2840", "#1a2b45", "#162840", "#1a2e50", "#1e3360"];

  return (
    <div>
      {/* Spin info */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <div className={styles.card} style={{ flex: 1, minWidth: 160 }}>
          <div className={styles.cardDesc}>Lượt quay còn lại</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: spinsLeft > 0 ? "#f59e0b" : "#475569" }}>{spinsLeft}</div>
        </div>
        {wonIndex !== null && (
          <div className={styles.card} style={{ flex: 2, minWidth: 200, border: prizes[wonIndex].name === "Thử lại" ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(245,158,11,0.4)", background: prizes[wonIndex].name === "Thử lại" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)" }}>
            <div className={styles.cardDesc}>{prizes[wonIndex].name === "Thử lại" ? "Rất tiếc!" : "🎉 Bạn trúng được"}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: prizes[wonIndex].name === "Thử lại" ? "#ef4444" : "#f59e0b" }}>
              {prizes[wonIndex].emoji} {prizes[wonIndex].name}
            </div>
            {prizes[wonIndex].name !== "Thử lại" ? (
              <button className={styles.claimBtn} disabled={claimedCurrent} style={{ opacity: claimedCurrent ? 0.5 : 1 }} onClick={handleClaim}>
                {claimedCurrent ? "Đã Nhận" : "Nhận Ngay"}
              </button>
            ) : (
              <div style={{ marginTop: 16, fontSize: 14, color: "#ef4444", fontWeight: "bold" }}>Chúc bạn may mắn lần sau!</div>
            )}
          </div>
        )}
      </div>

      {/* Wheel */}
      <div className={styles.spinContainer}>
        <div className={styles.wheelWrapper}>
          <div className={styles.wheelPointer}>▼</div>
          <div className={styles.wheel} ref={wheelRef} style={{ background: "transparent" }}>
            <svg viewBox="0 0 200 200" width="100%" height="100%">
              {prizes.map((prize, i) => {
                const startAngle = i * segmentAngle - 90;
                const endAngle = startAngle + segmentAngle;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const x1 = 100 + 95 * Math.cos(startRad);
                const y1 = 100 + 95 * Math.sin(startRad);
                const x2 = 100 + 95 * Math.cos(endRad);
                const y2 = 100 + 95 * Math.sin(endRad);
                const midRad = ((startAngle + segmentAngle / 2) * Math.PI) / 180;
                const tx = 100 + 65 * Math.cos(midRad);
                const ty = 100 + 65 * Math.sin(midRad);
                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                      fill={wheelColors[i % wheelColors.length]}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={tx} y={ty - 6}
                      textAnchor="middle"
                      fontSize="14"
                      dominantBaseline="middle"
                    >{prize.emoji}</text>
                    <text
                      x={tx} y={ty + 8}
                      textAnchor="middle"
                      fontSize="5.5"
                      fill="#e2e8f0"
                      dominantBaseline="middle"
                    >{prize.name.length > 10 ? prize.name.slice(0, 10) + "…" : prize.name}</text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="10" fill="#0b0e14" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            </svg>
          </div>
        </div>

        <button className={styles.spinBtn} onClick={spin} disabled={spinning || spinsLeft === 0}>
          {spinning ? "Đang quay…" : spinsLeft === 0 ? "Hết lượt quay" : `🎰 Quay Ngay (${spinsLeft} lượt)`}
        </button>

        {/* Prize table */}
        <div style={{ width: "100%" }}>
          <div className={styles.sectionHeader} style={{ fontSize: 18 }}>🎁 Các phần thưởng có thể trúng</div>
          <div className={styles.spinPrizesGrid}>
            {prizes.map((p, i) => (
              <div key={i} className={`${styles.spinPrizeItem} ${wonIndex === i ? styles.highlight : ""}`}>
                <div className={styles.spinPrizeEmoji}>{p.emoji}</div>
                <div className={styles.spinPrizeName}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ width: "100%", marginTop: 8 }}>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 10, fontWeight: 700 }}>Lịch sử quay:</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {history.map((p, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700 }}>
                  {p.emoji} {p.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
