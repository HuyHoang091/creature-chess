#!/usr/bin/env node

/**
 * RL Bot Training Script
 *
 * IMPORTANT: Training now happens AUTOMATICALLY during real gameplay!
 * When BOT_MODE=rl or BOT_MODE=hybrid, the bot collects real combat
 * results and updates its model after each round.
 *
 * This script is kept for:
 * 1. Manual model evaluation
 * 2. Model inspection
 * 3. Converting saved experiences to training data
 *
 * Usage: ts-node train.ts --mode=eval --model=./training/models/final
 */

import { PPOAgent } from "../agent/ppoAgent";
import { TrainingConfig } from "../types";

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'eval';
  const modelPath = args.find(a => a.startsWith('--model='))?.split('=')[1] || './training/models/final';

  console.log('=== Creature Chess RL Bot ===');
  console.log(`Mode: ${mode}`);
  console.log(`Model: ${modelPath}`);
  console.log('');

  if (mode === 'eval') {
    // Evaluate a saved model
    const agent = new PPOAgent();
    try {
      await agent.loadModel(modelPath);
      console.log('Model loaded successfully');
      console.log(`Policy weights: ${(agent as any).policyWeights?.size || 0}`);
      console.log(`Value weights: ${(agent as any).valueWeights?.size || 0}`);
    } catch (error) {
      console.error('Failed to load model:', error);
    }
  } else if (mode === 'info') {
    // Show training info
    console.log('Training happens automatically during gameplay:');
    console.log('1. Set BOT_MODE=rl or BOT_MODE=hybrid in .env');
    console.log('2. Start the game server');
    console.log('3. Bot plays real games and learns from combat results');
    console.log('4. Model auto-saves every 50 experiences');
    console.log('');
    console.log('Manual training is no longer needed - the bot learns from real games!');
  } else {
    console.log('Unknown mode. Use --mode=eval or --mode=info');
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
