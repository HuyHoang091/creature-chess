import React, { useState, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Gem, TrendingUp, CreditCard, ChevronRight, Check } from "lucide-react";
import { EventData } from "./types";
import styles from "./EventPage.module.css";
import { claimEventReward } from "../../services/eventApi";
import { AppState } from "../../store/state";
import { ProfileCommands } from "../../store/profile/state";

const PAYPAL_CLIENT_ID = "Af37P1fTOc_4eTMaNyALE4LHuTGgPA093G-V6gwAryBTVN_EvswbY0Mlz513LA-L92SYXtcvyH_iU5V-";

const DEFAULT_TIERS = [
  { min: 100, label: "Nạp 100 💎", bonus: "Tặng thêm 20 💎", sub: "+20% Gem bonus", priceUsd: 1.00 },
  { min: 500, label: "Nạp 500 💎", bonus: "Tặng thêm 150 💎 + Skin", sub: "+30% Gem bonus", priceUsd: 5.00 },
  { min: 1000, label: "Nạp 1.000 💎", bonus: "Tặng thêm 400 💎 + Nhân vật", sub: "+40% Gem bonus", priceUsd: 10.00 },
  { min: 3000, label: "Nạp 3.000 💎", bonus: "Tặng thêm 1.500 💎 + Bộ sưu tập", sub: "+50% Gem bonus", priceUsd: 30.00 },
];

type Props = { event: EventData };

