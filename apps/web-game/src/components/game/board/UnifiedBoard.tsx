import React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { CombatEffectsOverlay } from "~/effects/combat/CombatEffectsOverlay";
import { buildCombatEffects } from "~/effects/combat/buildCombatEffects";

import { GameBoard } from "./GameBoard";
import { GameBoardContextProvider } from "./GameBoardContext";
import {
	useGameBench,
	useGameBoard,
	useGameMatchBoard,
	useOnClickTile,
	useOnDropPiece,
	useRenderBenchPiece,
	useRenderBoardPiece,
	useRenderMatchBoardPiece,
} from "./hooks";

export function UnifiedBoard({ children }: { children?: React.ReactNode }) {
	const phase = useSelector<AppState, GamePhase | null>(
		(state) => state.game.roundInfo.phase
	);
	const isOvertime = useSelector<AppState, boolean>(
		(state) => !!state.game.roundInfo.isOvertime
	);

	const localBoard = useGameBoard();
	const matchBoard = useGameMatchBoard();
	const bench = useGameBench();

	const isMatch = matchBoard !== null;
	const rawBoard = matchBoard ?? localBoard;

	const renderSelectablePiece = useRenderBoardPiece();
	const renderMatchPiece = useRenderMatchBoardPiece();
	const renderBoardPiece = isMatch ? renderMatchPiece : renderSelectablePiece;
	const renderBenchPiece = useRenderBenchPiece();

	const logicalBoard = rawBoard;
	const visualBoardOffset = !isMatch && rawBoard ? rawBoard.size.height : 0;
	const displayBoard = React.useMemo(() => {
		if (!rawBoard) {
			return rawBoard;
		}

		if (isMatch || rawBoard.size.height !== 3) {
			return rawBoard;
		}

		const piecePositions = Object.entries(rawBoard.piecePositions).reduce<
			Record<string, string>
		>((next, [position, pieceId]) => {
			const [x, y] = position.split(",").map((value) => parseInt(value, 10));
			next[`${x},${y + rawBoard.size.height}`] = pieceId;
			return next;
		}, {});

		return {
			...rawBoard,
			size: {
				width: rawBoard.size.width,
				height: rawBoard.size.height * 2,
			},
			piecePositions,
		};
	}, [isMatch, rawBoard]);

	const onClickTileBase = useOnClickTile({ canClickBoard: !isMatch });
	const onDropPieceBase = useOnDropPiece(logicalBoard, bench);

	const isPreparing = phase === GamePhase.PREPARING;

	if (!displayBoard) {
		return null;
	}

	const mapVisualBoardYToLogical = React.useCallback(
		(y: number) => {
			if (!visualBoardOffset) {
				return y;
			}

			if (y < visualBoardOffset) {
				return null;
			}

			return y - visualBoardOffset;
		},
		[visualBoardOffset]
	);

	const onClickTile = React.useCallback(
		(event: any) => {
			if (event.location.locationType !== "board" || !visualBoardOffset) {
				onClickTileBase(event);
				return;
			}

			const logicalY = mapVisualBoardYToLogical(event.location.y ?? 0);
			if (logicalY === null) {
				return;
			}

			onClickTileBase({
				location: {
					locationType: "board",
					x: event.location.x,
					y: logicalY,
				},
			});
		},
		[mapVisualBoardYToLogical, onClickTileBase, visualBoardOffset]
	);

	const onDropPiece = React.useCallback(
		(event: any) => {
			if (event.location.locationType !== "board" || !visualBoardOffset) {
				onDropPieceBase(event);
				return;
			}

			const logicalY = mapVisualBoardYToLogical(event.location.y ?? 0);
			if (logicalY === null) {
				return;
			}

			onDropPieceBase({
				id: event.id,
				location: {
					locationType: "board",
					x: event.location.x,
					y: logicalY,
				},
			});
		},
		[mapVisualBoardYToLogical, onDropPieceBase, visualBoardOffset]
	);

	const previousBoardRef = React.useRef<typeof displayBoard | null>(null);
	const cleanupTimersRef = React.useRef<number[]>([]);
	const [activeCombatEffects, setActiveCombatEffects] = React.useState<
		React.ComponentProps<typeof CombatEffectsOverlay>["effects"]
	>([]);

	React.useEffect(() => {
		return () => {
			cleanupTimersRef.current.forEach((timer) => window.clearTimeout(timer));
			cleanupTimersRef.current = [];
		};
	}, []);

	React.useEffect(() => {
		if (!isMatch) {
			previousBoardRef.current = displayBoard;
			setActiveCombatEffects([]);
			return;
		}

		const nextEffects = buildCombatEffects(previousBoardRef.current, displayBoard);
		previousBoardRef.current = displayBoard;

		if (nextEffects.length === 0) {
			return;
		}

		setActiveCombatEffects((current) => [...current, ...nextEffects]);

		const effectIds = new Set(nextEffects.map((effect) => effect.id));
		const totalLifetime =
			Math.max(
				...nextEffects.map(
					(effect) =>
						(effect.kind === "floatingText"
							? effect.durationMs ?? 1100
							: effect.durationMs) + effect.delayMs
					)
				) + 200;
		const timer = window.setTimeout(() => {
			setActiveCombatEffects((current) =>
				current.filter((effect) => !effectIds.has(effect.id))
			);
		}, totalLifetime);

		cleanupTimersRef.current.push(timer);
	}, [displayBoard, isMatch]);

	const boardRows = displayBoard.size.height;
	const deployZoneRows = React.useMemo(() => {
		if (!isPreparing) {
			return [] as number[];
		}

		const start = Math.floor(boardRows / 2);
		return Array.from({ length: boardRows - start }, (_, index) => start + index);
	}, [boardRows, isPreparing]);

	return (
		<GameBoardContextProvider value={{ board: displayBoard, bench }}>
			<div
				className="unified-board-root"
				style={
					{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
						overflow: "visible",
						"--board-item-transition-dur": isOvertime ? "65ms" : "0.2s",
					} as React.CSSProperties
				}
			>
				<GameBoard
					onClick={onClickTile}
					onDropPiece={onDropPiece}
					renderBoardPiece={renderBoardPiece}
					renderBenchPiece={renderBenchPiece}
					isPreparing={isPreparing}
					deployZoneRows={deployZoneRows}
				>
					{activeCombatEffects.length > 0 ? (
						<CombatEffectsOverlay
							board={displayBoard}
							effects={activeCombatEffects}
						/>
					) : null}
					{children}
				</GameBoard>
			</div>
		</GameBoardContextProvider>
	);
}
