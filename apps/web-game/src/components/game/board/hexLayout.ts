export type HexLayoutMetrics = {
	boardAspectRatio: number;
	tileWidthPercent: number;
	tileHeightPercent: number;
	leftInsetPercent: number;
	rowOffsetPercent: number;
	rowStepPercent: number;
	topInsetPercent: number;
};

export function getHexLayoutMetrics(columns: number, rows: number): HexLayoutMetrics {
	if (columns === 7 && rows === 6) {
		// Widen the board frame slightly while keeping the original hex geometry.
		// This makes the playfield read more like a rectangle without stretching tiles.
		const boardWidth = 650;
		const boardHeight = 396;
		const tileWidthPercent = (70 / boardWidth) * 100;
		const rowOffsetPercent = (35 / boardWidth) * 100;
		const leftInsetPercent =
			(100 - (columns * tileWidthPercent + rowOffsetPercent)) / 2;

		return {
			boardAspectRatio: boardWidth / boardHeight,
			tileWidthPercent,
			tileHeightPercent: (80 / 396) * 100,
			leftInsetPercent,
			rowOffsetPercent,
			rowStepPercent: (60 / boardHeight) * 100,
			topInsetPercent: (8 / boardHeight) * 100,
		};
	}

	const widthUnits = columns + 0.5;
	const hexHeightUnits = 8 / 7;
	const rowStepUnits = 6 / 7;
	const heightUnits = hexHeightUnits + (rows - 1) * rowStepUnits;
	const tileWidthPercent = 100 / widthUnits;
	const rowOffsetPercent = tileWidthPercent / 2;
	const tileHeightPercent = (hexHeightUnits / heightUnits) * 100;

	return {
		boardAspectRatio: widthUnits / heightUnits,
		tileWidthPercent,
		tileHeightPercent,
		leftInsetPercent: 0,
		rowOffsetPercent,
		rowStepPercent: (rowStepUnits / heightUnits) * 100,
		topInsetPercent: 0,
	};
}

export function getHexTileBounds(
	columns: number,
	rows: number,
	x: number,
	y: number
) {
	const metrics = getHexLayoutMetrics(columns, rows);
	const left =
		metrics.leftInsetPercent +
		x * metrics.tileWidthPercent +
		(y % 2 === 1 ? metrics.rowOffsetPercent : 0);
	const top = metrics.topInsetPercent + y * metrics.rowStepPercent;

	return {
		left,
		top,
		width: metrics.tileWidthPercent,
		height: metrics.tileHeightPercent,
	};
}

export function getHexTileCenter(
	columns: number,
	rows: number,
	x: number,
	y: number
) {
	const bounds = getHexTileBounds(columns, rows, x, y);

	return {
		x: bounds.left + bounds.width / 2,
		y: bounds.top + bounds.height / 2,
	};
}
