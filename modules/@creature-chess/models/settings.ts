/**
 * Cài đặt chế độ chơi. Chúng có thể nhìn thấy cả trên máy chủ và trên máy khách.
 */
export type GamemodeSettings = {
	healthLostPerPiece: number;
	startingMoney: number;
	startingLevel: number;
	rerollCost: number;
	rerollMultiplier: number;
	buyXpCost: number;
	buyXpAmount: number;

	benchSize: number;

	boardWidth: number;
	boardHalfHeight: number;

	/**
	 * Số lượt trước khi trận đấu kết thúc với tỷ số hòa.
	 *
	 * Cố tình không hiển thị trong menu cài đặt giao diện người dùng.
	 */
	battleTurnCount: number;

	/**
	 * Thời lượng, tính bằng mili giây, của mỗi lượt trong một trận chiến.
	 */
	battleTurnDuration: number;
};

export const GamemodeSettingsPresets: Record<"default", GamemodeSettings> = {
	default: {
		healthLostPerPiece: 2,
		startingMoney: 3,
		startingLevel: 1,
		rerollCost: 2,
		rerollMultiplier: 100,
		buyXpCost: 5,
		buyXpAmount: 4,
		boardWidth: 7,
		boardHalfHeight: 3,
		benchSize: 9,
		battleTurnCount: 550,
		battleTurnDuration: 100,
	},
};
