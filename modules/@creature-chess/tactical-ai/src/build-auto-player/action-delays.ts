export type DelayKind = "thinking" | "shop" | "tactical";

export const DELAY_RANGES: Record<DelayKind, [number, number]> = {
	thinking: [400, 800],
	shop: [400, 800],
	tactical: [100, 200],
};

export const DEFAULT_TICK_DELAY_MS = 400;

export const randomDelay = (
	min: number,
	max: number,
	random: () => number = Math.random
) => min + Math.floor(random() * (max - min + 1));

export const delayForKind = (
	kind: DelayKind,
	random: () => number = Math.random
) => {
	const [min, max] = DELAY_RANGES[kind];
	return randomDelay(min, max, random);
};
