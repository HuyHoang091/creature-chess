import { TraitId } from "../gamemode/traits";
import { AttackType, CreatureDefinition } from "./creatureDefinition";
import { ItemInstance } from "./item";
import { TileCoordinates } from "./position";

export interface AttackDetails {
	direction: TileCoordinates;
	damage: number;
	attackType: AttackType;
	distance: number;
}

export interface HitDetails {
	direction: TileCoordinates;
	damage: number;
}

export interface MovementDetails {
	direction: TileCoordinates;
}

export interface PieceStatusEffect {
	type: "slow" | "reviving";
}

export interface PieceModel {
	id: string;
	ownerId: string;

	definitionId: number;

	/**
	 * @deprecated Definition data should be initialized from the source definition.
	 */
	definition: CreatureDefinition;

	traits: TraitId[];

	/** Equipped items (max 3 slots) */
	items: ItemInstance[];

	stage: number;

	/**
	 * Whether the piece is facing away from the viewer.
	 *
	 * @deprecated Positional/render state should be stored separately from core piece data.
	 */
	facingAway: boolean;

	/**
	 * @deprecated Positional/render state should be stored separately from core piece data.
	 */
	attacking?: AttackDetails | null;

	/**
	 * @deprecated Positional/render state should be stored separately from core piece data.
	 */
	hit?: HitDetails | null;

	maxHealth: number;

	/**
	 * @deprecated Positional/render state should be stored separately from core piece data.
	 */
	currentHealth: number;

	maxMana: number;
	currentMana: number;

	/**
	 * Temporary skill-cast payload for the board overlay.
	 */
	skillCast?: {
		skillName: string;
		skillType: "damage" | "buff" | "support";
		skillTarget: "single" | "aoe" | "bounce" | "line";
		targets: TileCoordinates[];
		primaryTarget?: TileCoordinates | null;
		primaryTargetId?: string | null;
		affectedPieceIds?: string[];
	} | null;

	/**
	 * Temporary visual effects to render over the piece (e.g. floating combat text)
	 */
	visualEffects?: {
		id: string;
		text: string;
		color: string;
		variant?: "damage" | "skillDamage" | "heal" | "label";
		tone?: "neutral" | "ice" | "gold" | "warning";
		sourcePieceId?: string;
	}[];

	/**
	 * Persistent status effects to render over the piece.
	 */
	statusEffects?: PieceStatusEffect[];

	/**
	 * @deprecated Positional/render state should be stored separately from core piece data.
	 */
	lastBattleStats: {
		damageDealt: number;
		damageTaken: number;
		turnsSurvived: number;
	} | null;
}

export type IndexedPieces = {
	[pieceId: string]: PieceModel;
};
