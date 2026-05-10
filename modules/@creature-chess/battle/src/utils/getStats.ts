import { PieceModel, getItemDefinition } from "@creature-chess/models";

export const getStats = (piece: PieceModel) => {
	const base = piece.definition.stages[piece.stage];

	if (!piece.items || piece.items.length === 0) {
		return base;
	}

	let itemBonusHp = 0;
	let itemBonusAttack = 0;
	let itemBonusDefense = 0;
	let itemBonusSpeed = 0;
	let itemBonusMana = 0;

	for (const item of piece.items) {
		const itemDef = getItemDefinition(item.itemId);
		if (itemDef?.stats) {
			itemBonusHp += itemDef.stats.hp || 0;
			itemBonusAttack += itemDef.stats.attack || 0;
			itemBonusDefense += itemDef.stats.defense || 0;
			itemBonusSpeed += itemDef.stats.speed || 0;
			itemBonusMana += itemDef.stats.mana || 0;
		}
	}

	return {
		...base,
		hp: base.hp + itemBonusHp,
		attack: base.attack + itemBonusAttack,
		defense: base.defense + itemBonusDefense,
		speed: base.speed + itemBonusSpeed,
		startingMana: itemBonusMana, // Starting mana instead of max mana
	};
};