export const TopupBonusEvent: React.FC<Props> = ({ event }) => {
  const token = useSelector((state: AppState) => state.auth.accessToken);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);
  const dispatch = useDispatch();

  const tiers = event.rewards.length > 0
    ? event.rewards.map((r, i) => ({
        min: (i + 1) * 100,
        label: `Nạp ${(i + 1) * 100} 💎`,
        bonus: `Tặng thêm ${r.amount} ${r.type === "gems" ? "💎" : "🪙"} ${r.title ? `+ ${r.title}` : ""}`,
        sub: `+${Math.min(50, (i + 1) * 10)}% Gem bonus`,
        priceUsd: (i + 1) * 1.00
      }))
    : DEFAULT_TIERS;

  // Mock progress state
  const [userTotalTopup, setUserTotalTopup] = useState(0);
  const [payingTier, setPayingTier] = useState<typeof tiers[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paypalContainerRef = useRef<HTMLDivElement>(null);

  const loadPayPalScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).paypal) return resolve();
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () => reject());
        return;
      }
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }, []);

  const renderPayPalButtons = useCallback(async (tier: typeof tiers[0]) => {
    if (!paypalContainerRef.current) return;
    try {
      await loadPayPalScript();
    } catch {
      setError("Không thể tải PayPal SDK");
      return;
    }
    const paypal = (window as any).paypal;
    if (!paypal) return;

    paypalContainerRef.current.innerHTML = "";
    paypal.Buttons({
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: tier.priceUsd.toFixed(2), currency_code: "USD" },
            description: `Topup ${tier.min} Gems`,
          }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        try {
          const details = await actions.order.capture();
          if (details.status === "COMPLETED") {
            // Success topup mock
            setUserTotalTopup(prev => prev + tier.min);
            if (currentUser) {
              const currentGems = currentUser.currencies?.gems || 0;
              dispatch(ProfileCommands.setCurrentUser({
                ...currentUser,
                currencies: { ...currentUser.currencies, gold: currentUser.currencies?.gold || 0, gems: currentGems + tier.min, tickets: currentUser.currencies?.tickets || 0 }
              }));
            }
            alert(`Thanh toán thành công! Bạn đã nhận được ${tier.min} Gems.`);
            setPayingTier(null);
          } else {
            setError("Thanh toán chưa hoàn tất.");
          }
        } catch (err: any) {
          setError(err.message || "Lỗi xác thực thanh toán");
        }
      },
      onError: () => setError("Đã xảy ra lỗi trong quá trình thanh toán."),
      onCancel: () => setError("Bạn đã hủy thanh toán."),
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 40 }
    }).render(paypalContainerRef.current);
  }, [loadPayPalScript, currentUser, dispatch]);

  const handlePay = (tier: typeof tiers[0]) => {
    setPayingTier(tier);
    setError(null);
    requestAnimationFrame(() => renderPayPalButtons(tier));
  };

  if (payingTier) {
    return (
      <div className={styles.card} style={{ maxWidth: 500, margin: "0 auto", textAlign: "center" }}>
        <h3 style={{ margin: "0 0 16px 0" }}>Xác nhận nạp thẻ</h3>
        <p style={{ marginBottom: 8, fontSize: 18 }}>Gói: <strong>{payingTier.label}</strong></p>
        <p style={{ marginBottom: 24, fontSize: 24, fontWeight: "bold", color: "#10b981" }}>${payingTier.priceUsd.toFixed(2)}</p>
        {error && <div style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>}
        <div ref={paypalContainerRef} style={{ minHeight: 150 }} />
        <button className={styles.claimBtn} style={{ background: "transparent", border: "1px solid #475569", color: "#94a3b8", width: "100%" }} onClick={() => setPayingTier(null)}>
          Hủy
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Summary card */}
      <div className={styles.card} style={{ marginBottom: 32, flexDirection: "row", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1 }}>
          <div className={styles.cardDesc}>Tổng nạp trong sự kiện</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#818cf8" }}>
            💎 {userTotalTopup.toLocaleString()}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className={styles.cardDesc}>Mốc tiếp theo</div>
          {(() => {
            const next = tiers.find(t => t.min > userTotalTopup);
            return next
              ? <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>Còn {(next.min - userTotalTopup).toLocaleString()} 💎 → {next.bonus}</div>
              : <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>🎉 Đã nhận tất cả phần thưởng!</div>;
          })()}
        </div>
      </div>

      {/* Tier list */}
      <div className={styles.sectionHeader}><Gem size={24} /> Bậc Phần Thưởng Nạp</div>
      <div className={styles.topupTiers}>
        {tiers.map((tier, i) => {
          const done = userTotalTopup >= tier.min;
          return (
            <div key={i} className={`${styles.topupTier} ${done ? styles.active : ""}`}>
              <div className={styles.topupAmount} style={{ color: done ? "#34d399" : "#475569" }}>
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
                <button className={styles.claimBtn} style={{ width: "auto", padding: "8px 16px", marginLeft: 8 }} onClick={async () => {
                  if (!token) return alert("Vui lòng đăng nhập!");
                  try {
                    const res = await claimEventReward(token, event.id, `reward_${event.rewards[i]?.id}`);
                    if (currentUser && res.balances) {
                      dispatch(ProfileCommands.setCurrentUser({ ...currentUser, currencies: res.balances }));
                    }
                    alert(`🎉 Nhận thành công! Nhận: ${res.reward.gold} 🪙, ${res.reward.gems} 💎`);
                  } catch(e: any) { alert(e.message || "Lỗi"); }
                }}>
                  Nhận
                </button>
              ) : (
                <button className={styles.claimBtn} style={{ background: "#2563eb", width: "auto", padding: "8px 16px", marginLeft: 8, display: "flex", alignItems: "center", gap: 4 }} onClick={() => handlePay(tier)}>
                  <CreditCard size={16} /> Nạp ${tier.priceUsd.toFixed(2)}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <div style={{ marginTop: 32, padding: "20px 24px", background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 8 }}>
          <TrendingUp size={18} color="#818cf8" /> Lưu ý về ưu đãi nạp
        </div>
        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
          • Thanh toán an toàn qua PayPal.<br />
          • Số gem đã nạp trong sự kiện này: <strong style={{ color: "#818cf8" }}>{userTotalTopup}</strong> 💎
        </div>
      </div>
    </div>
  );
};
