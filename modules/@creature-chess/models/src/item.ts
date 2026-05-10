/**
 * Core item type definitions for the equipment system.
 */

export interface ItemStats {
	attack: number;
	hp: number;
	defense: number;
	speed: number;
	mana: number;
}

export type ItemPassiveTrigger =
	| "onAttackHit"
	| "onTakeDamage"
	| "onBattleStart"
	| "onSkillCast";

export interface ItemPassive {
	id: string;
	name: string;
	description: string;
	trigger: ItemPassiveTrigger;
}

export interface ItemDefinition {
	id: string;
	name: string;
	description: string;
	tier: 1 | 2 | 3;
	icon: string;
	stats: Partial<ItemStats>;
	passive?: ItemPassive;
}

/**
 * A reference to an item held by a piece or in a player's inventory.
 */
export interface ItemInstance {
	itemId: string;
}

/** Maximum number of item slots per piece */
export const MAX_ITEM_SLOTS = 3;
