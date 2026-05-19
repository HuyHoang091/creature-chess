import * as React from "react";
import { useDispatch } from "react-redux";
import { BoardSelectors, BoardState } from "@shoki/board";
import { PieceModel } from "@creature-chess/models";
import { PlayerActions } from "@creature-chess/gamemode";
import { PositioningAdvice } from "~/services/tacticalAI";
import { lookupPieceInfo } from "./pieceNameMap";
import styles from "./tactical-ai.module.css";

// ─── helpers ──────────────────────────────────────────────────────────

function getPieceImageUrl(definitionId: number): string {
  return `${APP_IMAGE_ROOT}/creatures/front/${definitionId}.png`;
}

interface PieceMove {
  pieceId: string;
  targetX: number;
  targetY: number;
}

function getPiecePos(board: BoardState<PieceModel>, pieceId: string): { x: number; y: number } | null {
  const pos = BoardSelectors.getPiecePosition(board, pieceId);
  return pos ? { x: pos.x, y: pos.y } : null;
}

const COST_COLORS: Record<number, string> = {
  1: "#808080", 2: "#11b128", 3: "#207ac9", 4: "#b82ee6", 5: "#ffd700",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  low: "#e84057", medium: "#c8aa6e", high: "#0ac8b9",
};

// ─── board constants ──────────────────────────────────────────────────

const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 3;

// ─── friendly formation names ────────────────────────────────────────

const FORMATION_NAMES: Record<string, string> = {
  tank_front: "Tank tuyến đầu",
  spread_backline: "Dàn hàng sau",
  protect_left: "Bảo vệ cánh trái",
  focus_corner: "Tập trung góc",
  anti_jump: "Chống ám sát",
  assassin_flank: "Sát thủ cánh",
  standard: "Tiêu chuẩn",
};

const ADJUSTMENT_NAMES: Record<string, string> = {
  protect_carry: "Bảo vệ carry",
  reposition_tank: "Đổi vị trí tank",
  flank_assassin: "Sát thủ cánh",
  consolidate_support: "Gom support",
  counter_assassin: "Khắc chế sát thủ",
  none: "Không",
};

function friendlyFormation(key: string): string {
  return FORMATION_NAMES[key] || key;
}

function friendlyAdjustment(key: string): string {
  return ADJUSTMENT_NAMES[key] || key;
}

// ─── mini board preview ───────────────────────────────────────────────

interface CellInfo {
  x: number; y: number;
  piece: PieceModel | null;
  isTarget: boolean;
}

