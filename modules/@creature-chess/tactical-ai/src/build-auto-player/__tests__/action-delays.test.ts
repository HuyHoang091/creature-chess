import { DELAY_RANGES, delayForKind, randomDelay } from "../action-delays";

describe("action delays", () => {
	test("randomDelay stays within the requested range", () => {
		const random = () => 0.5;
		expect(randomDelay(400, 800, random)).toBe(600);
		expect(randomDelay(100, 200, random)).toBe(150);
	});

	test("delayForKind uses configured ranges", () => {
		expect(DELAY_RANGES.tactical).toEqual([100, 200]);
		expect(delayForKind("shop", () => 0)).toBe(400);
		expect(delayForKind("tactical", () => 0.999)).toBe(200);
	});
});
