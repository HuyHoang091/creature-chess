import { TacticalRLState, FormationAction, Trajectory, TrainingConfig } from "../types";

/**
 * Simplified PPO Agent for formation selection
 * Uses tabular/policy gradient approach for discrete actions
 */
export class PPOAgent {
  private policyWeights: Map<string, number> = new Map();
  private valueWeights: Map<string, number> = new Map();
  private experiences: { state: TacticalRLState; action: FormationAction; reward: number; logProb: number }[] = [];

  private config: TrainingConfig;
  private entropyCoef = 0.01;
  private clipEpsilon = 0.2;

  constructor(config: Partial<TrainingConfig> = {}) {
    this.config = {
      episodes: 1000,
      saveInterval: 50,
      batchSize: 32,
      learningRate: 0.0003,
      gamma: 0.99,
      lambda: 0.95,
      epsilon: 0.2,
      valueLossCoef: 0.5,
      entropyCoef: 0.01,
      maxGradNorm: 0.5,
      temperature: 1.0,
      ...config
    };

    this.entropyCoef = this.config.entropyCoef;
    this.clipEpsilon = this.config.epsilon;
  }

  /**
   * Select action using current policy
   */
  act(state: TacticalRLState): { action: FormationAction; logProb: number } {
    const availableFormations = [
      'tank_front', 'spread_backline', 'anti_jump',
      'focus_corner', 'protect_left', 'assassin_flank', 'standard'
    ];

    const availableAdjustments = [
      'protect_carry', 'reposition_tank', 'flank_assassin',
      'consolidate_support', 'counter_assassin'
    ];

    // Get action probabilities from policy
    const formationProbs = this.getFormationProbs(state, availableFormations);
    const adjustmentProbs = this.getAdjustmentProbs(state, availableAdjustments);

    // Sample formation
    const formation = this.sampleAction(formationProbs);
    const formationLogProb = Math.log(formationProbs[formation] + 1e-8);

    // Sample adjustment
    const adjustment = this.sampleAction(adjustmentProbs);
    const adjustmentLogProb = Math.log(adjustmentProbs[adjustment] + 1e-8);

    const action: FormationAction = {
      type: 'formation',
      payload: {
        formation: formation as any,
        adjustment: adjustment as any
      }
    };

    const totalLogProb = formationLogProb + adjustmentLogProb;

    return { action, logProb: totalLogProb };
  }

  /**
   * Store experience for training
   */
  storeExperience(state: TacticalRLState, action: FormationAction, reward: number, logProb: number): void {
    this.experiences.push({ state, action, reward, logProb });
  }

  /**
   * Update policy using PPO algorithm
   */
  update(): void {
    if (this.experiences.length < this.config.batchSize) return;

    // Calculate returns and advantages
    const returns = this.calculateReturns();
    const advantages = this.calculateAdvantages();

    // Update policy for each experience
    for (let i = 0; i < this.experiences.length; i++) {
      const exp = this.experiences[i];
      const return_ = returns[i];
      const advantage = advantages[i];

      // Calculate current policy probability
      const currentLogProb = this.calculateLogProb(exp.state, exp.action);

      // PPO clipped objective
      const ratio = Math.exp(currentLogProb - exp.logProb);
      const clippedRatio = Math.max(
        Math.min(ratio, 1 + this.clipEpsilon),
        1 - this.clipEpsilon
      );

      const policyLoss = -Math.min(
        ratio * advantage,
        clippedRatio * advantage
      );

      // Update policy weights (simplified gradient descent)
      this.updatePolicyWeights(exp.state, exp.action, policyLoss);
    }

    // Clear experiences after update
    this.experiences = [];
  }

  /**
   * Calculate returns using discounted rewards
   */
  private calculateReturns(): number[] {
    const returns: number[] = [];
    let cumulativeReturn = 0;

    // Process in reverse for efficiency
    for (let i = this.experiences.length - 1; i >= 0; i--) {
      cumulativeReturn = this.experiences[i].reward + this.config.gamma * cumulativeReturn;
      returns.unshift(cumulativeReturn);
    }

    return returns;
  }

  /**
   * Calculate advantages using GAE
   */
  private calculateAdvantages(): number[] {
    const advantages: number[] = [];
    let gae = 0;

    for (let i = this.experiences.length - 1; i >= 0; i--) {
      const currentValue = this.estimateValue(this.experiences[i].state);
      const nextValue = i < this.experiences.length - 1
        ? this.estimateValue(this.experiences[i + 1].state)
        : 0;

      const delta = this.experiences[i].reward + this.config.gamma * nextValue - currentValue;
      gae = delta + this.config.gamma * this.config.lambda * gae;

      advantages.unshift(gae);
    }

    return advantages;
  }

  /**
   * Get formation probabilities from policy
   */
  private getFormationProbs(state: TacticalRLState, formations: string[]): { [key: string]: number } {
    const logits: { [key: string]: number } = {};

    for (const formation of formations) {
      const key = this.stateToKey(state) + '_formation_' + formation;
      logits[formation] = (this.policyWeights.get(key) || 0) / this.config.temperature;
    }

    // Softmax
    const maxLogit = Math.max(...Object.values(logits));
    const expLogits: { [key: string]: number } = {};
    let sumExp = 0;

    for (const formation of formations) {
      expLogits[formation] = Math.exp(logits[formation] - maxLogit);
      sumExp += expLogits[formation];
    }

    const probs: { [key: string]: number } = {};
    for (const formation of formations) {
      probs[formation] = expLogits[formation] / sumExp;
    }

    return probs;
  }

