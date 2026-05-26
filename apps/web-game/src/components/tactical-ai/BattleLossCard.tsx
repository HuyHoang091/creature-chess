import * as React from "react";
import { BattleAnalysis } from "~/services/tacticalAI";
import styles from "./tactical-ai.module.css";

interface Props {
	analysis: BattleAnalysis;
	onOpen: () => void;
	onDismiss: () => void;
}

const BattleLossCard: React.FC<Props> = ({ analysis, onOpen, onDismiss }) => (
	<div className={styles.lossCard} role="status" aria-live="polite">
		<button
			type="button"
			className={styles.lossCardMain}
			onClick={onOpen}
			aria-label="Xem lý do thua"
		>
			<span className={styles.lossCardKicker}>Tactical AI</span>
			<span className={styles.lossCardTitle}>Xem lý do thua</span>
			<span className={styles.lossCardSummary}>{analysis.summary}</span>
		</button>
		<button
			type="button"
			className={styles.lossCardClose}
			onClick={onDismiss}
			aria-label="Ẩn phân tích thua"
		>
			x
		</button>
	</div>
);

export { BattleLossCard };
