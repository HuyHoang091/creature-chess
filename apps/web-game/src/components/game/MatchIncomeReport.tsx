import * as React from "react";

import classNames from "classnames";
import { BalanceIcon } from "~/components/ui/icon/BalanceIcon";

import { PlayerMatchRewards } from "@creature-chess/gamemode";
import styles from "./MatchIncomeReport.module.css";

type Props = {
	rewards: PlayerMatchRewards;
	className?: string;
};

export function MatchIncomeReport({ rewards, className }: Props) {
	const {
		rewardMoney: { total, base, winBonus, streakBonus, interest },
	} = rewards;

	const rows = [
		{ label: "Base", amount: base },
		{ label: "Win Bonus", amount: winBonus },
		{ label: "Streak Bonus", amount: streakBonus },
		{ label: "Interest", amount: interest },
	];

	return (
		<div className={classNames(styles.root, className)}>
			<div className={styles.total}>
				<span className={styles.totalLabel}>Total Earned</span>
				<BalanceIcon amount={total} className={styles.totalValue} />
			</div>
			<div className={styles.incomeTable}>
				{rows.map((row) => (
					<React.Fragment key={row.label}>
						<div className={styles.incomeLabel}>{row.label}</div>
						<BalanceIcon amount={row.amount} className={styles.incomeValue} />
					</React.Fragment>
				))}
			</div>
		</div>
	);
}
