#!/usr/bin/env node

import { PPOAgent } from "../agent/ppoAgent";

/**
 * Evaluation script for RL Bot
 * Usage: ts-node evaluate.ts --model ./models/final
 */
async function main() {
  const args = process.argv.slice(2);
  const modelPath = args.find(a => a.startsWith('--model='))?.split('=')[1] || './training/models/final';

  console.log('=== Creature Chess RL Bot Evaluation ===');
  console.log(`Model: ${modelPath}`);
  console.log('');

  const agent = new PPOAgent();

  // Load model
  try {
    await agent.loadModel(modelPath);
    console.log('Model loaded successfully');
  } catch (error) {
    console.error('Failed to load model:', error);
    process.exit(1);
  }

  console.log('=== Model Statistics ===');
  console.log(`Policy weights: ${(agent as any).policyWeights?.size || 0}`);
  console.log(`Value weights: ${(agent as any).valueWeights?.size || 0}`);
  console.log('');
  console.log('Note: Real evaluation requires running the bot in a game with BOT_MODE=rl');
  console.log('Training and evaluation happen automatically during gameplay!');
}

main().catch(error => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
