/**
 * Core types for RL Bot positioning system
 */

// Tactical state representation for positioning decisions
export interface TacticalRLState {
  // My board (8x8) - core positioning data
  myBoard: Float32Array;    // 8x8x[creatureId+level+range+role]

  // Enemy board (8x8) - real opponent threat assessment
  enemyBoard: Float32Array;  // 8x8x[creatureId+level+range+role]

  // Potential enemy board (8x8) - second opponent preview
  potentialEnemyBoard: Float32Array;  // 8x8x[creatureId+level+range+role]

  // Unit classes & synergies - tactical context
  unitClasses: Float32Array;  // [tank, carry, support, assassin] counts
  synergies: Float32Array;    // [fire, water, earth, air] bonuses

  // Important threats - priority targeting
  threats: Float32Array;       // Top 3 enemy threats

  // Current matchup - strategic context
  matchup: Float32Array;      // [advantage, disadvantage, neutral]
}

// Formation archetype action
export interface FormationAction {
  type: 'formation' | 'adjustment';
  payload: {
    // Formation archetype selection (high-level)
    formation?: 'protect_left' | 'spread_backline' | 'anti_jump' | 'focus_corner' | 'standard' | 'tank_front' | 'assassin_flank';

    // Small tactical adjustments (low-level)
    adjustment?: 'protect_carry' | 'reposition_tank' | 'flank_assassin' | 'consolidate_support' | 'counter_assassin';

    // Target piece (optional, for adjustments)
    targetPieceId?: string;
  };
}

// Combat state for reward calculation
export interface CombatState {
  allyUnits: UnitCombatData[];
  enemyUnits: UnitCombatData[];
  enemiesKilled: number;
  totalEnemies: number;
  alliesLost: number;
  totalAllies: number;
  damageDealt: number;
  damageTaken: number;
}

export interface UnitCombatData {
  id: string;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  role: 'tank' | 'carry' | 'support' | 'assassin';
  isAlive: boolean;
}

// Training trajectory
export interface Trajectory {
  states: TacticalRLState[];
  actions: FormationAction[];
  rewards: number[];
  logProbs: number[];
  dones: boolean[];
}

// Training configuration
export interface TrainingConfig {
  episodes: number;
  saveInterval: number;
  batchSize: number;
  learningRate: number;
  gamma: number;          // Discount factor
  lambda: number;         // GAE lambda
  epsilon: number;        // PPO clipping
  valueLossCoef: number;
  entropyCoef: number;
  maxGradNorm: number;
  temperature: number;      // Action sampling temperature (>1 = easier/random, <1 = harder/greedy)
}

// Model version
export interface ModelVersion {
  version: string;
  path: string;
  timestamp: Date;
  metrics: TrainingMetrics;
}

// Training metrics
export interface TrainingMetrics {
  episode: number;
  winRate: number;
  avgReward: number;
  combatMargin: number;
  loss: number;
  policyLoss: number;
  valueLoss: number;
  entropy: number;
  gpuUtilization: number;
  throughput: number; // games per second
}

// Opponent types for self-play
export type OpponentType = 'random' | 'rule_based' | 'self_play_checkpoint';

export interface OpponentConfig {
  type: OpponentType;
  weight: number;
  modelPath?: string;
}

// Augmented game state for symmetry
export interface AugmentedGameState {
  original: TacticalRLState;
  horizontalFlip: TacticalRLState;
  verticalFlip: TacticalRLState;
  rotate180: TacticalRLState;
}
