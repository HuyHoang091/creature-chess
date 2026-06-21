import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

const DEFAULT_PRIZES = [
  { emoji: "💎", name: "100 Gem",      color: "#85d4c6" },
  { emoji: "🪙", name: "500 Vàng",    color: "#f0c674" },
  { emoji: "❌", name: "Thử lại",     color: "#ef4444" },
  { emoji: "🎁", name: "50 Gem",      color: "#85d4c6" },
  { emoji: "⭐", name: "Item hiếm",   color: "#10b981" },
  { emoji: "💰", name: "200 Vàng",    color: "#f59e0b" },
  { emoji: "🏆", name: "Skin độc",    color: "#ec4899" },
  { emoji: "💫", name: "Thử lại",     color: "#64748b" },
];

type Prize = { emoji: string; name: string; color: string };

function buildPrizes(event: EventData): Prize[] {
  if (!event.rewards.length) return DEFAULT_PRIZES;
  return event.rewards.map(r => ({
    emoji: r.type === "gems" ? "💎" : r.type === "gold" ? "🪙" : "🎁",
    name: `${r.amount} ${r.title || r.type}`,
    color: r.type === "gems" ? "#85d4c6" : "#f0c674",
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
    try { const d = JSON.parse(localStorage.getItem(storageKey) || "{}"); return typeof d.spinsLeft === "number" ? d.spinsLeft : 3; } catch { return 3; }
  });
  const [history, setHistory] = useState<Prize[]>(() => {
    try { const d = JSON.parse(localStorage.getItem(storageKey) || "{}"); return d.history || []; } catch { return []; }
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

    const targetIdx = Math.floor(Math.random() * prizes.length);
    const sectorAngle = 360 / prizes.length;
    const extraSpins = 6;
    const targetAngle = extraSpins * 360 + (360 - targetIdx * sectorAngle - sectorAngle / 2);
    const newRotation = rotation + targetAngle;
    setRotation(newRotation);

    if (wheelRef.current) {
      wheelRef.current.style.transition = "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)";
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
      const res = await claimEventReward(token, event.id, `spin_${Date.now()}`);
      if (currentUser && res.balances) {
        dispatch(ProfileCommands.setCurrentUser({ ...currentUser, currencies: res.balances }));
      }
      setClaimedCurrent(true);
      alert(`🎉 Nhận thành công! Nhận: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
    } catch (err: any) {
      alert(err.message || "Có lỗi xảy ra khi nhận phần thưởng.");
    }
  };

  const segmentAngle = 360 / prizes.length;
  // Alternating deep jewel tones
  const wheelColors = [
    "#2d1f0a", "#0e2a26", "#321b08", "#0a2420",
    "#3a2410", "#102522", "#2e1c09", "#0c2220",
  ];
  const strokeColors = [
    "rgba(200,170,110,0.25)", "rgba(133,212,198,0.2)",
    "rgba(200,170,110,0.2)",  "rgba(133,212,198,0.18)",
    "rgba(200,170,110,0.22)", "rgba(133,212,198,0.2)",
    "rgba(200,170,110,0.2)",  "rgba(133,212,198,0.18)",
  ];

  const isLose = wonIndex !== null && prizes[wonIndex].name === "Thử lại";

  return (
    <div>
      {/* Spin info row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <div className={styles.card} style={{ flex: 1, minWidth: 140, alignItems: "center", textAlign: "center" }}>
          <div className={styles.cardDesc}>Lượt quay còn lại</div>
          <div className={styles.statBig} style={{ color: spinsLeft > 0 ? "#f59e0b" : "rgba(200,170,110,0.2)" }}>
            {spinsLeft}
          </div>
          <div className={styles.cardDesc} style={{ fontSize: 11 }}>lượt / ngày</div>
        </div>

        {wonIndex !== null && (
          <div
            className={styles.card}
            style={{
              flex: 2, minWidth: 220,
              border: isLose ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(245,158,11,0.4)",
              background: isLose ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.07)",
            }}
          >
            <div className={styles.cardDesc}>
              {isLose ? "Rất tiếc, thử lại!" : "🎉 Bạn trúng được"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: isLose ? "#f87171" : "#f59e0b" }}>
              {prizes[wonIndex].emoji} {prizes[wonIndex].name}
            </div>
            {!isLose ? (
              <button
                className={styles.claimBtn}
                disabled={claimedCurrent}
                onClick={handleClaim}
                style={{ opacity: claimedCurrent ? 0.6 : 1 }}
              >
                {claimedCurrent ? "✅ Đã Nhận" : "🎁 Nhận Ngay"}
              </button>
            ) : (
              <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700, marginTop: 4 }}>
                Chúc bạn may mắn lần sau! 🍀
              </div>
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
              {/* Outer ring */}
              <circle cx="100" cy="100" r="97" fill="none" stroke="rgba(200,170,110,0.15)" strokeWidth="1.5" />
              {prizes.map((prize, i) => {
                const startAngle = i * segmentAngle - 90;
                const endAngle   = startAngle + segmentAngle;
                const startRad   = (startAngle * Math.PI) / 180;
                const endRad     = (endAngle   * Math.PI) / 180;
                const x1 = 100 + 95 * Math.cos(startRad);
                const y1 = 100 + 95 * Math.sin(startRad);
                const x2 = 100 + 95 * Math.cos(endRad);
                const y2 = 100 + 95 * Math.sin(endRad);
                const midAngle = startAngle + segmentAngle / 2;
                const midRad   = (midAngle * Math.PI) / 180;
                const tx = 100 + 66 * Math.cos(midRad);
                const ty = 100 + 66 * Math.sin(midRad);
                const isWon = wonIndex === i;
                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`}
                      fill={isWon ? (isLose ? "rgba(120,20,20,0.9)" : "rgba(80,60,10,0.95)") : wheelColors[i % wheelColors.length]}
                      stroke={strokeColors[i % strokeColors.length]}
                      strokeWidth="0.8"
                    />
                    {/* Divider line */}
                    <line
                      x1="100" y1="100" x2={x1} y2={y1}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
                    />
                    <text x={tx} y={ty - 7} textAnchor="middle" fontSize="15" dominantBaseline="middle">
                      {prize.emoji}
                    </text>
                    <text x={tx} y={ty + 7} textAnchor="middle" fontSize="5.2" fill="#d4c9b0" dominantBaseline="middle">
                      {prize.name.length > 10 ? prize.name.slice(0, 10) + "…" : prize.name}
                    </text>
                  </g>
                );
              })}
              {/* Center hub */}
              <circle cx="100" cy="100" r="12" fill="#08090f" stroke="rgba(200,170,110,0.3)" strokeWidth="1.5" />
              <circle cx="100" cy="100" r="5" fill="rgba(200,170,110,0.6)" />
            </svg>
          </div>
        </div>

        <button className={styles.spinBtn} onClick={spin} disabled={spinning || spinsLeft === 0}>
          {spinning ? "⏳ Đang quay…" : spinsLeft === 0 ? "Hết lượt quay" : `🎰 Quay Ngay (${spinsLeft} lượt)`}
        </button>

        {/* Prize table */}
        <div style={{ width: "100%" }}>
          <div className={styles.sectionHeader} style={{ fontSize: 17 }}>
            🎁 Phần thưởng có thể trúng
          </div>
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
          <div style={{ width: "100%", marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "rgba(240,230,210,0.35)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Lịch sử quay gần đây
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {history.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: p.name === "Thử lại" ? "#f87171" : "#f0e6d2",
                  }}
                >
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
