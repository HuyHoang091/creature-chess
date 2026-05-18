import React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { SkillOverlay } from "~/effects/skills/SkillOverlay";

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

	const [activeSkills, setActiveSkills] = React.useState<
		{
			id: string;
			name: string;
			skillType: "damage" | "buff" | "support";
			skillTarget: "single" | "aoe" | "bounce" | "line";
			targets: any;
			time: number;
		}[]
	>([]);

	React.useEffect(() => {
		const casting = Object.values(displayBoard.pieces).filter(
			(piece) => !!piece.skillCast
		);

		if (casting.length > 0) {
			setActiveSkills((prev) => {
				const now = Date.now();
				return [
					...prev.filter((skill) => now - skill.time < 1200),
					...casting.map((piece) => ({
						id: `${piece.id}-${now}`,
						name: piece.skillCast!.skillName,
						skillType: piece.skillCast!.skillType ?? ("damage" as const),
						skillTarget: piece.skillCast!.skillTarget ?? ("aoe" as const),
						targets: piece.skillCast!.targets,
						time: now,
					})),
				];
			});
		}
	}, [displayBoard]);

	const boardColumns = displayBoard.size.width;
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
					{activeSkills.map((skill) => (
						<SkillOverlay
							key={skill.id}
							skillName={skill.name}
							skillType={skill.skillType}
							skillTarget={skill.skillTarget}
							targets={skill.targets}
							boardColumns={boardColumns}
							boardRows={boardRows}
						/>
					))}
					{children}
				</GameBoard>
			</div>
		</GameBoardContextProvider>
	);
}
