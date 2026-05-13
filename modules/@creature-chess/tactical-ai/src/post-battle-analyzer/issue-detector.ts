import { PieceModel } from "@creature-chess/models";
import { Issue, IssueSeverity, BattleReplayData } from "./types";

// Simplified role detection based on definitionId ranges (aligned with actionDecoder)
const getPieceRole = (piece: PieceModel): "tank" | "carry" | "assassin" | "support" | "unknown" => {
  const id = piece.definitionId;
  // These ranges are approximate; adjust based on actual creature definitions
  if (id >= 1 && id <= 10) return "tank";
  if (id >= 11 && id <= 25) return "carry";
  if (id >= 26 && id <= 35) return "assassin";
  if (id >= 36 && id <= 47) return "support";
  return "unknown";
};

const getPieceName = (piece: PieceModel): string => {
  return piece.definition?.name || `Piece #${piece.definitionId}`;
};

export const detectIssues = (data: BattleReplayData): Issue[] => {
  const issues: Issue[] = [];

  // 1. Carry died first (assassin dive)
  const myCarry = data.myPieces.find((p) => getPieceRole(p) === "carry");
  if (myCarry && myCarry.lastBattleStats) {
    const carryTurns = myCarry.lastBattleStats.turnsSurvived;
    const avgTurns =
      data.myPieces.reduce((sum, p) => sum + (p.lastBattleStats?.turnsSurvived || 0), 0) /
      data.myPieces.length;

    if (carryTurns < avgTurns * 0.5 && carryTurns < 30) {
      issues.push({
        type: "carry_died_first",
        severity: "critical",
        description: `${getPieceName(myCarry)} chết quá sớm (sống ${carryTurns} turn, trung bình team ${avgTurns.toFixed(1)})`,
        relatedPieceIds: [myCarry.id],
        suggestion: "Đặt carry xa hơn hoặc thêm tank bảo vệ. Xem guide: anti-jump formation.",
      });
    }
  }

  // 2. Tank in backline (poor positioning)
  const myTanks = data.myPieces.filter((p) => getPieceRole(p) === "tank");
  for (const tank of myTanks) {
    if (tank.lastBattleStats && tank.lastBattleStats.turnsSurvived > 80) {
      // Tank sống lâu nhưng team vẫn thua → có thể tank đứng sau không chịu damage
      if (data.result === "loss") {
        issues.push({
          type: "tank_in_backline",
          severity: "major",
          description: `${getPieceName(tank)} sống lâu (${tank.lastBattleStats.turnsSurvived} turn) nhưng team thua — có thể tank đang đứng sau không bảo vệ được carry`,
          relatedPieceIds: [tank.id],
          suggestion: "Đặt tank lên front row để hứng damage cho backline.",
        });
      }
    }
  }

  // 3. No frontline (all pieces in back)
  if (myTanks.length === 0) {
    issues.push({
      type: "no_frontline",
      severity: "critical",
      description: "Không có tank — đối thủ có thể dive carry ngay lập tức",
      relatedPieceIds: [],
      suggestion: "Tìm quân có skill phòng thủ hoặc nhiều máu để đặt front row.",
    });
  }

  // 4. Carry no items
  if (myCarry && myCarry.items.length === 0) {
    issues.push({
      type: "carry_ungeared",
      severity: "major",
      description: `${getPieceName(myCarry)} không có item nào`,
      relatedPieceIds: [myCarry.id],
      suggestion: "Ưu tiên item damage cho carry (Bloodthirster, Infinity Edge).",
    });
  }

  // 5. Tank has damage items (item waste)
  for (const tank of myTanks) {
    const damageItems = tank.items.filter((i) =>
      ["bf_sword", "recurve_bow", "rod"].includes(i.itemId)
    );
    if (damageItems.length > 0 && tank.items.length >= 2) {
      issues.push({
        type: "item_misallocation",
        severity: "minor",
        description: `${getPieceName(tank)} là tank nhưng có ${damageItems.length} damage item`,
        relatedPieceIds: [tank.id],
        suggestion: "Chuyển damage item sang carry, tank nên dùng defensive item.",
      });
    }
  }

  // 6. Low damage overall (synergy/level issue)
  const totalDamageDealt = data.myPieces.reduce(
    (sum, p) => sum + (p.lastBattleStats?.damageDealt || 0),
    0
  );
  if (totalDamageDealt < data.myPieces.length * 500) {
    issues.push({
      type: "low_damage_output",
      severity: "major",
      description: `Tổng damage team quá thấp (${totalDamageDealt}) — có thể thiếu carry hoặc synergy yếu`,
      relatedPieceIds: data.myPieces
        .filter((p) => (p.lastBattleStats?.damageDealt || 0) < 200)
        .map((p) => p.id),
      suggestion: "Kiểm tra synergy element và combat trait. Cần ít nhất 1 quân damage chính ở stage cao.",
    });
  }

  // 7. Enemy assassin heavy, no counter
  const enemyAssassins = data.enemyPieces.filter((p) => getPieceRole(p) === "assassin");
  if (enemyAssassins.length >= 3) {
    const hasAntiJump = data.myPieces.some(
      (p) => getPieceRole(p) === "tank" && p.items.some((i) => i.itemId === "thornmail")
    );
    if (!hasAntiJump) {
      issues.push({
        type: "assassin_weakness",
        severity: "major",
        description: `Đối thủ có ${enemyAssassins.length} assassin nhưng team không có counter`,
        relatedPieceIds: data.enemyPieces
          .filter((p) => getPieceRole(p) === "assassin")
          .map((p) => p.id),
        suggestion: "Dùng anti-jump formation: đặt tank ở góc bảo vệ carry, hoặc gắn Thornmail.",
      });
    }
  }

  return issues;
};
