import * as React from "react";

import { HasId, PiecePosition } from "@shoki/board";

import {
	BoardGrid,
	ClickBoardTileEvent,
	DropBoardItemEvent,
} from "@shoki-web/board-react";

import { PieceModel } from "@creature-chess/models";

import { BoardSpaceFiller } from "./BoardSpaceFiller";
import { useGameBoard } from "./GameBoardContext";
import { ThemedBoard } from "./ThemedBoard";

export type GameBoardLocation =
	| {
			locationType: "board";
			x: number;
			y: number;
	  }
	| {
			locationType: "bench";
			x: number;
	  };

type GameBoardClickEvent = { location: GameBoardLocation };
type GameBoardDropPieceEvent = {
	id: string;
	location: GameBoardLocation;
};

const createClickEvent = (
	location: GameBoardLocation
): GameBoardClickEvent => ({ location });
const createDropPieceEvent = (
	id: string,
	location: GameBoardLocation
): GameBoardDropPieceEvent => ({ id, location });

type GameBoardProps = {
	renderBoardPiece: (piece: PieceModel) => React.ReactNode | React.ReactNode[];
	renderBenchPiece: (piece: PieceModel) => React.ReactNode | React.ReactNode[];
	renderTileBackground?: (position: PiecePosition) => React.ReactNode;
	onClick?: (event: GameBoardClickEvent) => void;
	onDropPiece?: (event: GameBoardDropPieceEvent) => void;
	children?: React.ReactNode;

	showFiller?: boolean;
};

function useEvents({
	onClick,
	onDropPiece,
}: Pick<GameBoardProps, "onClick" | "onDropPiece">) {
	const onClickBoard = React.useCallback(
		({ x, y }: ClickBoardTileEvent) => {
			if (!onClick) {
				return;
			}

			onClick(createClickEvent({ locationType: "board", x, y }));
		},
		[onClick]
	);

	const onClickBench = React.useCallback(
		({ x }: ClickBoardTileEvent) => {
			if (!onClick) {
				return;
			}

			onClick(createClickEvent({ locationType: "bench", x }));
		},
		[onClick]
	);

	const onDropBoard = React.useCallback(
		({ id, x, y }: DropBoardItemEvent) => {
			if (!onDropPiece) {
				return;
			}

			onDropPiece(createDropPieceEvent(id, { locationType: "board", x, y }));
		},
		[onDropPiece]
	);

	const onDropBench = React.useCallback(
		({ id, x }: DropBoardItemEvent) => {
			if (!onDropPiece) {
				return;
			}

			onDropPiece(createDropPieceEvent(id, { locationType: "bench", x }));
		},
		[onDropPiece]
	);

	return {
		onClickBoard,
		onClickBench,
		onDropBoard,
		onDropBench,
	};
}

function useRenderers({
	renderBoardPiece,
	renderBenchPiece,
}: Pick<GameBoardProps, "renderBoardPiece" | "renderBenchPiece">) {
	const { board, bench } = useGameBoard();

	const boardPieceRenderer = React.useMemo(
		() => (item: HasId) => {
			const piece = item as PieceModel;
			const draggable = !board.locked;

			return {
				item: renderBoardPiece(piece),
				draggable,
			};
		},
		[board.locked, renderBoardPiece]
	);

	const benchPieceRenderer = React.useMemo(
		() => (item: HasId) => {
			const piece = item as PieceModel;
			const draggable = !bench.locked;

			return {
				item: renderBenchPiece(piece),
				draggable,
			};
		},
		[bench.locked, renderBenchPiece]
	);

	return { boardPieceRenderer, benchPieceRenderer };
}

import styles from "./GameBoard.module.css";

export function GameBoard({
	renderBoardPiece,
	renderBenchPiece,
	renderTileBackground,
	onClick,
	onDropPiece,
	children,
	showFiller = false,
}: GameBoardProps) {
	const { board, bench } = useGameBoard();

	const { boardPieceRenderer, benchPieceRenderer } = useRenderers({
		renderBoardPiece,
		renderBenchPiece,
	});
	const { onClickBoard, onClickBench, onDropBoard, onDropBench } = useEvents({
		onClick,
		onDropPiece,
	});

	const totalHeight =
		bench.size.height +
		(showFiller ? board.size.height * 2 : board.size.height);

	const tileWidth = board.size.width;
	const tileHeight = totalHeight;

	// Dùng ResizeObserver để tính kích thước board chính xác theo container
	const rootRef = React.useRef<HTMLDivElement>(null);
	const [boardPx, setBoardPx] = React.useState<{ w: number; h: number } | null>(null);

	React.useLayoutEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		const calculate = (containerW: number, containerH: number) => {
			// Scale bàn cờ vừa container, giữ đúng tỷ lệ tile
			const scaleByW = containerW / tileWidth;
			const scaleByH = containerH / tileHeight;
			const scale = Math.min(scaleByW, scaleByH);
			setBoardPx({ w: tileWidth * scale, h: tileHeight * scale });
		};

		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			calculate(width, height);
		});

		// Initial calculation
		calculate(el.clientWidth, el.clientHeight);
		observer.observe(el);
		return () => observer.disconnect();
	}, [tileWidth, tileHeight]);

	const boardRatio = `${tileWidth} / ${board.size.height}`;
	const benchRatio = `${tileWidth} / ${bench.size.height}`;

	const styleVars = {
		"--board-ratio": boardRatio,
		"--bench-ratio": benchRatio,
	} as React.CSSProperties;

	// Dùng px dimensions nếu đã tính được, không thì dùng % fallback
	const boardStyle = boardPx
		? { width: `${boardPx.w}px`, height: `${boardPx.h}px` }
		: { width: "100%", height: "100%" };

	return (
		<div className={styles.root} ref={rootRef} style={styleVars}>
			<div className={styles.gameBoard} style={boardStyle}>
				{showFiller && <BoardSpaceFiller />}

				<div className={styles.board}>
					<ThemedBoard
						state={board}
						onDropItem={onDropBoard}
						onClickTile={onClickBoard}
						renderItem={boardPieceRenderer}
						renderTileBackground={renderTileBackground}
						flipDarkLight={showFiller}
					/>
					{children}
				</div>

				<div className={styles.bench}>
					<BoardGrid
						state={bench}
						onDropItem={onDropBench}
						onClickTile={onClickBench}
						renderItem={benchPieceRenderer}
						className={styles.benchBoard}
						lightTileClassName={styles.benchTile}
						darkTileClassName={styles.benchTile}
					/>
				</div>
			</div>
		</div>
	);
}
