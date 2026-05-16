import * as React from "react";
import { createPortal } from "react-dom";
import { lookupPieceId, lookupPieceInfo } from "./pieceNameMap";
import { lookupItemById, lookupItemByName, getRecipeFor } from "./itemDataMap";
import { lookupTrait } from "./traitDataMap";
import styles from "./tactical-ai.module.css";

function getPieceImageUrl(definitionId: number): string {
  return `${APP_IMAGE_ROOT}/creatures/front/${definitionId}.png`;
}

function getTraitIconUrl(traitId: string): string {
  return `${APP_IMAGE_ROOT}/ui/traits/trait-${traitId}.svg`;
}

const COST_COLORS: Record<number, string> = {
  1: "#808080",
  2: "#11b128",
  3: "#207ac9",
  4: "#b82ee6",
  5: "#ffd700",
};

// ─── segment types ────────────────────────────────────────────────────

type Segment =
  | { type: "text"; value: string }
  | { type: "piece"; name: string; definitionId: number | null }
  | { type: "item"; itemId: string; name: string | null; icon: string | null; tier: number | null; desc: string | null }
  | { type: "trait"; name: string; traitId: string | null; iconUrl: string | null; nameVi: string | null };

// ─── parsers ──────────────────────────────────────────────────────────

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\[(piece|item|trait):([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const tagType = match[1];
    const tagValue = match[2].trim();

    if (tagType === "piece") {
      const defId = lookupPieceId(tagValue);
      segments.push({ type: "piece", name: tagValue, definitionId: defId });
    } else if (tagType === "item") {
      const byId = lookupItemById(tagValue.toUpperCase());
      const byName = lookupItemByName(tagValue);
      const item = byId || byName;
      segments.push({
        type: "item",
        itemId: tagValue,
        name: item?.name ?? tagValue,
        icon: item?.icon ?? null,
        tier: item?.tier ?? null,
        desc: item?.description ?? null,
      });
    } else if (tagType === "trait") {
      const trait = lookupTrait(tagValue);
      segments.push({
        type: "trait",
        name: tagValue,
        traitId: trait?.id ?? null,
        iconUrl: trait?.iconUrl ?? null,
        nameVi: trait?.nameVi ?? null,
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return autoDetectTraits(segments);
}

// ─── auto-detect trait mentions in plain text ────────────────────────

const TRAIT_KEYWORDS = [
  "fire", "water", "earth", "wood", "metal", "valiant", "arcane", "cunning",
  "Hỏa", "Thủy", "Thổ", "Mộc", "Kim", "Dũng", "Phép", "Xảo",
];

const TRAIT_REGEX = new RegExp(
  "\\b(" + TRAIT_KEYWORDS.sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|") + ")\\b",
  "gi"
);

function autoDetectTraits(segments: Segment[]): Segment[] {
  const result: Segment[] = [];

  for (const seg of segments) {
    if (seg.type !== "text") {
      result.push(seg);
      continue;
    }

    const text = seg.value;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    TRAIT_REGEX.lastIndex = 0;

    while ((m = TRAIT_REGEX.exec(text)) !== null) {
      if (m.index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, m.index) });
      }
      const matched = m[0];
      const trait = lookupTrait(matched);
      if (trait) {
        result.push({
          type: "trait",
          name: matched,
          traitId: trait.id,
          iconUrl: trait.iconUrl,
          nameVi: trait.nameVi,
        });
      } else {
        result.push({ type: "text", value: matched });
      }
      lastIndex = TRAIT_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) });
    }
  }

  return result;
}

interface Section {
  title: string;
  segments: Segment[];
}

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  const lines = text.split("\n");
  let currentTitle = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentBody.length > 0 || currentTitle) {
        sections.push({ title: currentTitle, segments: parseSegments(currentBody.join("\n").trim()) });
      }
      currentTitle = headerMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentBody.length > 0 || currentTitle) {
    sections.push({ title: currentTitle, segments: parseSegments(currentBody.join("\n").trim()) });
  }

  return sections;
}

function formatStatLine(stats: { attack?: number; defense?: number; hp?: number; speed?: number; mana?: number }): string {
  const parts: string[] = [];
  if (stats.attack)  parts.push(`⚔ ATK +${stats.attack}`);
  if (stats.defense) parts.push(`🛡 DEF +${stats.defense}`);
  if (stats.hp)      parts.push(`❤ HP +${stats.hp}`);
  if (stats.speed)   parts.push(`⚡ SPD +${stats.speed}`);
  if (stats.mana)    parts.push(`💧 Mana +${stats.mana}`);
  return parts.join("  ");
}

// ─── tooltips with portal ─────────────────────────────────────────────

const TooltipPortal: React.FC<{ anchor: HTMLElement | null; children: React.ReactNode }> = ({ anchor, children }) => {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    if (!anchor) { setPos(null); return; }
    const rect = anchor.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [anchor]);

  if (!pos) return null;

  return createPortal(
    <div
      className={styles.tooltip}
      style={{
        position: "fixed",
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 99999,
        pointerEvents: "none",
        animation: "none",
      }}
    >
      {children}
    </div>,
    document.body
  );
};

