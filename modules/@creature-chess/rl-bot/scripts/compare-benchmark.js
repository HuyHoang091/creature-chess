/**
 * So sánh kết quả benchmark giữa RL Bot và Rule-Based Bot
 *
 * Usage:
 *   node modules/@creature-chess/rl-bot/scripts/compare-benchmark.js \
 *     benchmark-rl-1715412000000.json \
 *     benchmark-rule-1715413000000.json
 */

const fs = require("fs");
const path = require("path");

const rlFile = process.argv[2];
const ruleFile = process.argv[3];

if (!rlFile || !ruleFile) {
  console.log("Usage: node compare-benchmark.js <rl-results.json> <rule-results.json>");
  process.exit(1);
}

function load(p) {
  const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(full)) {
    console.error(`File not found: ${full}`);
    process.exit(1);
  }
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    console.error(`Path is a directory, not a file: ${full}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

const rl = load(rlFile);
const rule = load(ruleFile);

function diff(rlVal, ruleVal) {
  const d = rlVal - ruleVal;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(3)}`;
}

function pctDiff(rlVal, ruleVal) {
  if (ruleVal === 0) return rlVal > 0 ? "+∞" : "0";
  const d = ((rlVal - ruleVal) / ruleVal) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

console.log(`\n📊 Benchmark Comparison: RL Bot vs Rule-Based Bot\n`);
console.log(`   RL   : ${rl.completedGames}/${rl.totalGames} games | ${rlFile}`);
console.log(`   Rule : ${rule.completedGames}/${rule.totalGames} games | ${ruleFile}\n`);

const rows = [
  { label: "Win Rate", rl: rl.winRate, rule: rule.winRate, fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { label: "Top-4 Rate", rl: rl.top4Rate, rule: rule.top4Rate, fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { label: "Avg Rank", rl: rl.avgRank, rule: rule.avgRank, fmt: (v) => v.toFixed(2) },
  { label: "Errors", rl: rl.errors, rule: rule.errors, fmt: (v) => `${v}` },
];

console.log(`┌────────────┬────────────┬────────────┬──────────┬──────────┐`);
console.log(`│ Metric     │ RL Bot     │ Rule-Based │ Diff     │ % Diff   │`);
console.log(`├────────────┼────────────┼────────────┼──────────┼──────────┤`);

for (const r of rows) {
  const d = diff(r.rl, r.rule);
  const pd = pctDiff(r.rl, r.rule);
  console.log(
    `│ ${r.label.padEnd(10)} │ ${r.fmt(r.rl).padEnd(10)} │ ${r.fmt(r.rule).padEnd(10)} │ ${d.padEnd(8)} │ ${pd.padEnd(8)} │`
  );
}

console.log(`└────────────┴────────────┴────────────┴──────────┴──────────┘\n`);

// Verdict
if (rl.winRate > rule.winRate && rl.top4Rate >= rule.top4Rate) {
  console.log("✅ RL Bot outperforms Rule-Based Bot");
} else if (rl.winRate < rule.winRate && rl.top4Rate <= rule.top4Rate) {
  console.log("⚠️  RL Bot underperforms Rule-Based Bot");
} else {
  console.log("🤝 Mixed results — review individual metrics");
}

// Write combined report
const combined = {
  rl: { file: rlFile, ...rl },
  rule: { file: ruleFile, ...rule },
  comparison: {
    winRateDiff: rl.winRate - rule.winRate,
    top4RateDiff: rl.top4Rate - rule.top4Rate,
    avgRankDiff: rl.avgRank - rule.avgRank,
    verdict: rl.winRate > rule.winRate && rl.top4Rate >= rule.top4Rate ? "rl_win" : rl.winRate < rule.winRate ? "rule_win" : "mixed",
  },
  timestamp: new Date().toISOString(),
};

const outPath = path.join(process.cwd(), `benchmark-comparison-${Date.now()}.json`);
fs.writeFileSync(outPath, JSON.stringify(combined, null, 2));
console.log(`\n💾 Combined report saved to ${outPath}\n`);
