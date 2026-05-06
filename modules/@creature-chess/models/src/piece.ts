import { TraitId } from "../gamemode/traits";
import { AttackType, CreatureDefinition } from "./creatureDefinition";
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

export interface PieceModel {
	id: string;
	ownerId: string;

	definitionId: number;

	/**
	 * @deprecated Dữ liệu định nghĩa nên được khởi tạo trực tiếp lên chính chi tiết đó.
	 */
	definition: CreatureDefinition;

	traits: TraitId[];

	stage: number;

	/**
	 * Chiếc quân cờ có đang quay lưng lại với người xem (tức là nhìn về "phía bắc") hay không
	 *
	 * @deprecated Dữ liệu trạng thái/vị trí nên được lưu trữ riêng biệt với dữ liệu cốt lõi của quân cờ.
	 */
	facingAway: boolean;

	/**
	 * @deprecated Dữ liệu trạng thái/vị trí nên được lưu trữ riêng biệt với dữ liệu cốt lõi của quân cờ.
	 */
	attacking?: AttackDetails | null;

	/**
	 * @deprecated Dữ liệu trạng thái/vị trí nên được lưu trữ riêng biệt với dữ liệu cốt lõi của quân cờ.
	 */
	hit?: HitDetails | null;

	maxHealth: number;

	/**
	 * @deprecated Dữ liệu trạng thái/vị trí nên được lưu trữ riêng biệt với dữ liệu cốt lõi của quân cờ.
	 */
	currentHealth: number;

	maxMana: number;
	currentMana: number;

	/**
	 * Nơi lưu trữ trạng thái hiển thị Skill ra UI (VD: khi Piece dùng chiêu).
	 * UI đọc thông tin này để vẽ Overlay Canvas.
	 */
	skillCast?: {
		skillName: string;
		skillType: "damage" | "buff" | "support";
		skillTarget: "single" | "aoe" | "bounce" | "line";
		targets: TileCoordinates[]; // Điểm/vùng tác dụng
	} | null;

	/**
	 * @deprecated Dữ liệu trạng thái/vị trí nên được lưu trữ riêng biệt với dữ liệu cốt lõi của quân cờ.
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
