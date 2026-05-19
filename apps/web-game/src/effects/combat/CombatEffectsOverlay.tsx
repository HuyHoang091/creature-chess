import * as React from "react";

import classNames from "classnames";

import { BoardState } from "@shoki/board";

import { PieceModel } from "@creature-chess/models";

import {
	getHexTileBounds,
	getHexTileCenter,
} from "~/components/game/board/hexLayout";

import styles from "./CombatEffectsOverlay.module.css";

export type LinkVariant =
	| "lightning"
	| "lifesteal"
	| "thorns"
	| "beam"
	| "slash"
	| "ember"
	| "healStream";
export type AuraVariant =
	| "charge"
	| "healCaster"
	| "healTarget"
	| "buffSelf"
	| "slow"
	| "revive"
	| "burn"
	| "quakeField"
	| "dodge"
	| "laserCharge";
export type ImpactVariant =
	| "lightning"
	| "skillHit"
	| "hitFlash"
	| "thorns"
	| "revive"
	| "fire"
	| "quake"
	| "slash"
	| "laser"
	| "dodge";
export type FloatingTone = "neutral" | "ice" | "gold" | "warning";

type BaseEffect = {
	id: string;
	delayMs: number;
	durationMs: number;
};

export type CombatLinkEffect = BaseEffect & {
	kind: "link";
	variant: LinkVariant;
	fromId: string;
	toId: string;
};

export type CombatAuraEffect = BaseEffect & {
	kind: "aura";
	variant: AuraVariant;
	pieceId: string;
	scale?: number;
};

export type CombatImpactEffect = BaseEffect & {
	kind: "impact";
	variant: ImpactVariant;
	pieceId: string;
	scale?: number;
};

export type CombatFloatingTextEffect = {
	id: string;
	kind: "floatingText";
	variant: "damage" | "skillDamage" | "heal" | "label";
	pieceId: string;
	text: string;
	delayMs: number;
	durationMs?: number;
	driftX?: number;
	driftY?: number;
	tone?: FloatingTone;
};

export type CombatPlusBurstEffect = BaseEffect & {
	kind: "plusBurst";
	pieceId: string;
};

export type CombatEffect =
	| CombatLinkEffect
	| CombatAuraEffect
	| CombatImpactEffect
	| CombatFloatingTextEffect
	| CombatPlusBurstEffect;

type Props = {
	board: BoardState<PieceModel>;
	effects: CombatEffect[];
};

const parsePosition = (position: string) => {
	const [x, y] = position.split(",").map((value) => parseInt(value, 10));
	return { x, y };
};

const hashString = (value: string): number =>
	Array.from(value).reduce(
		(hash, character) => (hash * 33 + character.charCodeAt(0)) >>> 0,
		5381
	);

const createSeededRandom = (seed: number) => {
	let current = seed >>> 0;

	return () => {
		current = (current * 1664525 + 1013904223) >>> 0;
		return current / 0xffffffff;
	};
};