const MiniBoard: React.FC<{
  board: BoardState<PieceModel>;
  pieces: PieceModel[];
  moves: PieceMove[];
  localPlayerId: string;
}> = ({ board, pieces, moves, localPlayerId }) => {
  const myPieces = pieces.filter(p => p.ownerId === localPlayerId);

  const grid: CellInfo[][] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    const row: CellInfo[] = [];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const piece = myPieces.find(p => {
        const pos = getPiecePos(board, p.id);
        return pos && pos.x === x && pos.y === y;
      }) || null;
      row.push({ x, y, piece, isTarget: false });
    }
    grid.push(row);
  }

  for (const move of moves) {
    for (const row of grid) {
      for (const cell of row) {
        if (cell.x === move.targetX && cell.y === move.targetY) {
          cell.isTarget = true;
        }
      }
    }
  }

  return (
    <div className={styles.miniBoard}>
      <div className={styles.miniBoardLabel}>Bàn cờ hiện tại → vị trí mới (7×3)</div>
      {grid.map((row, ri) => (
        <div key={ri} className={styles.miniBoardRow}>
          {row.map((cell, ci) => {
            const info = cell.piece ? lookupPieceInfo(cell.piece.definitionId) : null;
            const isSource = cell.piece && moves.some(m => m.pieceId === cell.piece!.id);
            const isTargeted = cell.isTarget && !cell.piece;
            const isSwap = cell.isTarget && cell.piece && moves.some(
              m => m.targetX === cell.x && m.targetY === cell.y && m.pieceId !== cell.piece!.id
            );

            let cls = styles.miniCell;
            if (isSource) cls += ` ${styles.miniCellSource}`;
            if (isTargeted) cls += ` ${styles.miniCellTarget}`;
            if (isSwap) cls += ` ${styles.miniCellSwap}`;

            return (
              <div key={ci} className={cls}>
                {cell.piece ? (
                  <img
                    className={styles.miniCellImg}
                    style={{ borderColor: info ? COST_COLORS[info.cost] : "#808080" }}
                    src={getPieceImageUrl(cell.piece.definitionId)}
                    alt={info?.name || ""}
                    title={`${info?.name || "?"} (${cell.x},${cell.y})${isSource ? " → di chuyển" : ""}`}
                  />
                ) : isTargeted ? (
                  <span className={styles.miniCellArrow}>→</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
      <div className={styles.miniBoardLegend}>
        <span><span className={styles.legendSource}/> Di chuyển đi</span>
        <span><span className={styles.legendTarget}/> Vị trí mới</span>
        <span><span className={styles.legendSwap}/> Hoán đổi</span>
      </div>
    </div>
  );
};

// ─── move card ─────────────────────────────────────────────────────────

const MoveCard: React.FC<{
  move: PieceMove; from: { x: number; y: number } | null; piece: PieceModel | undefined; index: number;
}> = ({ move, piece, from, index }) => {
  const info = piece ? lookupPieceInfo(piece.definitionId) : null;
  return (
    <div className={styles.moveCard}>
      <span className={styles.moveIndex}>#{index + 1}</span>
      {piece && info ? (
        <img className={styles.movePieceImg} style={{ borderColor: COST_COLORS[info.cost] || "#808080" }}
          src={getPieceImageUrl(piece.definitionId)} alt={info.name} />
      ) : null}
      <span className={styles.movePieceName}>{info?.name || move.pieceId}</span>
      <span className={styles.movePos}>({from ? `${from.x},${from.y}` : "?"})</span>
      <span className={styles.moveArrow}>→</span>
      <span className={styles.moveTarget}>({move.targetX},{move.targetY})</span>
    </div>
  );
};

// ─── main ──────────────────────────────────────────────────────────────

interface PositioningTabProps {
  loading: boolean;
  result: PositioningAdvice | null;
  board: BoardState<PieceModel>;
  localPlayerId: string;
  canUsePositioning: boolean;
  roundNumber: number;
  onRequest: () => void;
}

export const PositioningTab: React.FC<PositioningTabProps> = ({
  loading, result, board, localPlayerId, canUsePositioning, roundNumber, onRequest,
}) => {
  const dispatch = useDispatch();
  const [applied, setApplied] = React.useState(false);
  const lastRoundRef = React.useRef(roundNumber);

  // Clear applied state when round changes (new shopping phase)
  React.useEffect(() => {
    if (roundNumber !== lastRoundRef.current) {
      lastRoundRef.current = roundNumber;
      setApplied(false);
    }
  }, [roundNumber]);

  const myPieces = React.useMemo(
    () => BoardSelectors.getAllPieces(board).filter(p => p.ownerId === localPlayerId),
    [board, localPlayerId]
  );

  const handleApply = React.useCallback(() => {
    if (!result || result.moves.length === 0) return;
    for (const move of result.moves) {
      const pos = getPiecePos(board, move.pieceId);
      if (!pos) continue;
      dispatch(PlayerActions.dropPiecePlayerAction({
        pieceId: move.pieceId,
        from: { type: "board" as const, location: { x: pos.x, y: pos.y } },
        to: { type: "board" as const, location: { x: move.targetX, y: move.targetY } },
      }));
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  }, [result, board, dispatch]);

  if (!result) {
    return (
      <div>
        <button className={styles.actionBtn} onClick={onRequest} disabled={loading || !canUsePositioning}
          title={canUsePositioning ? "" : "Chỉ dùng được trong vòng mua đồ khi đã reveal đủ 2 đối thủ"}>
          {loading ? "Đang phân tích..." : "Gợi ý xếp quân"}
        </button>
        {!canUsePositioning && (
          <div className={styles.disabledHint}>⚠️ Chỉ dùng được trong vòng mua đồ, không áp dụng cho round PvE</div>
        )}
      </div>
    );
  }

  const confColor = CONFIDENCE_COLORS[result.confidence] || "#c8aa6e";
  const formationLabel = friendlyFormation(result.formation);
  const adjustmentLabel = friendlyAdjustment(result.adjustment);

  return (
    <div className={styles.positioningResult}>
      <div className={styles.posHeader}>
        <div className={styles.posWinRate}>
          <span className={styles.posWinPercent}>{(result.winRate * 100).toFixed(0)}%</span>
          <span className={styles.posWinLabel}>Tỉ lệ thắng</span>
        </div>
        <div className={styles.posConfidence} style={{ borderColor: confColor, color: confColor }}>
          {result.confidence === "high" ? "Độ tin cậy cao" : result.confidence === "medium" ? "Độ tin cậy TB" : "Độ tin cậy thấp"}
        </div>
        <div className={styles.posFormation}>
          {formationLabel}{adjustmentLabel !== "Không" ? ` · ${adjustmentLabel}` : ""}
        </div>
      </div>

      <MiniBoard board={board} pieces={myPieces} moves={result.moves} localPlayerId={localPlayerId} />

      <div className={styles.moveList}>
        <div className={styles.moveListTitle}>Các nước đi ({result.moves.length})</div>
        {result.moves.map((move, i) => {
          const piece = myPieces.find(p => p.id === move.pieceId);
          const from = piece ? getPiecePos(board, piece.id) : null;
          return <MoveCard key={move.pieceId} move={move} piece={piece} from={from} index={i} />;
        })}
      </div>

      {result.moves.length > 0 && (
        <button className={`${styles.applyBtn} ${applied ? styles.applyBtnDone : ""}`}
          onClick={handleApply} disabled={applied}>
          {applied ? "✓ Đã áp dụng!" : "⚡ Áp Dụng Tất Cả"}
        </button>
      )}

      {result.opponentBreakdown && result.opponentBreakdown.length > 0 && (
        <div className={styles.posBreakdown}>
          <div className={styles.posBreakdownTitle}>Kết quả theo đối thủ</div>
          {result.opponentBreakdown.map((r, i) => (
            <div key={i} className={styles.posBreakdownRow}>
              <span>{r.label}</span>
              <span className={styles.posBreakdownWR}>{(r.winRate * 100).toFixed(0)}%</span>
              <span className={styles.posBreakdownMargin}>Margin {r.avgSurvivorMargin.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {result.alternatives.length > 0 && (
        <div className={styles.posAlternatives}>
          <div className={styles.posAltTitle}>Phương án khác</div>
          {result.alternatives.map((alt, i) => (
            <div key={i} className={styles.posAltRow}>
              <span>{friendlyFormation(alt.formation)}</span>
              <span>{(alt.winRate * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
