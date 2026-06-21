import React, { useEffect, useState } from "react";
import { X, Clock, AlertCircle, Coins, Gem } from "lucide-react";
import { useSelector } from "react-redux";
import styles from "./EventPage.module.css";
import { EventData } from "./types";
import { DailyLoginEvent } from "./DailyLoginEvent";
import { CompetitionEvent } from "./CompetitionEvent";
import { CoopEvent } from "./CoopEvent";
import { LuckySpinEvent } from "./LuckySpinEvent";
import { TopupBonusEvent } from "./TopupBonusEvent";
import { TaskEvent } from "./TaskEvent";
import { AppState } from "../../store/state";

// ─── Countdown helper ─────────────────────────────────────────────────────────
function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState("");
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number }>({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) { setRemaining("Đã kết thúc"); setParts({ d: 0, h: 0, m: 0, s: 0 }); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setParts({ d, h, m, s });
      setRemaining(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return { remaining, parts };
}

// ─── Event type router ────────────────────────────────────────────────────────
function resolveEventType(event: EventData): string {
  if (event.eventType) return event.eventType;
  if (event.tasks.length > 0) {
    const t = event.tasks[0].type;
    if (t === "daily_login") return "daily_login";
    if (t === "competition") return "competition";
    if (t === "coop") return "coop";
    if (t === "lucky_spin") return "lucky_spin";
    if (t === "topup_bonus") return "topup_bonus";
    if (t === "play_games" || t === "win_games" || t === "custom") return "task";
  }
  return "generic";
}

function EventBody({ event }: { event: EventData }) {
  const type = resolveEventType(event);
  switch (type) {
    case "daily_login":  return <DailyLoginEvent event={event} />;
    case "competition":  return <CompetitionEvent event={event} />;
    case "coop":         return <CoopEvent event={event} />;
    case "lucky_spin":   return <LuckySpinEvent event={event} />;
    case "topup_bonus":  return <TopupBonusEvent event={event} />;
    case "task":
    case "play_games":
    case "win_games":
    default:
      return <TaskEvent event={event} />;
  }
}

// ─── Ornamental corner bracket ───────────────────────────────────────────────
const CornerBracket: React.FC<{ position: "tl" | "tr" | "bl" | "br" }> = ({ position }) => (
  <div className={`${styles.corner} ${styles[position]}`} />
);

// ─── Main page ────────────────────────────────────────────────────────────────
export const EventPage = ({ slug }: { slug: string }) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { remaining, parts } = useCountdown(event?.endsAt ?? null);
  const currentUser = useSelector((state: AppState) => state.profile.currentUser);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${APP_API_URL}/events/public/${slug}`);
        if (!res.ok) throw new Error("Sự kiện không tìm thấy hoặc đã kết thúc.");
        const data = await res.json();
        setEvent(data.event);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const themeColor = event?.themeColor ?? "#c8aa6e";
  const rootStyle = { "--tc": themeColor } as React.CSSProperties;
  const gold = currentUser?.currencies?.gold ?? 0;
  const gems = currentUser?.currencies?.gems ?? 0;

  if (loading) {
    return (
      <div className={styles.root} style={rootStyle}>
        <div className={styles.center}>
          <div className={styles.loadingSpinner} />
          <div className={styles.loadingText}>Đang tải sự kiện…</div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={styles.root} style={rootStyle}>
        <div className={styles.center}>
          <AlertCircle size={52} color="#ff9aa9" strokeWidth={1.5} />
          <div className={styles.errorTitle}>Không tìm thấy sự kiện</div>
          <div className={styles.errorDesc}>{error}</div>
          <button className={styles.closeBtn} onClick={() => window.close()}>
            <X size={15} /> Đóng
          </button>
        </div>
      </div>
    );
  }

  const hasCountdown = event.endsAt && parts.d + parts.h + parts.m + parts.s > 0;
  const timeUnits = [
    { label: "Ngày", value: parts.d },
    { label: "Giờ", value: parts.h },
    { label: "Phút", value: parts.m },
    { label: "Giây", value: parts.s },
  ];

  return (
    <div className={styles.root} style={rootStyle}>
      {/* Sticky header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={() => window.close()}>
          <X size={14} /> Đóng
        </button>
        <div className={styles.eventName}>{event.name}</div>
        {/* Currency display */}
        <div className={styles.currencyBar}>
          <div className={styles.currencyItem}>
            <Coins size={14} />
            <span>{gold.toLocaleString()}</span>
          </div>
          <div className={styles.currencyDivider} />
          <div className={styles.currencyItem}>
            <Gem size={14} />
            <span>{gems.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* HERO SECTION — cinematic banner with overlay */}
      <div className={styles.hero}>
        {/* Background image */}
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt={event.name} className={styles.heroBg} />
        ) : (
          <div className={styles.heroBgFallback} />
        )}
        {/* Gradient overlay */}
        <div className={styles.heroOverlay} />

        {/* Ornamental corners */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        {/* Hero content */}
        <div className={styles.heroContent}>
          <div className={styles.eventBadge}>⚡ SỰ KIỆN ĐANG DIỄN RA</div>
          <h1 className={styles.heroTitle}>{event.name}</h1>
          {event.description && (
            <p className={styles.heroSubtitle}>
              {event.description.length > 120
                ? event.description.slice(0, 120) + "…"
                : event.description}
            </p>
          )}

          {/* Countdown timer */}
          {hasCountdown && (
            <div className={styles.countdownRow}>
              <div className={styles.countdownLabel}>
                <Clock size={13} /> Kết thúc sau
              </div>
              <div className={styles.countdownDigits}>
                {timeUnits.map((u, i) => (
                  <React.Fragment key={u.label}>
                    <div className={styles.timeBlock}>
                      <span className={styles.timeNum}>{String(u.value).padStart(2, "0")}</span>
                      <span className={styles.timeUnit}>{u.label}</span>
                    </div>
                    {i < timeUnits.length - 1 && <span className={styles.timeColon}>:</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Full description (if longer than hero subtitle) */}
        {event.description && event.description.length > 120 && (
          <div className={styles.descriptionBox}>{event.description}</div>
        )}

        {/* Type-specific body */}
        <EventBody event={event} />
      </div>
    </div>
  );
};
