import * as React from "react";

import { HasId, PiecePosition } from "@shoki/board";

import {
	BoardGrid,
	ClickBoardTileEvent,
	DropBoardItemEvent,
} from "@shoki-web/board-react";

import { PieceModel } from "@creature-chess/models";

import { useGameBoard } from "./GameBoardContext";
import { ThemedBoard } from "./ThemedBoard";
import { getHexLayoutMetrics } from "./hexLayout";
import styles from "./GameBoard.module.css";

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
	isPreparing?: boolean;
	deployZoneRows?: number[];
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

export function GameBoard({
	renderBoardPiece,
	renderBenchPiece,
	renderTileBackground,
	onClick,
	onDropPiece,
	children,
	isPreparing = false,
	deployZoneRows = [],
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

	const boardMetrics = React.useMemo(
		() => getHexLayoutMetrics(board.size.width, board.size.height),
		[board.size.height, board.size.width]
	);

	const boardAspectRatio = boardMetrics.boardAspectRatio;
	const benchAspectRatio = bench.size.width / bench.size.height;
	const totalHeightFactor =
		1 / benchAspectRatio + 1 / boardAspectRatio + 1 / benchAspectRatio;

	const rootRef = React.useRef<HTMLDivElement>(null);
	const [boardPx, setBoardPx] = React.useState<{ w: number; h: number } | null>(
		null
	);

	React.useLayoutEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		const calculate = (containerW: number, containerH: number) => {
			// Account for real shell chrome: bench margins and board shell padding.
			// Without this reserve, the board is sized as if only the raw aspect
			// ratios exist, which clips the lower hex rows inside the fixed-height stage.
			const verticalChromePx =
				containerW <= 560 ? 18 : containerW <= 820 ? 24 : 34;
			const safeHeight = Math.max(containerH - verticalChromePx, 0);
			const widthFromHeight = safeHeight / totalHeightFactor;
			const width = Math.min(containerW, widthFromHeight);
			const height = width * totalHeightFactor + verticalChromePx;
			setBoardPx({ w: width, h: height });
		};

		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			calculate(width, height);
		});

		calculate(el.clientWidth, el.clientHeight);
		observer.observe(el);
		return () => observer.disconnect();
	}, [totalHeightFactor]);

	const styleVars = {
		"--board-ratio": `${boardAspectRatio}`,
		"--bench-ratio": `${benchAspectRatio}`,
	} as React.CSSProperties;

	const boardStyle = boardPx
		? { width: `${boardPx.w}px`, height: `${boardPx.h}px` }
		: { width: "100%", height: "100%" };

	return (
		<div className={styles.root} ref={rootRef} style={styleVars}>
			<div className={styles.boardHaloOuter} aria-hidden="true" />
			<div className={styles.boardHaloMid} aria-hidden="true" />
			<div className={styles.boardRunes} aria-hidden="true" />
			<div className={styles.gameBoard} style={boardStyle}>
				<div className={styles.enemyBenchShell} aria-hidden="true">
					<div className={styles.enemyBench}>
						{Array.from({ length: bench.size.width }, (_, index) => (
							<span
								className={styles.enemyBenchTile}
								key={`enemy-bench-${index}`}
							/>
						))}
					</div>
				</div>

				<div className={styles.boardShell}>
					<div className={styles.board}>
						<ThemedBoard
							state={board}
							onDropItem={onDropBoard}
							onClickTile={onClickBoard}
							renderItem={boardPieceRenderer}
							renderTileBackground={renderTileBackground}
							isPreparing={isPreparing}
							deployZoneRows={deployZoneRows}
						/>
						{children}
					</div>
				</div>

				<div className={styles.playerBenchShell}>
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
		</div>
	);
}