  /**
   * Get adjustment probabilities from policy
   */
  private getAdjustmentProbs(state: TacticalRLState, adjustments: string[]): { [key: string]: number } {
    const logits: { [key: string]: number } = {};

    for (const adjustment of adjustments) {
      const key = this.stateToKey(state) + '_adjustment_' + adjustment;
      logits[adjustment] = (this.policyWeights.get(key) || 0) / this.config.temperature;
    }

    // Softmax
    const maxLogit = Math.max(...Object.values(logits));
    const expLogits: { [key: string]: number } = {};
    let sumExp = 0;

    for (const adjustment of adjustments) {
      expLogits[adjustment] = Math.exp(logits[adjustment] - maxLogit);
      sumExp += expLogits[adjustment];
    }

    const probs: { [key: string]: number } = {};
    for (const adjustment of adjustments) {
      probs[adjustment] = expLogits[adjustment] / sumExp;
    }

    return probs;
  }

  /**
   * Sample action from probability distribution
   */
  private sampleAction(probs: { [key: string]: number }): string {
    const random = Math.random();
    let cumulative = 0;

    for (const [action, prob] of Object.entries(probs)) {
      cumulative += prob;
      if (random <= cumulative) {
        return action;
      }
    }

    return Object.keys(probs)[0];
  }

  /**
   * Calculate log probability of action under current policy
   */
  private calculateLogProb(state: TacticalRLState, action: FormationAction): number {
    const formation = action.payload.formation || 'standard';
    const adjustment = action.payload.adjustment || 'protect_carry';

    const formationKey = this.stateToKey(state) + '_formation_' + formation;
    const adjustmentKey = this.stateToKey(state) + '_adjustment_' + adjustment;

    const formationLogit = this.policyWeights.get(formationKey) || 0;
    const adjustmentLogit = this.policyWeights.get(adjustmentKey) || 0;

    return formationLogit + adjustmentLogit;
  }

  /**
   * Estimate value of state
   */
  private estimateValue(state: TacticalRLState): number {
    const key = this.stateToKey(state) + '_value';
    return this.valueWeights.get(key) || 0;
  }

  /**
   * Update policy weights (simplified gradient descent)
   */
  private updatePolicyWeights(state: TacticalRLState, action: FormationAction, loss: number): void {
    const formation = action.payload.formation || 'standard';
    const adjustment = action.payload.adjustment || 'protect_carry';

    const formationKey = this.stateToKey(state) + '_formation_' + formation;
    const adjustmentKey = this.stateToKey(state) + '_adjustment_' + adjustment;

    const currentFormationWeight = this.policyWeights.get(formationKey) || 0;
    const currentAdjustmentWeight = this.policyWeights.get(adjustmentKey) || 0;

    this.policyWeights.set(formationKey, currentFormationWeight - this.config.learningRate * loss);
    this.policyWeights.set(adjustmentKey, currentAdjustmentWeight - this.config.learningRate * loss);
  }

  /**
   * Convert state to string key for weight lookup
   */
  private stateToKey(state: TacticalRLState): string {
    // Simplified state representation for tabular methods
    const boardHash = this.hashBoard(state.myBoard);
    const unitClasses = state.unitClasses.join(',');
    const synergies = state.synergies.join(',');

    return `${boardHash}_${unitClasses}_${synergies}`;
  }

  /**
   * Simple hash for board state
   */
  private hashBoard(board: Float32Array): string {
    let hash = 0;
    for (let i = 0; i < Math.min(board.length, 64); i++) {
      hash = ((hash << 5) - hash + Math.floor(board[i] * 10)) | 0;
    }
    return String(hash);
  }

  /**
   * Save model to file
   */
  async saveModel(path: string): Promise<void> {
    const modelData = {
      policyWeights: Array.from(this.policyWeights.entries()),
      valueWeights: Array.from(this.valueWeights.entries()),
      config: this.config
    };

    const fs = require('fs').promises;
    const pathModule = require('path');
    const normalizedPath = path.endsWith('.json') ? path : `${path}.json`;

    // Ensure directory exists
    const dir = pathModule.dirname(normalizedPath);
    await fs.mkdir(dir, { recursive: true });

    // Write model to file
    await fs.writeFile(normalizedPath, JSON.stringify(modelData, null, 2));

    console.log(`Model saved to ${normalizedPath}`);
    console.log(`Policy weights: ${this.policyWeights.size}`);
    console.log(`Value weights: ${this.valueWeights.size}`);
  }

  /**
   * Load model from file
   */
  async loadModel(path: string): Promise<void> {
    const fs = require('fs').promises;

    try {
      const candidatePaths = path.endsWith('.json') ? [path] : [path, `${path}.json`];
      let resolvedPath = candidatePaths[0];
      let data = '';

      for (const candidatePath of candidatePaths) {
        try {
          data = await fs.readFile(candidatePath, 'utf8');
          resolvedPath = candidatePath;
          break;
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      if (!data) {
        throw new Error(`Model file not found for path: ${path}`);
      }

      const modelData = JSON.parse(data);

      // Load policy weights
      this.policyWeights = new Map(modelData.policyWeights);

      // Load value weights
      this.valueWeights = new Map(modelData.valueWeights);

      // Load config
      if (modelData.config) {
        this.config = { ...this.config, ...modelData.config };
      }

      console.log(`Model loaded from ${resolvedPath}`);
      console.log(`Policy weights: ${this.policyWeights.size}`);
      console.log(`Value weights: ${this.valueWeights.size}`);
    } catch (error) {
      console.error(`Failed to load model from ${path}:`, error);
      throw error;
    }
  }
}
