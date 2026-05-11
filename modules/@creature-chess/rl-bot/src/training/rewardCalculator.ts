import { CombatState } from "../types";

/**
 * Combat margin reward system for positioning optimization
 * Uses dense rewards instead of sparse win/loss
 */
export class RewardCalculator {
  
  /**
   * Main reward calculation based on combat margin
   * Focus: remaining ally strength vs remaining enemy strength
   */
  calculateCombatMarginReward(combatState: CombatState): number {
    // Calculate remaining strength for allies
    const allyStrength = this.calculateRemainingStrength(combatState.allyUnits);
    
    // Calculate remaining strength for enemies
    const enemyStrength = this.calculateRemainingStrength(combatState.enemyUnits);
    
    // Combat margin: normalized difference
    const totalStrength = allyStrength + enemyStrength;
    const combatMargin = totalStrength > 0 ? (allyStrength - enemyStrength) / totalStrength : 0;
    
    // Alternative: kill ratio
    const killRatio = combatState.totalEnemies > 0 && combatState.totalAllies > 0 ? 
      (combatState.enemiesKilled / combatState.totalEnemies) - (combatState.alliesLost / combatState.totalAllies) : 0;
    
    // Alternative: damage margin
    const totalDamage = combatState.damageDealt + combatState.damageTaken;
    const damageMargin = totalDamage > 0 ? (combatState.damageDealt - combatState.damageTaken) / totalDamage : 0;
    
    // Primary reward (70% weight) - combat margin
    const mainReward = combatMargin * 0.7;
    
    // Secondary rewards (small weights to avoid hardcoding)
    const carryProtectionBonus = this.checkCarrySurvival(combatState) * 0.1;
    const tankEffectivenessBonus = this.checkTankAbsorption(combatState) * 0.1;
    const formationSynergyBonus = this.checkAdjacentBuffs(combatState) * 0.1;
    
    return mainReward + carryProtectionBonus + tankEffectivenessBonus + formationSynergyBonus;
  }
  
  /**
   * Calculate remaining strength of units
   * Considers HP ratio, attack power, and tankiness
   */
  private calculateRemainingStrength(units: CombatState['allyUnits']): number {
    return units.reduce((strength, unit) => {
      if (!unit.isAlive) return strength;
      
      const hpRatio = unit.currentHealth / unit.maxHealth;
      const damageOutput = unit.attack * unit.attackSpeed;
      const tankiness = unit.defense + unit.maxHealth;
      
      return strength + (hpRatio * damageOutput * tankiness);
    }, 0);
  }
  
  /**
   * Check if carry units survived (positioning protection)
   */
  private checkCarrySurvival(combatState: CombatState): number {
    const carryUnits = combatState.allyUnits.filter(u => u.role === 'carry');
    if (carryUnits.length === 0) return 0;
    
    const survivingCarries = carryUnits.filter(u => u.isAlive).length;
    const totalCarries = carryUnits.length;
    
    // Bonus for carry survival
    return (survivingCarries / totalCarries) * 2 - 1; // Range: -1 to 1
  }
  
  /**
   * Check tank effectiveness (damage absorption)
   */
  private checkTankAbsorption(combatState: CombatState): number {
    const tankUnits = combatState.allyUnits.filter(u => u.role === 'tank');
    if (tankUnits.length === 0) return 0;
    
    // Calculate if tanks absorbed more damage than carries
    const tankDamageTaken = tankUnits.reduce((sum, u) => sum + (u.maxHealth - u.currentHealth), 0);
    const carryUnits = combatState.allyUnits.filter(u => u.role === 'carry');
    const carryDamageTaken = carryUnits.reduce((sum, u) => sum + (u.maxHealth - u.currentHealth), 0);
    
    const totalDamage = tankDamageTaken + carryDamageTaken;
    if (totalDamage === 0) return 0;
    
    // Bonus if tanks took more proportional damage
    const tankRatio = tankUnits.length / combatState.allyUnits.length;
    const damageRatio = tankDamageTaken / totalDamage;
    
    return damageRatio > tankRatio ? 1.0 : -0.5;
  }
  
  /**
   * Check formation synergy (adjacent buff utilization)
   */
  private checkAdjacentBuffs(combatState: CombatState): number {
    // Simple check: if support units are adjacent to carries
    const supports = combatState.allyUnits.filter(u => u.role === 'support');
    const carries = combatState.allyUnits.filter(u => u.role === 'carry');
    
    if (supports.length === 0 || carries.length === 0) return 0;
    
    // Count supports near carries (simplified)
    let adjacencyScore = 0;
    for (const support of supports) {
      if (support.isAlive) {
        adjacencyScore += 0.2; // Simplified adjacency check
      }
    }
    
    return Math.min(adjacencyScore, 1.0);
  }
  
  /**
   * Calculate final episode reward (end of combat)
   */
  calculateFinalReward(combatState: CombatState): number {
    // Main combat margin reward
    const marginReward = this.calculateCombatMarginReward(combatState);
    
    // Win/loss bonus (small weight to avoid sparse reward dominance)
    const allyAlive = combatState.allyUnits.filter(u => u.isAlive).length;
    const enemyAlive = combatState.enemyUnits.filter(u => u.isAlive).length;
    
    let winBonus = 0;
    if (enemyAlive === 0 && allyAlive > 0) {
      winBonus = 2.0; // Win
    } else if (allyAlive === 0 && enemyAlive > 0) {
      winBonus = -1.0; // Loss
    } else {
      winBonus = -0.5; // Draw/tie
    }
    
    return marginReward + (winBonus * 0.3); // Win bonus only 30% weight
  }
}
