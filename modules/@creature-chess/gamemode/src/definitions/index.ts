import { CreatureDefinition } from "@creature-chess/models";
import { TraitId } from "@creature-chess/models/gamemode/traits";

import { getStages } from "./definitionClass";

import { SkillDefinition } from "@creature-chess/models";

export const SKILL_LIB: Record<string, SkillDefinition> = {
    FIRE_AOE: { name: "Flame Burst", type: "damage", target: "aoe", manaCost: 100 },
    WATER_BOUNCE: { name: "Chain Lightning", type: "damage", target: "bounce", manaCost: 90 },
    WOOD_HEAL: { name: "Nature Blessing", type: "support", target: "aoe", manaCost: 120 },
    WOOD_HEAL_SINGLE: { name: "Mend", type: "support", target: "single", manaCost: 70 },
    METAL_PIERCE: { name: "Fatal Thrust", type: "damage", target: "single", manaCost: 60 },
    EARTH_STOMP: { name: "Earthquake", type: "damage", target: "aoe", manaCost: 110 },
    BUFF_SELF: { name: "Rage Mode", type: "buff", target: "single", manaCost: 50 },
    PIERCE_LINE: { name: "Laser Beam", type: "damage", target: "line", manaCost: 80 }
};

const createDefinition = (
	id: number,
	name: string,
	traits: TraitId[],
	cost: number,
	skill?: SkillDefinition
): CreatureDefinition => ({
	id,
	name,
	traits,
	cost,
	stages: getStages(traits, cost, skill),
});

const definitionsArray: CreatureDefinition[] = [
	createDefinition(1, "Budaye", ["wood", "valiant"], 1, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(2, "Anoleaf", ["wood", "cunning"], 1, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(3, "Rockitten", ["earth", "valiant"], 1, SKILL_LIB.EARTH_STOMP),
	createDefinition(4, "Aardorn", ["earth", "cunning"], 1, SKILL_LIB.BUFF_SELF),
	createDefinition(5, "Nut", ["metal", "valiant"], 1, SKILL_LIB.METAL_PIERCE),
	createDefinition(6, "Puparmor", ["metal", "valiant"], 1, SKILL_LIB.BUFF_SELF),
	createDefinition(7, "Embra", ["fire", "arcane"], 1, SKILL_LIB.FIRE_AOE),
	createDefinition(8, "Tweesher", ["water", "arcane"], 1, SKILL_LIB.WATER_BOUNCE),
	createDefinition(9, "Bamboon", ["wood", "valiant"], 2, SKILL_LIB.WOOD_HEAL),
	createDefinition(10, "Chenipode", ["earth", "cunning"], 2, SKILL_LIB.EARTH_STOMP),
	createDefinition(11, "Bolt", ["metal", "valiant"], 2, SKILL_LIB.PIERCE_LINE),
	createDefinition(12, "Weavifly", ["metal", "arcane"], 1, SKILL_LIB.METAL_PIERCE),
	createDefinition(13, "Cardiling", ["fire", "cunning"], 2, SKILL_LIB.FIRE_AOE),
	createDefinition(14, "Agnite", ["fire", "valiant"], 2, SKILL_LIB.FIRE_AOE),
	createDefinition(15, "Elowind", ["water", "arcane"], 2, SKILL_LIB.WATER_BOUNCE),
	createDefinition(16, "Fluttaflap", ["water", "valiant"], 2, SKILL_LIB.WATER_BOUNCE),
	createDefinition(17, "Velocitile", ["wood", "cunning"], 3, SKILL_LIB.METAL_PIERCE),
	createDefinition(18, "Sapsnap", ["wood", "valiant"], 3, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(19, "Rockat", ["earth", "cunning"], 3, SKILL_LIB.EARTH_STOMP),
	createDefinition(20, "Grintot", ["earth", "valiant"], 3, SKILL_LIB.EARTH_STOMP),
	createDefinition(21, "Propellorcat", ["metal", "cunning"], 3, SKILL_LIB.BUFF_SELF),
	createDefinition(22, "Sumchon", ["metal", "valiant"], 3, SKILL_LIB.METAL_PIERCE),
	createDefinition(23, "Ignibus", ["fire", "valiant"], 3, SKILL_LIB.FIRE_AOE),
	createDefinition(24, "Ruption", ["fire", "arcane"], 3, SKILL_LIB.FIRE_AOE),
	createDefinition(25, "Noctalo", ["water", "cunning"], 3, SKILL_LIB.WATER_BOUNCE),
	createDefinition(26, "Lightmare", ["water", "valiant"], 3, SKILL_LIB.WATER_BOUNCE),
	createDefinition(27, "Narcileaf", ["wood", "arcane"], 4, SKILL_LIB.WOOD_HEAL),
	createDefinition(28, "Coleorus", ["wood", "cunning"], 4, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(29, "Aardart", ["earth", "cunning"], 4, SKILL_LIB.EARTH_STOMP),
	createDefinition(30, "Hubursa", ["earth", "arcane"], 4, SKILL_LIB.BUFF_SELF),
	createDefinition(31, "Sampsack", ["metal", "valiant"], 4, SKILL_LIB.PIERCE_LINE),
	createDefinition(32, "Cairfrey", ["metal", "arcane"], 3, SKILL_LIB.METAL_PIERCE),
	createDefinition(33, "Prophetoise", ["fire", "arcane"], 4, SKILL_LIB.FIRE_AOE),
	createDefinition(34, "Tikorch", ["fire", "cunning"], 4, SKILL_LIB.FIRE_AOE),
	createDefinition(35, "Nudimind", ["water", "arcane"], 4, SKILL_LIB.WATER_BOUNCE),
	createDefinition(36, "Dollfin", ["water", "valiant"], 4, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(37, "Arbelder", ["wood", "valiant"], 5, SKILL_LIB.WOOD_HEAL),
	createDefinition(38, "Viviphyta", ["wood", "cunning"], 5, SKILL_LIB.WOOD_HEAL_SINGLE),
	createDefinition(39, "Grintrock", ["earth", "valiant"], 5, SKILL_LIB.EARTH_STOMP),
	createDefinition(40, "Jemuar", ["earth", "cunning"], 5, SKILL_LIB.BUFF_SELF),
	createDefinition(41, "Pyraminx", ["metal", "valiant"], 5, SKILL_LIB.PIERCE_LINE),
	createDefinition(42, "AV8R", ["metal", "cunning"], 5, SKILL_LIB.PIERCE_LINE),
	createDefinition(43, "Agnigon", ["fire", "valiant"], 5, SKILL_LIB.FIRE_AOE),
	createDefinition(44, "Cardinale", ["fire", "cunning"], 5, SKILL_LIB.FIRE_AOE),
	createDefinition(45, "Nudikill", ["water", "valiant"], 5, SKILL_LIB.WATER_BOUNCE),
	createDefinition(46, "Eaglace", ["water", "cunning"], 5, SKILL_LIB.WATER_BOUNCE),
	createDefinition(47, "Kirkanon", ["metal", "arcane"], 5, SKILL_LIB.METAL_PIERCE),
];

const definitionMap = new Map<number, CreatureDefinition>();

definitionsArray.forEach((d) => {
	definitionMap.set(d.id, d);
});

export const getDefinitionById = (id: number) => definitionMap.get(id);
export const getAllDefinitions = () => [...definitionsArray];
