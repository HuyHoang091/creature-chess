const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return { env, exists: false };
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    env[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
  }
  return { env, exists: true };
}

function extractEnvVarsFromJS(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const regex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

const { env: exampleEnv, exists: exampleExists } = parseEnvFile(path.join(ROOT, ".env.example"));
const loadTestPath = path.join(ROOT, "load-test.js");
const loadTestVars = extractEnvVarsFromJS(loadTestPath);

console.log("========================================");
console.log("     RL Setup & Model Load Checker     ");
console.log("========================================\n");

// 1. .env.example
console.log("[1] .env.example status:");
console.log(`    File: ${exampleExists ? "FOUND" : "NOT FOUND"}`);
console.log(`    Defined keys: ${Object.keys(exampleEnv).length}`);

// 2. load-test env var audit
console.log("\n[2] load-test.js environment variable audit:");
const missingInExample = [];
const presentInExample = [];
for (const v of loadTestVars) {
  if (exampleEnv.hasOwnProperty(v)) {
    presentInExample.push(v);
  } else {
    missingInExample.push(v);
  }
}

if (presentInExample.length) {
  console.log(`    Defined in .env.example:`);
  for (const v of presentInExample) {
    console.log(`      ${v} = ${exampleEnv[v]}`);
  }
}
if (missingInExample.length) {
  console.log(`    MISSING in .env.example (will use hardcoded defaults):`);
  for (const v of missingInExample) {
    console.log(`      ${v}`);
  }
} else {
  console.log("    All variables found in .env.example.");
}

// 3. RL Model path check
console.log("\n[3] RL Model Final Load Check:");
const rlModelPathEnv = process.env.RL_MODEL_PATH;
const rlModelPathExample = exampleEnv["RL_MODEL_PATH"];
const rlModelPath = rlModelPathEnv || rlModelPathExample || "./training/models/final";

console.log(`    process.env.RL_MODEL_PATH   : ${rlModelPathEnv || "(not set)"}`);
console.log(`    .env.example RL_MODEL_PATH  : ${rlModelPathExample || "(not set)"}`);
console.log(`    Effective path used by bot  : ${rlModelPath}`);

const trainingModeEnv = process.env.TRAINING_MODE;
const trainingModeExample = exampleEnv["TRAINING_MODE"];
const trainingEnabled = (trainingModeEnv ?? trainingModeExample ?? "true") !== "false";
console.log(`    TRAINING_MODE               : ${trainingModeEnv || trainingModeExample || "(not set)"} -> Training ${trainingEnabled ? "ENABLED" : "DISABLED (inference only)"}`);

const normalizedPath = rlModelPath.endsWith(".json") ? rlModelPath : `${rlModelPath}.json`;
const absolutePath = path.resolve(ROOT, normalizedPath);
console.log(`    Resolved absolute path      : ${absolutePath}`);

if (fs.existsSync(absolutePath)) {
  const stats = fs.statSync(absolutePath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`    File STATUS                 : EXISTS (${sizeKB} KB)`);
  console.log(`    Last modified               : ${stats.mtime.toISOString()}`);

  // Quick validation: read first bytes to ensure it's valid JSON
  try {
    const raw = fs.readFileSync(absolutePath, "utf-8");
    const data = JSON.parse(raw);
    const policyCount = Array.isArray(data.policyWeights) ? data.policyWeights.length : "N/A";
    const valueCount = Array.isArray(data.valueWeights) ? data.valueWeights.length : "N/A";
    console.log(`    JSON valid                  : YES`);
    console.log(`    Policy weights entries      : ${policyCount}`);
    console.log(`    Value weights entries       : ${valueCount}`);
  } catch (e) {
    console.log(`    JSON valid                  : NO (${e.message})`);
  }
} else {
  console.log(`    File STATUS                 : NOT FOUND`);
  console.log(`    -> Bot will start training from scratch on first game.`);
}

// 4. Process environment for load-test (critical!)
console.log("\n[4] load-test.js process environment (CRITICAL):");
console.log(`    process.env.GAME_SERVER_URL  : ${process.env.GAME_SERVER_URL || "(not set -> fallback http://localhost:3001)"}`);
console.log(`    process.env.INFO_SERVER_URL  : ${process.env.INFO_SERVER_URL || "(not set -> fallback http://localhost:3000)"}`);

if (!process.env.GAME_SERVER_URL || !process.env.INFO_SERVER_URL) {
  console.log(`\n    WARNING: load-test.js is a standalone Node script.`);
  console.log(`    It does NOT automatically load .env.example like the server does.`);
  console.log(`    The server uses:  env-cmd -f .env.example yarn start-server-game`);
  console.log(`    But you ran:       node load-test.js`);
  console.log(`    If you want load-test to read .env.example, run it as:`);
  console.log(`      npx env-cmd -f .env.example node load-test.js`);
  console.log(`    Or export the variables manually before running.`);
}

// 5. Check build freshness
console.log("\n[5] RL Bot Package Build Status:");
const distPath = path.join(ROOT, "modules", "@creature-chess", "rl-bot", "dist", "index.js");
const srcPath = path.join(ROOT, "modules", "@creature-chess", "rl-bot", "src", "index.ts");

if (fs.existsSync(distPath)) {
  const distMtime = fs.statSync(distPath).mtime;
  console.log(`    dist/index.js : EXISTS (${distMtime.toISOString()})`);
  if (fs.existsSync(srcPath)) {
    const srcMtime = fs.statSync(srcPath).mtime;
    if (srcMtime > distMtime) {
      console.log(`    WARNING: src/index.ts is NEWER than dist/index.js!`);
      console.log(`    -> Run 'yarn build' inside modules/@creature-chess/rl-bot/`);
    } else {
      console.log(`    Build is up to date.`);
    }
  }
} else {
  console.log(`    dist/index.js : NOT FOUND (package not built!)`);
}

console.log("\n========================================");
console.log("              End of Report              ");
console.log("========================================");
