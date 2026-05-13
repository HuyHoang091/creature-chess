import * as React from "react";
import { BattleAnalysis } from "~/services/tacticalAI";
import styles from "./tactical-ai.module.css";

interface Props {
  analysis: BattleAnalysis | null;
  onClose: () => void;
}

const BattleReportOverlay: React.FC<Props> = ({ analysis, onClose }) => {
  if (!analysis) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.reportCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.reportHeader}>
          <h2>📊 Battle Analysis</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.summaryBox}>
          <strong>Kết quả:</strong>{" "}
          {analysis.winner === "win" ? (
            <span className={styles.win}>Thắng</span>
          ) : analysis.winner === "loss" ? (
            <span className={styles.loss}>Thua</span>
          ) : (
            <span className={styles.draw}>Hòa</span>
          )}
          <p>{analysis.summary}</p>
        </div>

        {analysis.issues.length > 0 && (
          <div className={styles.section}>
            <h3>⚠️ Issues</h3>
            {analysis.issues.map((issue, i) => (
              <div key={i} className={styles[`issue_${issue.severity}`]}>
                <strong>[{issue.severity.toUpperCase()}]</strong> {issue.description}
                <div className={styles.suggestion}>💡 {issue.suggestion}</div>
              </div>
            ))}
          </div>
        )}

        {analysis.recommendations.length > 0 && (
          <div className={styles.section}>
            <h3>📋 Recommendations</h3>
            {analysis.recommendations.map((rec, i) => (
              <div key={i} className={styles.recommendation}>
                <span className={styles.recCategory}>[{rec.category}]</span> {rec.description}
              </div>
            ))}
          </div>
        )}

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{analysis.stats.totalDamageDealt}</div>
            <div className={styles.statLabel}>Damage Dealt</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{analysis.stats.totalDamageTaken}</div>
            <div className={styles.statLabel}>Damage Taken</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{analysis.stats.avgTurnsSurvived.toFixed(1)}</div>
            <div className={styles.statLabel}>Avg Turns</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{(analysis.stats.carryDamageShare * 100).toFixed(0)}%</div>
            <div className={styles.statLabel}>Carry Dmg %</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { BattleReportOverlay };
