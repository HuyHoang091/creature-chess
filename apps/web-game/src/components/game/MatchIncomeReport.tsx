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

	return (
		<div className={classNames(styles.root, className)}>
			<div className={styles.total}>
				<BalanceIcon amount={total} />
				<span>earned</span>
			</div>
			<div className={styles.incomeTable}>
				<div>base</div>
				<div>
					<BalanceIcon amount={base} />
				</div>
				<div>win bonus</div>
				<div>
					<BalanceIcon amount={winBonus} />
				</div>
				<div>streak bonus</div>
				<div>
					<BalanceIcon amount={streakBonus} />
				</div>
				<div>interest (10%)</div>
				<div>
					<BalanceIcon amount={interest} />
				</div>
			</div>
		</div>
	);
}
