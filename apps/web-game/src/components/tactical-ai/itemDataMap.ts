export interface ItemStats {
  attack?: number;
  defense?: number;
  hp?: number;
  speed?: number;
  mana?: number;
}

export interface ItemDisplayInfo {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2;
  description: string;
  stats: ItemStats;
}

interface AllItemData extends ItemDisplayInfo {
  recipeFrom?: [string, string];
}

const ALL_ITEMS: Record<string, AllItemData> = {
  BF_SWORD:       { id: "BF_SWORD",       name: "B.F. Sword",            icon: "⚔️", tier: 1, description: "+15 Attack",                        stats: { attack: 15 } },
  CHAIN_VEST:     { id: "CHAIN_VEST",     name: "Chain Vest",            icon: "🛡️", tier: 1, description: "+15 Defense",                       stats: { defense: 15 } },
  GIANTS_BELT:   { id: "GIANTS_BELT",   name: "Giant's Belt",           icon: "💚", tier: 1, description: "+150 HP",                           stats: { hp: 150 } },
  RECURVE_BOW:    { id: "RECURVE_BOW",    name: "Recurve Bow",            icon: "🏹", tier: 1, description: "+15 Speed",                         stats: { speed: 15 } },
  TEAR:           { id: "TEAR",           name: "Tear of the Goddess",    icon: "💧", tier: 1, description: "+15 Mana",                          stats: { mana: 15 } },
  CLOAK:          { id: "CLOAK",          name: "Negatron Cloak",         icon: "🧥", tier: 1, description: "+10 Defense, +10 Speed",            stats: { defense: 10, speed: 10 } },
  ROD:            { id: "ROD",            name: "Needlessly Large Rod",   icon: "🪄", tier: 1, description: "+10 Attack, +10 Mana",             stats: { attack: 10, mana: 10 } },
  GLOVES:         { id: "GLOVES",         name: "Sparring Gloves",        icon: "🧤", tier: 1, description: "+8 Attack, +8 Speed",              stats: { attack: 8, speed: 8 } },

  INFINITY_EDGE:  { id: "INFINITY_EDGE",  name: "Infinity Edge",         icon: "🗡️", tier: 2, description: "+40 Attack",                       stats: { attack: 40 },            recipeFrom: ["BF_SWORD", "BF_SWORD"] },
  WARMOG:         { id: "WARMOG",         name: "Warmog's Armor",         icon: "❤️", tier: 2, description: "+400 HP",                           stats: { hp: 400 },              recipeFrom: ["GIANTS_BELT", "GIANTS_BELT"] },
  BLOODTHIRSTER:  { id: "BLOODTHIRSTER",  name: "Bloodthirster",          icon: "🩸", tier: 2, description: "+20 ATK, +10 DEF, +10 SPD. Lifesteal", stats: { attack: 20, defense: 10, speed: 10 }, recipeFrom: ["BF_SWORD", "CLOAK"] },
  RAPID_FIRE:     { id: "RAPID_FIRE",     name: "Rapid Firecannon",       icon: "⚡", tier: 2, description: "+40 Speed",                         stats: { speed: 40 },            recipeFrom: ["RECURVE_BOW", "RECURVE_BOW"] },
  FROZEN_HEART:   { id: "FROZEN_HEART",   name: "Frozen Heart",           icon: "❄️", tier: 2, description: "+15 DEF, +15 Mana. Attackers that hit this unit are slowed for 2s", stats: { defense: 15, mana: 15 },  recipeFrom: ["CHAIN_VEST", "TEAR"] },
  GUARDIAN_ANGEL: { id: "GUARDIAN_ANGEL", name: "Guardian Angel",         icon: "👼", tier: 2, description: "+15 ATK, +15 DEF. Revive once",    stats: { attack: 15, defense: 15 }, recipeFrom: ["BF_SWORD", "CHAIN_VEST"] },
  RABADON:        { id: "RABADON",        name: "Rabadon's Deathcap",    icon: "🎩", tier: 2, description: "+25 ATK, +25 Mana",                stats: { attack: 25, mana: 25 },  recipeFrom: ["ROD", "ROD"] },
  PHANTOM_DANCER: { id: "PHANTOM_DANCER", name: "Phantom Dancer",         icon: "💃", tier: 2, description: "+15 SPD, +15 DEF. Dodge",          stats: { speed: 15, defense: 15 }, recipeFrom: ["RECURVE_BOW", "CHAIN_VEST"] },
  THORNMAIL:      { id: "THORNMAIL",      name: "Thornmail",              icon: "🌵", tier: 2, description: "+40 DEF. Reflect damage",          stats: { defense: 40 },           recipeFrom: ["CHAIN_VEST", "CHAIN_VEST"] },
};

export function lookupItemById(id: string): ItemDisplayInfo | null {
  return ALL_ITEMS[id] ?? null;
}

export function lookupItemByName(name: string): ItemDisplayInfo | null {
  const key = name.toLowerCase().trim();
  for (const item of Object.values(ALL_ITEMS)) {
    if (item.name.toLowerCase() === key) return item;
  }
  for (const item of Object.values(ALL_ITEMS)) {
    if (item.name.toLowerCase().includes(key) || key.includes(item.name.toLowerCase())) {
      return item;
    }
  }
  return null;
}

export function getRecipeFor(itemId: string): [ItemDisplayInfo, ItemDisplayInfo] | null {
  const item = ALL_ITEMS[itemId];
  if (!item || !item.recipeFrom) return null;
  const a = lookupItemById(item.recipeFrom[0]);
  const b = lookupItemById(item.recipeFrom[1]);
  if (!a || !b) return null;
  return [a, b];
}
