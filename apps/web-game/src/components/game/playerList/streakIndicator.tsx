import React, { useEffect, useRef } from "react";

import { StreakType } from "@creature-chess/models/player";
import styles from "./StreakIndicator.module.css";

type Props = {
	type: StreakType | null;
	amount: number | null;
};

const getBackground = (type: StreakType | null) =>
	type === StreakType.WIN ? "#38b764" : "#b13e53";

export function StreakIndicator(props: Props) {
	const sheenRef = useRef<HTMLDivElement | null>(null);

	// apply sheen effect when streak amount changes
	useEffect(() => {
		if (sheenRef.current) {
			sheenRef.current.style.transition = "none";
			sheenRef.current.style.left = "-100%";
			sheenRef.current.style.top = "-125%";
			// Force a reflow to reset the transition
			void sheenRef.current.offsetWidth;

			sheenRef.current.style.transition =
				"left 1s ease-in-out, top 1s ease-in-out";
			sheenRef.current.style.left = "100%";
			sheenRef.current.style.top = "75%";

			const timer = setTimeout(() => {
				if (sheenRef.current) {
					sheenRef.current.style.transition = "none";
					sheenRef.current.style.left = "-100%";
					sheenRef.current.style.top = "-125%";
				}
			}, 1000);

			return () => {
				clearTimeout(timer);
			};
		}
	}, [props.amount]);

	if (props.type === null || !props.amount || props.amount === 1) {
		return <div className={styles.spacer} />;
	}

	return (
		<div className={styles.indicator} style={{ background: getBackground(props.type) }}>
			<div className={styles.sheen} ref={sheenRef} />
			<span className={styles.amount}>{props.amount}</span>
		</div>
	);
}
