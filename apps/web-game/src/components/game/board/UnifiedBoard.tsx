import React from "react";

import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { GamePhase } from "@creature-chess/models";

import { GameBoard } from "./GameBoard";
import { GameBoardContextProvider } from "./GameBoardContext";
import {
    useGameBench,
    useGameBoard,
    useGameMatchBoard,
    useRenderBoardPiece,
    useRenderBenchPiece,
    useRenderMatchBoardPiece,
    useOnClickTile,
    useOnDropPiece,
} from "./hooks";

import { SkillOverlay } from "~/effects/skills/SkillOverlay";

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

    // Board hiển thị: ưu tiên matchBoard khi có (PLAYING phase)
    const isMatch = matchBoard !== null;
    const displayBoard = matchBoard ?? localBoard;

    // Render piece tuỳ mode
    const renderSelectablePiece = useRenderBoardPiece();
    const renderMatchPiece = useRenderMatchBoardPiece();
    const renderBoardPiece = isMatch ? renderMatchPiece : renderSelectablePiece;
    const renderBenchPiece = useRenderBenchPiece();

    // Tương tác: chỉ cho click board khi không phải match
    const onClickTile = useOnClickTile({ canClickBoard: !isMatch });
    const onDropPiece = useOnDropPiece(displayBoard, bench);

    const isPreparing = phase === GamePhase.PREPARING;

    if (!displayBoard) {
        return null;
    }

	// Lưu giữ state hiển thị Skill (1.2 giây tự xóa)
	const [activeSkills, setActiveSkills] = React.useState<{
		id: string;
		name: string;
		skillType: "damage" | "buff" | "support";
		skillTarget: "single" | "aoe" | "bounce" | "line";
		targets: any;
		time: number;
	}[]>([]);

	React.useEffect(() => {
		const casting = Object.values(displayBoard.pieces).filter(p => !!p.skillCast);
        if (casting.length > 0) {
            setActiveSkills(prev => {
                const now = Date.now();
                return [
					...prev.filter(s => now - s.time < 1200),
					...casting.map(p => ({
                    	id: `${p.id}-${now}`,
                    	name: p.skillCast!.skillName,
						skillType: p.skillCast!.skillType ?? "damage" as const,
						skillTarget: p.skillCast!.skillTarget ?? "aoe" as const,
                    	targets: p.skillCast!.targets,
                    	time: now
                	}))
				];
            });
        }
	}, [displayBoard]);

    const boardColumns = displayBoard.size.width;
    const boardRows = displayBoard.size.height;

    return (
        <GameBoardContextProvider value={{ board: displayBoard, bench }}>
			<div className="unified-board-root" style={{ width: '100%', height: '100%', '--board-item-transition-dur': isOvertime ? '65ms' : '0.2s' } as React.CSSProperties}>
				<GameBoard
					onClick={onClickTile}
					onDropPiece={onDropPiece}
					renderBoardPiece={renderBoardPiece}
					renderBenchPiece={renderBenchPiece}
					showFiller={isPreparing}
				>
				{/* SkillOverlay nằm trong .board (position: relative) để canh theo grid */}
				{activeSkills.map(skill => (
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