const buildJaggedPath = (
	from: { x: number; y: number },
	to: { x: number; y: number },
	seed: number
) => {
	const random = createSeededRandom(seed);
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const distance = Math.hypot(dx, dy) || 1;
	const normal = { x: -dy / distance, y: dx / distance };
	const points = [from];

	for (let index = 1; index <= 4; index++) {
		const t = index / 5;
		const bias = 1 - Math.abs(0.5 - t) * 1.6;
		const swing = (random() - 0.5) * 7 * bias;
		points.push({
			x: from.x + dx * t + normal.x * swing,
			y: from.y + dy * t + normal.y * swing,
		});
	}

	points.push(to);

	return points.reduce(
		(path, point, index) =>
			`${path}${index === 0 ? "M" : " L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
		""
	);
};

const buildCurvedPath = (
	from: { x: number; y: number },
	to: { x: number; y: number },
	lift: number
) => {
	const controlX = (from.x + to.x) / 2;
	const controlY = Math.min(from.y, to.y) - lift;

	return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${controlX.toFixed(
		2
	)} ${controlY.toFixed(2)}, ${controlX.toFixed(2)} ${controlY.toFixed(
		2
	)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
};

const buildStraightPath = (
	from: { x: number; y: number },
	to: { x: number; y: number }
) => `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} L ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;

const buildPathForLink = (
	effect: CombatLinkEffect,
	from: { x: number; y: number },
	to: { x: number; y: number }
) => {
	if (effect.variant === "beam") {
		return buildStraightPath(from, to);
	}

	if (
		effect.variant === "lifesteal" ||
		effect.variant === "thorns" ||
		effect.variant === "healStream"
	) {
		return buildCurvedPath(from, to, 7);
	}

	if (effect.variant === "slash" || effect.variant === "ember") {
		return buildCurvedPath(from, to, 3.5);
	}

	return buildJaggedPath(
		from,
		to,
		hashString(`${effect.id}-${effect.variant}-${effect.fromId}-${effect.toId}`)
	);
};

const getAuraClass = (variant: AuraVariant) => {
	switch (variant) {
		case "charge":
			return styles.auraCharge;
		case "healCaster":
			return styles.auraHealCaster;
		case "healTarget":
			return styles.auraHealTarget;
		case "buffSelf":
			return styles.auraBuffSelf;
		case "slow":
			return styles.auraSlow;
		case "revive":
			return styles.auraRevive;
		case "burn":
			return styles.auraBurn;
		case "quakeField":
			return styles.auraQuakeField;
		case "dodge":
			return styles.auraDodge;
		case "laserCharge":
			return styles.auraLaserCharge;
	}
};

const getImpactClass = (variant: ImpactVariant) => {
	switch (variant) {
		case "lightning":
			return styles.impactLightning;
		case "skillHit":
			return styles.impactSkillHit;
		case "hitFlash":
			return styles.impactHitFlash;
		case "thorns":
			return styles.impactThorns;
		case "revive":
			return styles.impactRevive;
		case "fire":
			return styles.impactFire;
		case "quake":
			return styles.impactQuake;
		case "slash":
			return styles.impactSlash;
		case "laser":
			return styles.impactLaser;
		case "dodge":
			return styles.impactDodge;
	}
};

const getFloatingTextClass = (
	variant: CombatFloatingTextEffect["variant"]
) => {
	switch (variant) {
		case "damage":
			return styles.floatingDamage;
		case "skillDamage":
			return styles.floatingSkillDamage;
		case "heal":
			return styles.floatingHeal;
		case "label":
			return styles.floatingLabel;
	}
};

const getFloatingToneClass = (tone?: FloatingTone) => {
	switch (tone) {
		case "ice":
			return styles.floatingToneIce;
		case "gold":
			return styles.floatingToneGold;
		case "warning":
			return styles.floatingToneWarning;
		case "neutral":
		default:
			return styles.floatingToneNeutral;
	}
};

const getLinkClasses = (variant: LinkVariant) => {
	switch (variant) {
		case "lightning":
			return {
				glow: styles.linkLightningGlow,
				core: styles.linkLightningCore,
			};
		case "lifesteal":
			return {
				glow: styles.linkLifestealGlow,
				core: styles.linkLifestealCore,
			};
		case "thorns":
			return {
				glow: styles.linkThornsGlow,
				core: styles.linkThornsCore,
			};
		case "beam":
			return {
				glow: styles.linkBeamGlow,
				core: styles.linkBeamCore,
			};
		case "slash":
			return {
				glow: styles.linkSlashGlow,
				core: styles.linkSlashCore,
			};
		case "ember":
			return {
				glow: styles.linkEmberGlow,
				core: styles.linkEmberCore,
			};
		case "healStream":
			return {
				glow: styles.linkHealGlow,
				core: styles.linkHealCore,
			};
	}
};

export function CombatEffectsOverlay({ board, effects }: Props) {
	const piecePositions = React.useMemo(
		() =>
			Object.fromEntries(
				Object.entries(board.piecePositions).map(([position, pieceId]) => [
					pieceId,
					parsePosition(position),
				])
			),
		[board.piecePositions]
	);

	const getBoundsStyle = React.useCallback(
		(pieceId: string, scale = 1) => {
			const position = piecePositions[pieceId];
			if (!position) {
				return null;
			}

			const bounds = getHexTileBounds(
				board.size.width,
				board.size.height,
				position.x,
				position.y
			);
			const extraWidth = bounds.width * (scale - 1);
			const extraHeight = bounds.height * (scale - 1);

			return {
				left: `${bounds.left - extraWidth / 2}%`,
				top: `${bounds.top - extraHeight / 2}%`,
				width: `${bounds.width + extraWidth}%`,
				height: `${bounds.height + extraHeight}%`,
			} as React.CSSProperties;
		},
		[board.size.height, board.size.width, piecePositions]
	);

	const getCenterStyle = React.useCallback(
		(pieceId: string, extra: React.CSSProperties = {}) => {
			const position = piecePositions[pieceId];
			if (!position) {
				return null;
			}

			const center = getHexTileCenter(
				board.size.width,
				board.size.height,
				position.x,
				position.y
			);

			return {
				left: `${center.x}%`,
				top: `${center.y}%`,
				...extra,
			} as React.CSSProperties;
		},
		[board.size.height, board.size.width, piecePositions]
	);

	const linkEffects = effects.filter(
		(effect): effect is CombatLinkEffect => effect.kind === "link"
	);
	const auraEffects = effects.filter(
		(effect): effect is CombatAuraEffect => effect.kind === "aura"
	);
	const impactEffects = effects.filter(
		(effect): effect is CombatImpactEffect => effect.kind === "impact"
	);
	const floatingTextEffects = effects.filter(
		(effect): effect is CombatFloatingTextEffect => effect.kind === "floatingText"
	);
	const plusBurstEffects = effects.filter(
		(effect): effect is CombatPlusBurstEffect => effect.kind === "plusBurst"
	);

	return (
		<div className={styles.effectLayer}>
			<svg
				className={styles.linkCanvas}
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
			>
				{linkEffects.map((effect) => {
					const fromPosition = piecePositions[effect.fromId];
					const toPosition = piecePositions[effect.toId];

					if (!fromPosition || !toPosition) {
						return null;
					}

					const from = getHexTileCenter(
						board.size.width,
						board.size.height,
						fromPosition.x,
						fromPosition.y
					);
					const to = getHexTileCenter(
						board.size.width,
						board.size.height,
						toPosition.x,
						toPosition.y
					);
					const path = buildPathForLink(effect, from, to);
					const variantClasses = getLinkClasses(effect.variant);
					const vars = {
						"--delay": `${effect.delayMs}ms`,
						"--duration": `${effect.durationMs}ms`,
					} as React.CSSProperties;

					return (
						<g key={effect.id} style={vars}>
							<path
								pathLength={100}
								d={path}
								className={classNames(
									styles.linkPath,
									styles.linkGlow,
									variantClasses.glow
								)}
							/>
							<path
								pathLength={100}
								d={path}
								className={classNames(
									styles.linkPath,
									styles.linkCore,
									variantClasses.core
								)}
							/>
						</g>
					);
				})}
			</svg>

			{auraEffects.map((effect) => {
				const style = getBoundsStyle(effect.pieceId, effect.scale ?? 1.1);
				if (!style) {
					return null;
				}

				return (
					<div
						key={effect.id}
						className={classNames(styles.aura, getAuraClass(effect.variant))}
						style={{
							...style,
							"--delay": `${effect.delayMs}ms`,
							"--duration": `${effect.durationMs}ms`,
						} as React.CSSProperties}
					>
						<span className={styles.auraCore} />
						<span className={styles.auraRing} />
						<span className={styles.auraNoise} />
					</div>
				);
			})}

			{impactEffects.map((effect) => {
				const style = getBoundsStyle(effect.pieceId, effect.scale ?? 1.08);
				if (!style) {
					return null;
				}

				return (
					<div
						key={effect.id}
						className={classNames(styles.impact, getImpactClass(effect.variant))}
						style={{
							...style,
							"--delay": `${effect.delayMs}ms`,
							"--duration": `${effect.durationMs}ms`,
						} as React.CSSProperties}
					>
						<span className={styles.impactCore} />
						<span className={styles.impactRing} />
						<span className={styles.impactSparks} />
					</div>
				);
			})}

			{plusBurstEffects.map((effect) => {
				const style = getBoundsStyle(effect.pieceId, 1.08);
				if (!style) {
					return null;
				}

				return (
					<div key={effect.id} className={styles.plusBurst} style={style}>
						{[
							{
								size: "clamp(20px, 2vw, 28px)",
								left: "46%",
								bottom: "26%",
								delay: effect.delayMs,
							},
							{
								size: "clamp(15px, 1.5vw, 22px)",
								left: "61%",
								bottom: "21%",
								delay: effect.delayMs + 80,
							},
							{
								size: "clamp(12px, 1.1vw, 18px)",
								left: "34%",
								bottom: "17%",
								delay: effect.delayMs + 150,
							},
						].map((glyph, index) => (
							<span
								key={`${effect.id}-glyph-${index}`}
								className={styles.plusGlyph}
								style={{
									left: glyph.left,
									bottom: glyph.bottom,
									fontSize: glyph.size,
									animationDelay: `${glyph.delay}ms`,
									animationDuration: `${effect.durationMs}ms`,
								}}
							>
								+
							</span>
						))}
					</div>
				);
			})}

			{floatingTextEffects.map((effect) => {
				const style = getCenterStyle(effect.pieceId, {
					"--delay": `${effect.delayMs}ms`,
					"--duration": `${effect.durationMs ?? 1100}ms`,
					"--drift-x": `${effect.driftX ?? 0}px`,
					"--drift-y": `${effect.driftY ?? 0}px`,
				} as React.CSSProperties);

				if (!style) {
					return null;
				}

				return (
					<div
						key={effect.id}
						className={classNames(
							styles.floatingText,
							getFloatingTextClass(effect.variant),
							effect.variant === "label" && getFloatingToneClass(effect.tone)
						)}
						style={style}
					>
						{effect.text}
					</div>
				);
			})}
		</div>
	);
}
