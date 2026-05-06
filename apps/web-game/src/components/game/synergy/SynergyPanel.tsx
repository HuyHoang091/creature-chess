import * as React from "react";

import { useSelector } from "react-redux";
import { useLocalPlayerId } from "~/auth/context";
import { AppState } from "~/store";

import { BoardSelectors } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";
import styles from "./SynergyPanel.module.css";

// Bạn cần types từ models. Nếu chưa có synergy data trong store,
// component này sẽ tính toán dựa trên pieces đang có trên board.
// Đây là component mẫu, cần tùy chỉnh theo data thực tế.

// Tính synergies từ các piece (mẫu - tuỳ chỉnh theo data thực)
function computeSynergies(pieces: PieceModel[]): {
    name: string;
    icon: string;
    current: number;
    thresholds: number[];
}[] {
    // Group pieces by class/type
    const typeMap: Record<string, Set<number>> = {};

    pieces.forEach((p) => {
        const typeName = p.definition?.traits.toString();
        const className = p.definition?.traits.toString();

        if (typeName) {
            if (!typeMap[typeName]) typeMap[typeName] = new Set();
            typeMap[typeName].add(p.definitionId);
        }
        if (className) {
            if (!typeMap[className]) typeMap[className] = new Set();
            typeMap[className].add(p.definitionId);
        }
    });

    // Tạo danh sách synergy
    const icons: Record<string, string> = {
        // Fallback icons - customize per your game's types
    };

    const defaultIcons = ["🔥", "💧", "🌿", "⚡", "💀", "🛡️", "⚔️", "🌙", "☀️", "❄️"];
    let iconIdx = 0;

    return Object.entries(typeMap)
        .map(([name, ids]) => ({
            name,
            icon: icons[name] || defaultIcons[iconIdx++ % defaultIcons.length],
            current: ids.size,
            thresholds: [2, 4, 6], // Thresholds mẫu
        }))
        .filter((s) => s.current > 0)
        .sort((a, b) => b.current - a.current);
}

function getTierClass(
    current: number,
    thresholds: number[]
): string {
    const sorted = [...thresholds].sort((a, b) => a - b);
    if (current >= (sorted[3] || Infinity)) return styles.tierChromatic;
    if (current >= (sorted[2] || Infinity)) return styles.tierGold;
    if (current >= (sorted[1] || Infinity)) return styles.tierSilver;
    if (current >= (sorted[0] || Infinity)) return styles.tierBronze;
    return "";
}

export function SynergyPanel() {
    const localPlayerId = useLocalPlayerId();
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

    const pieces = useSelector<AppState, PieceModel[]>((state) =>
        [...BoardSelectors.getAllPieces(state.game.board)].filter(
            (p) => p.ownerId === localPlayerId
        )
    );

    const synergies = React.useMemo(() => computeSynergies(pieces), [pieces]);

    if (synergies.length === 0) {
        return (
            <div className={styles.panel}>
                <span style={{ fontSize: "10px", color: "#463714", textAlign: "center" }}>
                    No synergies
                </span>
            </div>
        );
    }

    return (
        <div className={styles.panel}>
            {synergies.map((syn, idx) => {
                const tierClass = getTierClass(syn.current, syn.thresholds);

                return (
                    <div
                        key={syn.name}
                        className={`${styles.synergyItem} ${tierClass}`}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                    >
                        <span className={styles.icon}>{syn.icon}</span>
                        <span className={styles.countBadge}>
                            {syn.current}
                        </span>

                        {hoveredIdx === idx && (
                            <div className={styles.tooltip}>
                                <strong>{syn.name}</strong> — {syn.current}/{syn.thresholds.join("/")}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
