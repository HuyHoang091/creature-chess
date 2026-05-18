import * as React from "react";

import { useDispatch, useSelector } from "react-redux";
import { useGamemodeSettings } from "~/contexts/GamemodeSettingsContext";
import { AppState } from "~/store";

import {
	PlayerActions,
	getPlayerLevel,
	getPlayerMoney,
	getPlayerXp,
} from "@creature-chess/gamemode";
import { getXpToNextLevel } from "@creature-chess/gamemode/src/player/xp";
import { MAX_LEVEL } from "@creature-chess/models/config";

import {
	faArrowsRotate,
	faLock,
	faLockOpen,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./PlayerGameProfile.module.css";

export function PlayerGameProfile() {
	const { buyXpCost, rerollCost } = useGamemodeSettings();
	const dispatch = useDispatch();
	const ribbonMaskId = React.useId();
	const ribbonGradientId = React.useId();

	const level = useSelector<AppState, number>((state) =>
		getPlayerLevel(state.game)
	);
	const xp = useSelector<AppState, number>((state) => getPlayerXp(state.game));
	const money = useSelector<AppState, number>((state) =>
		getPlayerMoney(state.game)
	);

	const shopLocked = useSelector<AppState, boolean>(
		(state) => state.game.cardShop.locked
	);

	const onBuyXp = () => dispatch(PlayerActions.buyXpPlayerAction());
	const onReroll = () => dispatch(PlayerActions.rerollCardsPlayerAction());
	const onToggleLock = () => dispatch(PlayerActions.toggleShopLockPlayerAction());

	const xpMax = level < MAX_LEVEL ? getXpToNextLevel(level) : 1;
	const xpPercent = level < MAX_LEVEL ? (xp / xpMax) * 100 : 100;
	const [displayXpPercent, setDisplayXpPercent] = React.useState(xpPercent);
	const progressRef = React.useRef(xpPercent);
	const previousLevelRef = React.useRef(level);

	React.useEffect(() => {
		const levelChanged = previousLevelRef.current !== level;
		const start = levelChanged ? 0 : progressRef.current;
		const end = xpPercent;
		const durationMs = 900;
		let animationFrame = 0;

		if (levelChanged) {
			progressRef.current = 0;
			setDisplayXpPercent(0);
		}

		const animate = (now: number, startedAt: number) => {
			const elapsed = now - startedAt;
			const progress = Math.min(elapsed / durationMs, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			const nextValue = start + (end - start) * eased;

			progressRef.current = nextValue;
			setDisplayXpPercent(nextValue);

			if (progress < 1) {
				animationFrame = requestAnimationFrame((nextNow) =>
					animate(nextNow, startedAt)
				);
			}
		};

		if (Math.abs(end - start) < 0.1) {
			progressRef.current = end;
			setDisplayXpPercent(end);
			previousLevelRef.current = level;
			return;
		}

		animationFrame = requestAnimationFrame((now) => animate(now, now));
		previousLevelRef.current = level;

		return () => cancelAnimationFrame(animationFrame);
	}, [level, xpPercent]);

	return (
		<div className={styles.profile}>
			<div className={styles.levelSection}>
				<div className={styles.levelRing}>
					<svg
						className={styles.levelRingRibbon}
						viewBox="0 0 100 100"
						aria-hidden="true"
					>
						<defs>
							<linearGradient
								id={ribbonGradientId}
								x1="18"
								y1="16"
								x2="82"
								y2="84"
								gradientUnits="userSpaceOnUse"
							>
								<stop offset="0%" stopColor="#49b9b1" />
								<stop offset="58%" stopColor="#2f8f93" />
								<stop offset="100%" stopColor="#215f6d" />
							</linearGradient>
							<mask id={ribbonMaskId}>
								<circle
									className={styles.levelRibbonMask}
									cx="50"
									cy="50"
									r="44"
									pathLength={100}
									strokeDasharray={`${displayXpPercent} 100`}
								/>
							</mask>
						</defs>

						<circle
							className={styles.levelTrackBase}
							cx="50"
							cy="50"
							r="44"
							pathLength={100}
						/>
						<circle
							className={styles.levelTrackFill}
							cx="50"
							cy="50"
							r="44"
							pathLength={100}
							stroke={`url(#${ribbonGradientId})`}
							strokeDasharray={`${displayXpPercent} 100`}
						/>

						<g mask={`url(#${ribbonMaskId})`}>
							<circle
								className={styles.levelRibbonGlow}
								cx="50"
								cy="50"
								r="44"
								pathLength={100}
							/>
							<circle
								className={styles.levelRibbonFlow}
								cx="50"
								cy="50"
								r="44"
								pathLength={100}
							/>
							<circle
								className={styles.levelRibbonSpark}
								cx="50"
								cy="50"
								r="44"
								pathLength={100}
							/>
						</g>
					</svg>
					<div className={styles.levelCore}>
						<span className={styles.levelNumber}>{level}</span>
						<span className={styles.levelLabel}>Level</span>
					</div>
				</div>

				<span className={styles.xpText}>
					{level < MAX_LEVEL ? `${xp}/${xpMax} XP` : "MAX LEVEL"}
				</span>
			</div>

			<div className={styles.goldDisplay}>
				<span className={styles.goldIcon}>Gold</span>
				<span>{money}</span>
			</div>

			<div className={styles.buttonsRow}>
				{level < MAX_LEVEL && (
					<button
						className={styles.btn}
						onClick={onBuyXp}
						disabled={money < buyXpCost}
					>
						<span>Buy XP</span>
						<span className={styles.btnCost}>${buyXpCost}</span>
					</button>
				)}

				<button
					className={`${styles.btn} ${styles.btnReroll}`}
					onClick={onReroll}
					disabled={money < rerollCost}
				>
					<FontAwesomeIcon icon={faArrowsRotate} />
					<span className={styles.btnCost}>${rerollCost}</span>
				</button>

				<button
					className={`${styles.btn} ${shopLocked ? styles.btnLock : ""}`}
					onClick={onToggleLock}
				>
					<FontAwesomeIcon icon={shopLocked ? faLock : faLockOpen} />
				</button>
			</div>
		</div>
	);
}
