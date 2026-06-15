import React, { useEffect, useState } from "react";
import { X, Clock, AlertCircle } from "lucide-react";
import styles from "./EventPage.module.css";
import { EventData } from "./types";
import { DailyLoginEvent } from "./DailyLoginEvent";
import { CompetitionEvent } from "./CompetitionEvent";
import { CoopEvent } from "./CoopEvent";
import { LuckySpinEvent } from "./LuckySpinEvent";
import { TopupBonusEvent } from "./TopupBonusEvent";
import { TaskEvent } from "./TaskEvent";

// ─── Countdown helper ─────────────────────────────────────────────────────────
function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      if (ms <= 0) { setRemaining("Đã kết thúc"); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return remaining;
}

// ─── Event type router ────────────────────────────────────────────────────────
function resolveEventType(event: EventData): string {
  // Explicit eventType field takes priority
  if (event.eventType) return event.eventType;
  // Infer from first task type
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
    case "daily_login": return <DailyLoginEvent event={event} />;
    case "competition": return <CompetitionEvent event={event} />;
    case "coop": return <CoopEvent event={event} />;
    case "lucky_spin": return <LuckySpinEvent event={event} />;
    case "topup_bonus": return <TopupBonusEvent event={event} />;
    case "task":
    case "play_games":
    case "win_games":
    default:
      return <TaskEvent event={event} />;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export const EventPage = ({ slug }: { slug: string }) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const countdown = useCountdown(event?.endsAt ?? null);

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

  const themeColor = event?.themeColor ?? "#3b82f6";
  const rootStyle = { "--tc": themeColor } as React.CSSProperties;

  if (loading) {
    return (
      <div className={styles.root} style={rootStyle}>
        <div className={styles.center}>
          <div style={{ fontSize: 40 }}>⏳</div>
          <div style={{ color: "#64748b" }}>Đang tải sự kiện…</div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={styles.root}>
        <div className={styles.center}>
          <AlertCircle size={52} color="#ef4444" />
          <div style={{ fontSize: 22, fontWeight: 800 }}>Không tìm thấy sự kiện</div>
          <div style={{ color: "#64748b", fontSize: 15 }}>{error}</div>
          <button className={styles.closeBtn} onClick={() => window.close()}>
            <X size={16} /> Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} style={rootStyle}>
      {/* Sticky header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={() => window.close()}>
          <X size={16} /> Đóng
        </button>
        <div className={styles.eventName} style={{ color: themeColor }}>{event.name}</div>
        {event.endsAt && (
          <div className={styles.countdownBadge}>
            <Clock size={14} color="#64748b" />
            {countdown}
          </div>
        )}
      </div>

      <div className={styles.content}>
        {/* Optional banner */}
        {event.bannerUrl && (
          <div className={styles.banner}>
            <img src={event.bannerUrl} alt={event.name} />
          </div>
        )}

        {/* Optional description */}
        {event.description && (
          <div className={styles.descriptionBox}>{event.description}</div>
        )}

        {/* Type-specific body */}
        <EventBody event={event} />
      </div>
    </div>
  );
};
