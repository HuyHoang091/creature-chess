/**
 * Item crafting recipes: combining two base items into a combined item.
 */

/** Sorted key of two item IDs joined by "+" */
function makeRecipeKey(a: string, b: string): string {
	return [a, b].sort().join("+");
}

const RECIPES = new Map<string, string>([
	[makeRecipeKey("BF_SWORD", "BF_SWORD"), "INFINITY_EDGE"],
	[makeRecipeKey("GIANTS_BELT", "GIANTS_BELT"), "WARMOG"],
	[makeRecipeKey("BF_SWORD", "CLOAK"), "BLOODTHIRSTER"],
	[makeRecipeKey("RECURVE_BOW", "RECURVE_BOW"), "RAPID_FIRE"],
	[makeRecipeKey("CHAIN_VEST", "TEAR"), "FROZEN_HEART"],
	[makeRecipeKey("BF_SWORD", "CHAIN_VEST"), "GUARDIAN_ANGEL"],
	[makeRecipeKey("ROD", "ROD"), "RABADON"],
	[makeRecipeKey("RECURVE_BOW", "CHAIN_VEST"), "PHANTOM_DANCER"],
	[makeRecipeKey("CHAIN_VEST", "CHAIN_VEST"), "THORNMAIL"],
]);

/**
 * Look up whether two items can be combined.
 * @returns The resulting item ID, or null if no recipe matches.
 */
export function findRecipe(itemA: string, itemB: string): string | null {
	const key = makeRecipeKey(itemA, itemB);
	return RECIPES.get(key) ?? null;
}

/**
 * Get all available recipes (for UI display).
 */
export function getAllRecipes(): { itemA: string; itemB: string; result: string }[] {
	const results: { itemA: string; itemB: string; result: string }[] = [];
	for (const [key, result] of RECIPES.entries()) {
		const [itemA, itemB] = key.split("+");
		results.push({ itemA, itemB, result });
	}
	return results;
}