const PieceTooltip: React.FC<{ definitionId: number; name: string }> = ({ definitionId, name }) => {
  const info = lookupPieceInfo(definitionId);
  if (!info) return null;
  const borderColor = COST_COLORS[info.cost] || "#808080";

  return (
    <div className={styles.tooltipInner} style={{ borderColor }}>
      <div className={styles.tooltipPieceImgWrap} style={{ borderColor }}>
        <img className={styles.tooltipPieceImg} src={getPieceImageUrl(definitionId)} alt={name} />
        <span className={styles.tooltipCostBadge} style={{ background: borderColor }}>{info.cost}</span>
      </div>
      <div className={styles.tooltipPieceName}>{name}</div>
      <div className={styles.tooltipTraits}>
        {info.traits.map((t) => (
          <span key={t} className={styles.tooltipTraitRow}>
            <img className={styles.tooltipTraitIcon} src={getTraitIconUrl(t)} alt={t} />
            <span>{t}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const ItemTooltip: React.FC<{ itemId: string; tier: number | null }> = ({ itemId, tier }) => {
  const item = lookupItemById(itemId.toUpperCase()) || lookupItemByName(itemId);
  if (!item) return null;

  const recipe = getRecipeFor(item.id);

  return (
    <div className={styles.tooltipInner}>
      <div className={styles.tooltipItemHeader}>
        <span className={styles.tooltipItemIcon}>{item.icon}</span>
        <span className={styles.tooltipItemName}>{item.name}</span>
        {tier ? <span className={styles.itemBadgeTier}>T{tier}</span> : null}
      </div>
      <div className={styles.tooltipStats}>{formatStatLine(item.stats)}</div>
      {item.description ? <div className={styles.tooltipDesc}>{item.description}</div> : null}
      {recipe ? (
        <div className={styles.tooltipRecipe}>
          <div className={styles.tooltipRecipeLabel}>Ghép từ:</div>
          <div className={styles.tooltipRecipeRow}>
            <span className={styles.tooltipRecipeItem}>
              <span>{recipe[0].icon}</span> {recipe[0].name}
            </span>
            <span className={styles.tooltipRecipePlus}>+</span>
            <span className={styles.tooltipRecipeItem}>
              <span>{recipe[1].icon}</span> {recipe[1].name}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const WithTooltip: React.FC<{ tooltip: React.ReactNode; children: React.ReactNode }> = ({ tooltip, children }) => {
  const [show, setShow] = React.useState(false);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(true);
  };
  const onLeave = () => {
    timeoutRef.current = setTimeout(() => setShow(false), 200);
  };

  return (
    <span
      ref={anchorRef}
      className={styles.tooltipAnchor}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onTouchStart={(e) => { e.stopPropagation(); onEnter(); }}
      onTouchEnd={(e) => { e.stopPropagation(); setTimeout(() => onLeave(), 1500); }}
    >
      {children}
      {show ? <TooltipPortal anchor={anchorRef.current}>{tooltip}</TooltipPortal> : null}
    </span>
  );
};

// ─── inline segments ──────────────────────────────────────────────────

const InlineSegments: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.value}</span>;
        }
        if (seg.type === "piece") {
          const info = seg.definitionId ? lookupPieceInfo(seg.definitionId) : null;
          const costColor = info ? COST_COLORS[info.cost] : undefined;
          const badge = (
            <span className={styles.pieceBadge}>
              {seg.definitionId ? (
                <img
                  className={styles.pieceBadgeImg}
                  style={costColor ? { borderColor: costColor, borderWidth: 2, borderStyle: "solid" } : undefined}
                  src={getPieceImageUrl(seg.definitionId)}
                  alt={seg.name}
                />
              ) : null}
              <span className={styles.pieceBadgeName}>{seg.name}</span>
            </span>
          );
          if (seg.definitionId) {
            return (
              <WithTooltip key={i} tooltip={<PieceTooltip definitionId={seg.definitionId} name={seg.name} />}>
                {badge}
              </WithTooltip>
            );
          }
          return <React.Fragment key={i}>{badge}</React.Fragment>;
        }
        if (seg.type === "item") {
          const badge = (
            <span className={styles.itemBadge}>
              {seg.icon ? <span className={styles.itemBadgeIcon}>{seg.icon}</span> : null}
              <span className={styles.itemBadgeName}>{seg.name}</span>
              {seg.tier ? <span className={styles.itemBadgeTier}>T{seg.tier}</span> : null}
            </span>
          );
          return (
            <WithTooltip key={i} tooltip={<ItemTooltip itemId={seg.itemId} tier={seg.tier} />}>
              {badge}
            </WithTooltip>
          );
        }
        if (seg.type === "trait") {
          return (
            <span key={i} className={styles.traitBadge}>
              {seg.iconUrl ? <img className={styles.traitBadgeIcon} src={seg.iconUrl} alt={seg.name} /> : null}
              <span className={styles.traitBadgeName}>{seg.nameVi || seg.name}</span>
            </span>
          );
        }
        return null;
      })}
    </>
  );
};

// ─── section card ─────────────────────────────────────────────────────

const SectionCard: React.FC<{ section: Section }> = ({ section }) => (
  <div className={styles.sectionCard}>
    {section.title ? <div className={styles.sectionTitle}>{section.title}</div> : null}
    <div className={styles.sectionBody}>
      <InlineSegments segments={section.segments} />
    </div>
  </div>
);

// ─── main renderer ────────────────────────────────────────────────────

interface CoachMessageRendererProps {
  text: string;
}

export const CoachMessageRenderer: React.FC<CoachMessageRendererProps> = ({ text }) => {
  const sections = parseSections(text);

  if (sections.length === 0 || (sections.length === 1 && !sections[0].title)) {
    const segments = parseSegments(text);
    const hasTags = segments.some((s) => s.type !== "text");
    if (!hasTags) {
      return <>{text}</>;
    }
    return (
      <div className={styles.sectionCardSingle}>
        <InlineSegments segments={segments} />
      </div>
    );
  }

  return (
    <div className={styles.sectionCards}>
      {sections.map((section, i) => (
        <SectionCard key={i} section={section} />
      ))}
    </div>
  );
};
