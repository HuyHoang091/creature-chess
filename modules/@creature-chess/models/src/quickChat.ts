import { GamePhase } from "./game-phase";

export enum ReadyQuickChatOptions {
	GL = "GL",
	HAPPY = "😃",
	SHOCKED = "😱",
	ANGRY = "😠",
}
export enum FinishedQuickChatOptions {
	GG = "GG",
	HAPPY = "😃",
	SHOCKED = "😱",
	ANGRY = "😠",
}

type EnumValue<T> = T[keyof T];
export type QuickChatOption =
	| EnumValue<typeof ReadyQuickChatOptions>
	| EnumValue<typeof FinishedQuickChatOptions>;

export const getQuickChatOptions = (phase: GamePhase | null) => {
	if (!phase) {
		return null;
	}
	if (phase === GamePhase.READY) {
		return ReadyQuickChatOptions;
	}
	if (phase === GamePhase.PLAYING) {
		return FinishedQuickChatOptions;
	}
};
// Điều này có thể được mở rộng cho cụm từ sao cho bằng với một tùy chọn quickChat, hoặc bằng với một chuỗi do người chơi cung cấp (không phải quick chat);
export type QuickChatValue = {
	phrase: QuickChatOption;
};
