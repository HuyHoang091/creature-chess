import React, { useState, useCallback, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Gem, TrendingUp, CreditCard } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

const PAYPAL_CLIENT_ID = "Af37P1fTOc_4eTMaNyALE4LHuTGgPA093G-V6gwAryBTVN_EvswbY0Mlz513LA-L92SYXtcvyH_iU5V-";

const DEFAULT_TIERS = [
  { min: 100,  label: "Nạp 100 💎",    bonus: "Tặng thêm 20 💎",             sub: "+20% Gem bonus",  priceUsd: 1.00  },
  { min: 500,  label: "Nạp 500 💎",    bonus: "Tặng thêm 150 💎 + Skin",     sub: "+30% Gem bonus",  priceUsd: 5.00  },
  { min: 1000, label: "Nạp 1.000 💎",  bonus: "Tặng thêm 400 💎 + Nhân vật", sub: "+40% Gem bonus",  priceUsd: 10.00 },
  { min: 3000, label: "Nạp 3.000 💎",  bonus: "Tặng thêm 1.500 💎 + BST",    sub: "+50% Gem bonus",  priceUsd: 30.00 },
];

type Props = { event: EventData };

export const TopupBonusEvent: React.FC<Props> = ({ event }) => {
  const token       = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);
  const dispatch    = useDispatch();

  const tiers = event.rewards.length > 0
    ? event.rewards.map((r, i) => ({
        min:      (i + 1) * 100,
        label:    `Nạp ${(i + 1) * 100} 💎`,
        bonus:    `Tặng thêm ${r.amount} ${r.type === "gems" ? "💎" : "🪙"}${r.title ? ` + ${r.title}` : ""}`,
        sub:      `+${Math.min(50, (i + 1) * 10)}% Gem bonus`,
        priceUsd: (i + 1) * 1.00,
      }))
    : DEFAULT_TIERS;

  const storageKey = `topup_${event.id}`;
  const [userTotalTopup, setUserTotalTopup] = useState<number>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return typeof data.totalTopup === "number" ? data.totalTopup : 0;
    } catch { return 0; }
  });

  // Persist to localStorage
  useEffect(() => {
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
    })();
    localStorage.setItem(storageKey, JSON.stringify({ ...existing, totalTopup: userTotalTopup }));
  }, [userTotalTopup, storageKey]);
  const [payingTier, setPayingTier] = useState<typeof tiers[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paypalContainerRef = useRef<HTMLDivElement>(null);

  const loadPayPalScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).paypal) return resolve();
      const existing = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject());
        return;
      }
      const s = document.createElement("script");
      s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
      s.onload  = () => resolve();
      s.onerror = () => reject();
      document.head.appendChild(s);
    });
  }, []);

  const renderPayPalButtons = useCallback(async (tier: typeof tiers[0]) => {
    if (!paypalContainerRef.current) return;
    try { await loadPayPalScript(); }
    catch { setError("Không thể tải PayPal SDK"); return; }

    const paypal = (window as any).paypal;
    if (!paypal) return;
    paypalContainerRef.current.innerHTML = "";
    paypal.Buttons({
      createOrder: (_: any, actions: any) =>
        actions.order.create({
          purchase_units: [{ amount: { value: tier.priceUsd.toFixed(2), currency_code: "USD" }, description: `Topup ${tier.min} Gems` }],
        }),
      onApprove: async (_: any, actions: any) => {
        try {
          const details = await actions.order.capture();
          if (details.status === "COMPLETED") {
            setUserTotalTopup(prev => prev + tier.min);
            if (currentUser) {
              const g = currentUser.currencies?.gems || 0;
              dispatch(ProfileCommands.setCurrentUser({
                ...currentUser,
                currencies: { ...currentUser.currencies, gold: currentUser.currencies?.gold || 0, gems: g + tier.min, tickets: currentUser.currencies?.tickets || 0 },
              }));
            }
            alert(`Thanh toán thành công! Bạn đã nhận được ${tier.min} Gems.`);
            setPayingTier(null);
          } else {
            setError("Thanh toán chưa hoàn tất.");
          }
        } catch (err: any) { setError(err.message || "Lỗi xác thực thanh toán"); }
      },
      onError:  () => setError("Đã xảy ra lỗi trong quá trình thanh toán."),
      onCancel: () => setError("Bạn đã hủy thanh toán."),
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 40 },
    }).render(paypalContainerRef.current);
  }, [loadPayPalScript, currentUser, dispatch]);

  const handlePay = (tier: typeof tiers[0]) => {
    setPayingTier(tier);
    setError(null);
    requestAnimationFrame(() => renderPayPalButtons(tier));
  };

  // Payment confirmation view
  if (payingTier) {
    return (
      <div className={styles.card} style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f5e7c1" }}>Xác nhận nạp gem</div>
        <div style={{ fontSize: 15, color: "rgba(240,230,210,0.6)" }}>
          Gói: <strong style={{ color: "#f0e6d2" }}>{payingTier.label}</strong>
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#34d399" }}>
          ${payingTier.priceUsd.toFixed(2)}
        </div>
        <div style={{ fontSize: 13, color: "rgba(240,230,210,0.45)" }}>
          {payingTier.bonus}
        </div>
        {error && (
          <div style={{ color: "#f87171", fontSize: 14, fontWeight: 700, padding: "10px 16px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        <div ref={paypalContainerRef} style={{ minHeight: 150 }} />
        <button
          className={styles.claimBtn}
          style={{ background: "rgba(20,22,34,0.9)", color: "rgba(240,230,210,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={() => setPayingTier(null)}
        >
          Huỷ
        </button>
      </div>
    );
  }

  // Total progress toward next milestone
  const nextTier   = tiers.find(t => t.min > userTotalTopup);
  const prevAmount = tiers.slice().reverse().find(t => t.min <= userTotalTopup)?.min ?? 0;
  const pct        = nextTier
    ? Math.min(100, ((userTotalTopup - prevAmount) / (nextTier.min - prevAmount)) * 100)
    : 100;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
        <div className={styles.card} style={{ flex: 1, minWidth: 160 }}>
          <div className={styles.cardDesc}>Tổng nạp trong sự kiện</div>
          <div className={styles.statBig} style={{ color: "#85d4c6", fontSize: 36 }}>
            💎 {userTotalTopup.toLocaleString()}
          </div>
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack} style={{ height: 8 }}>
              <div className={styles.progressFill} style={{ width: `${pct}%`, background: "linear-gradient(90deg, #56c4b4, #85d4c6)" }} />
            </div>
          </div>
        </div>
        <div className={styles.card} style={{ flex: 1, minWidth: 200, justifyContent: "center" }}>
          <div className={styles.cardDesc}>Mốc tiếp theo</div>
          {nextTier
            ? <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b", marginTop: 4 }}>
                Còn {(nextTier.min - userTotalTopup).toLocaleString()} 💎 → {nextTier.bonus}
              </div>
            : <div style={{ fontSize: 16, fontWeight: 800, color: "#34d399", marginTop: 4 }}>
                🎉 Đã nhận tất cả phần thưởng!
              </div>
          }
        </div>
      </div>

      {/* Tier list */}
      <div className={styles.sectionHeader}>
        <Gem size={20} /> Bậc Phần Thưởng Nạp
      </div>
      <div className={styles.topupTiers}>
        {tiers.map((tier, i) => {
          const done = userTotalTopup >= tier.min;
          return (
            <div key={i} className={`${styles.topupTier} ${done ? styles.active : ""}`}>
              <div className={styles.topupAmount} style={{ color: done ? "#34d399" : "rgba(200,170,110,0.4)" }}>
                {done ? "✅" : "⬜"} {tier.label}
              </div>
              <div className={styles.topupReward}>
                <div className={styles.topupRewardLabel}>{tier.bonus}</div>
                <div className={styles.topupRewardSub}>{tier.sub}</div>
              </div>
              <div className={`${styles.topupStatus} ${done ? styles.done : styles.pending}`}>
                {done ? "Đã nhận" : "Chưa đủ"}
              </div>
              {done ? (
                <button
                  className={styles.claimBtn}
                  style={{ width: "auto", padding: "8px 18px", marginLeft: 8 }}
                  onClick={async () => {
                    if (!token) return alert("Vui lòng đăng nhập!");
                    try {
                      const res = await claimEventReward(token, event.id, `reward_${event.rewards[i]?.id}`);
                      if (currentUser && res.balances) {
                        dispatch(ProfileCommands.setCurrentUser({ ...currentUser, currencies: res.balances }));
                      }
                      alert(`🎉 Nhận thành công! ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
                    } catch (e: any) { alert(e.message || "Lỗi"); }
                  }}
                >
                  Nhận
                </button>
              ) : (
                <button
                  className={styles.claimBtn}
                  style={{
                    background: "linear-gradient(180deg, #56c4b4, #3a8a7e)",
                    color: "#04060d",
                    width: "auto",
                    padding: "8px 18px",
                    marginLeft: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={() => handlePay(tier)}
                >
                  <CreditCard size={14} /> Nạp ${tier.priceUsd.toFixed(2)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <div style={{
        marginTop: 32, padding: "18px 24px",
        background: "rgba(133,212,198,0.04)",
        border: "1px solid rgba(133,212,198,0.12)",
        borderRadius: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 8, color: "#f0e6d2", fontSize: 14 }}>
          <TrendingUp size={16} color="#85d4c6" /> Lưu ý về ưu đãi nạp
        </div>
        <div style={{ fontSize: 12, color: "rgba(240,230,210,0.45)", lineHeight: 1.8 }}>
          • Thanh toán an toàn qua PayPal.<br />
          • Gem nạp trong sự kiện: <strong style={{ color: "#85d4c6" }}>{userTotalTopup}</strong> 💎<br />
          • Phần thưởng sẽ được ghi nhận tự động sau khi giao dịch hoàn tất.
        </div>
      </div>
    </div>
  );
};
