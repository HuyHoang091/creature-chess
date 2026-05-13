import { BattleAnalysis, BattleReplayData, Recommendation } from "./types";
import { detectIssues } from "./issue-detector";

const generateRecommendations = (data: BattleReplayData, issues: any[]): Recommendation[] => {
  const recs: Recommendation[] = [];

  // Group issues by type and create targeted recommendations
  const issueTypes = new Set(issues.map((i) => i.type));

  if (issueTypes.has("carry_died_first") || issueTypes.has("assassin_weakness")) {
    recs.push({
      category: "positioning",
      priority: 1,
      description: "Chuyển sang anti-jump formation: đặt tank ở góc, carry ở giữa back row.",
      guideReference: "formations.md",
    });
  }

  if (issueTypes.has("no_frontline") || issueTypes.has("tank_in_backline")) {
    recs.push({
      category: "positioning",
      priority: 2,
      description: "Đặt ít nhất 2 tank ở front row (y=0-1) để tạo wall bảo vệ carry.",
      guideReference: "formations.md",
    });
  }

  if (issueTypes.has("carry_ungeared") || issueTypes.has("item_misallocation")) {
    recs.push({
      category: "items",
      priority: 3,
      description: "Ưu tiên craft Bloodthirster hoặc GA cho carry. Tank dùng Warmog/Thornmail.",
      guideReference: "items.md",
    });
  }

  if (issueTypes.has("low_damage_output")) {
    recs.push({
      category: "synergy",
      priority: 4,
      description: "Tìm quân bổ sung synergy đang thiếu. Kiểm tra builds.md để xem comp mạnh nhất hiện tại.",
      guideReference: "builds.md",
    });
  }

  // Generic recommendation if few issues
  if (recs.length === 0 && data.result === "loss") {
    recs.push({
      category: "synergy",
      priority: 5,
      description: "Xem xét reroll hoặc pivot sang comp khác nếu đối thủ đang counter mạnh.",
      guideReference: "counters.md",
    });
  }

  return recs;
};

const generateSummary = (data: BattleReplayData, issues: any[]): string => {
  const resultText = data.result === "win" ? "Thắng" : data.result === "loss" ? "Thua" : "Hòa";
  const issueCount = issues.length;

  if (data.result === "win") {
    return `Chiến thắng ở round ${data.roundNumber}. ${issueCount > 0 ? `Có ${issueCount} điểm cần cải thiện.` : "Lối chơi tốt, giữ nguyên chiến thuật."}`;
  }

  if (issueCount === 0) {
    return `Thua ở round ${data.roundNumber}. Không phát hiện lỗi rõ ràng — có thể đối thủ quá mạnh về level/item.`;
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical");
  if (criticalIssues.length > 0) {
    return `Thua ở round ${data.roundNumber}. ${criticalIssues.length} lỗi nghiêm trọng: ${criticalIssues.map((i) => i.type).join(", ")}.`;
  }

  return `Thua ở round ${data.roundNumber}. ${issueCount} vấn đề cần khắc phục.`;
};

export const analyzeBattle = (data: BattleReplayData): BattleAnalysis => {
  const issues = detectIssues(data);
  const recommendations = generateRecommendations(data, issues);

  const totalDamageDealt = data.myPieces.reduce(
    (sum, p) => sum + (p.lastBattleStats?.damageDealt || 0),
    0
  );
  const totalDamageTaken = data.myPieces.reduce(
    (sum, p) => sum + (p.lastBattleStats?.damageTaken || 0),
    0
  );

  const livingPieces = data.myPieces.filter(
    (p) => (p.lastBattleStats?.turnsSurvived || 0) > 0
  );
  const avgTurnsSurvived =
    livingPieces.length > 0
      ? livingPieces.reduce((sum, p) => sum + (p.lastBattleStats?.turnsSurvived || 0), 0) /
        livingPieces.length
      : 0;

  const carry = data.myPieces.find((p) => {
    const id = p.definitionId;
    return id >= 11 && id <= 25;
  });
  const carryDamageShare =
    totalDamageDealt > 0 && carry && carry.lastBattleStats
      ? carry.lastBattleStats.damageDealt / totalDamageDealt
      : 0;

  const tanks = data.myPieces.filter((p) => p.definitionId >= 1 && p.definitionId <= 10);
  const tankSurvivalRate =
    tanks.length > 0
      ? tanks.filter((t) => (t.lastBattleStats?.turnsSurvived || 0) > 30).length / tanks.length
      : 0;

  return {
    winner: data.result,
    summary: generateSummary(data, issues),
    issues,
    recommendations,
    stats: {
      totalDamageDealt,
      totalDamageTaken,
      avgTurnsSurvived,
      carryDamageShare,
      tankSurvivalRate,
    },
  };
};
