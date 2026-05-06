import * as React from "react";
import { TileCoordinates } from "@creature-chess/models";

import { AoeExplosion } from "./AoeExplosion";
import { BounceLightning } from "./BounceLightning";
import { SingleHit } from "./SingleHit";
import { LinePierce } from "./LinePierce";
import { BuffSelf } from "./BuffSelf";
import { HealBuff } from "./HealBuff";

interface Props {
	skillName: string;
	skillType: "damage" | "buff" | "support";
	skillTarget: "single" | "aoe" | "bounce" | "line";
	targets: TileCoordinates[];
	boardColumns: number;
	boardRows: number;
}

/**
 * SkillOverlay: Vẽ hiệu ứng kỹ năng lên từng ô bàn cờ bị ảnh hưởng.
 * Overlay là một CSS Grid trùng khớp với lưới bàn cờ, chỉ tô sáng các ô trong `targets`.
 */
export const SkillOverlay: React.FC<Props> = ({
	skillName,
	skillType,
	skillTarget,
	targets,
	boardColumns,
	boardRows,
}) => {
	const [active, setActive] = React.useState(true);

	React.useEffect(() => {
		setActive(true);
		const timer = setTimeout(() => setActive(false), 1200);
		return () => clearTimeout(timer);
	}, [skillName, targets]);

	if (!active || targets.length === 0) return null;

	// Chọn component hiệu ứng từng ô dựa trên loại kỹ năng
	const getEffect = () => {
		if (skillType === "damage") {
			switch (skillTarget) {
				case "aoe": return AoeExplosion;
				case "bounce": return BounceLightning;
				case "line": return LinePierce;
				case "single":
				default: return SingleHit;
			}
		}
		if (skillType === "buff") return BuffSelf;
		return HealBuff; // support
	};

	const EffectComponent = getEffect();

	// Tạo Set toạ độ để lookup nhanh
	const targetSet = new Set(targets.map(t => `${t.x},${t.y}`));

	// Render grid overlay trùng khớp bàn cờ
	const cells: React.ReactNode[] = [];
	for (let y = 0; y < boardRows; y++) {
		for (let x = 0; x < boardColumns; x++) {
			const isTarget = targetSet.has(`${x},${y}`);
			cells.push(
				<div
					key={`skill-cell-${x}-${y}`}
					style={{
						position: "relative",
						overflow: "hidden",
					}}
				>
					{isTarget && <EffectComponent skillName={skillName} />}
				</div>
			);
		}
	}

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				display: "grid",
				gridTemplateColumns: `repeat(${boardColumns}, 1fr)`,
				gridTemplateRows: `repeat(${boardRows}, 1fr)`,
				pointerEvents: "none",
				zIndex: 50,
			}}
		>
			{cells}
		</div>
	);
};
