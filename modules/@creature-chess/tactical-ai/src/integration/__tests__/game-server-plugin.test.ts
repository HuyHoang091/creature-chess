import { registerTacticalAIEvents } from "../game-server-plugin";

const disabledState = {
	enabled: false,
	level: null,
	preset: null,
	planName: null,
	round: 1,
	activity: "disabled",
	message: "off",
	recentSteps: [],
};

describe("tactical AI build auto-play socket events", () => {
	test("registers start, stop, state, status subscription, and cleanup", () => {
		const handlers = new Map<string, (...args: any[]) => void>();
		const socket = {
			id: "socket-1",
			data: { id: "player-1" },
			on: jest.fn((event: string, handler: (...args: any[]) => void) => {
				handlers.set(event, handler);
			}),
			off: jest.fn(),
			emit: jest.fn(),
		};
		const autoPlayer = {
			subscribe: jest.fn((callback: (state: unknown) => void) => {
				callback(disabledState);
				return jest.fn();
			}),
			start: jest.fn((_plan, level, preset) => {
				if (level !== 2) {
					throw new Error("Invalid auto-play level");
				}
				return { ...disabledState, enabled: true, level, preset };
			}),
			stop: jest.fn(() => disabledState),
			getStatus: jest.fn(() => disabledState),
		};

		const cleanup = registerTacticalAIEvents(socket as any, {
			buildAutoPlayer: autoPlayer as any,
		});

		expect(socket.emit).toHaveBeenCalledWith(
			"buildAutoPlayStatus",
			disabledState
		);

		const startAck = jest.fn();
		handlers
			.get("startBuildAutoPlay")
			?.({ plan: {}, level: 2, preset: "stabilize" }, startAck);
		expect(autoPlayer.start).toHaveBeenCalledWith(
			{},
			2,
			"stabilize"
		);
		expect(startAck).toHaveBeenCalledWith(
			expect.objectContaining({
				success: true,
				state: expect.objectContaining({
					enabled: true,
					level: 2,
					preset: "stabilize",
				}),
			})
		);

		const invalidAck = jest.fn();
		handlers.get("startBuildAutoPlay")?.({ plan: {}, level: 9 }, invalidAck);
		expect(invalidAck).toHaveBeenCalledWith({
			success: false,
			error: "Invalid auto-play level",
		});

		const stateAck = jest.fn();
		handlers.get("requestBuildAutoPlayState")?.({}, stateAck);
		expect(stateAck).toHaveBeenCalledWith({
			success: true,
			state: disabledState,
		});

		const stopAck = jest.fn();
		handlers.get("stopBuildAutoPlay")?.({}, stopAck);
		expect(stopAck).toHaveBeenCalledWith({
			success: true,
			state: disabledState,
		});

		cleanup();
		expect(socket.off).toHaveBeenCalledWith(
			"startBuildAutoPlay",
			expect.any(Function)
		);
	});
});
