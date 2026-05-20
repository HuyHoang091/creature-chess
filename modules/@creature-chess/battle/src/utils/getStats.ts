import {
	type CreatureStats,
	PieceModel,
	getItemDefinition,
} from "@creature-chess/models";

export type BattleStats = CreatureStats & {
	startingMana: number;
	healAmpPct: number;
	skillDamagePct: number;
	damageReductionPct: number;
};

const applyModifier = (baseValue: number, flatBonus = 0, percentBonus = 0) =>
	Math.max(1, Math.ceil((baseValue + flatBonus) * (1 + percentBonus)));

export const getStats = (piece: PieceModel): BattleStats => {
	const base = piece.definition.stages[piece.stage];
	const battleModifiers = piece.battleModifiers ?? {};
	const itemModifiers = {
		hp: 0,
		attack: 0,
		defense: 0,
		speed: 0,
		mana: 0,
	};

	for (const item of piece.items ?? []) {
		const itemDefinition = getItemDefinition(item.itemId);
		if (itemDefinition?.stats) {
			itemModifiers.hp += itemDefinition.stats.hp || 0;
			itemModifiers.attack += itemDefinition.stats.attack || 0;
			itemModifiers.defense += itemDefinition.stats.defense || 0;
			itemModifiers.speed += itemDefinition.stats.speed || 0;
			itemModifiers.mana += itemDefinition.stats.mana || 0;
		}
	}

	return {
		...base,
		hp: applyModifier(
			base.hp + itemModifiers.hp,
			battleModifiers.hpFlat,
			battleModifiers.hpPct
		),
		attack: applyModifier(
			base.attack + itemModifiers.attack,
			battleModifiers.attackFlat,
			battleModifiers.attackPct
		),
		defense: applyModifier(
			base.defense + itemModifiers.defense,
			battleModifiers.defenseFlat,
			battleModifiers.defensePct
		),
		speed: applyModifier(
			base.speed + itemModifiers.speed,
			battleModifiers.speedFlat,
			battleModifiers.speedPct
		),
		startingMana: itemModifiers.mana + (battleModifiers.startingManaFlat ?? 0),
		healAmpPct: battleModifiers.healAmpPct ?? 0,
		skillDamagePct: battleModifiers.skillDamagePct ?? 0,
		damageReductionPct: battleModifiers.damageReductionPct ?? 0,
	};
};
