import * as React from "react";
import { TileCoordinates } from "@creature-chess/models";
import { getHexTileBounds } from "~/components/game/board/hexLayout";

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

	const getEffect = () => {
		if (skillType === "damage") {
			switch (skillTarget) {
				case "aoe":
					return AoeExplosion;
				case "bounce":
					return BounceLightning;
				case "line":
					return LinePierce;
				case "single":
				default:
					return SingleHit;
			}
		}
		if (skillType === "buff") return BuffSelf;
		return HealBuff;
	};

	const EffectComponent = getEffect();

	const cells = targets.map((target, index) => {
		const bounds = getHexTileBounds(
			boardColumns,
			boardRows,
			target.x,
			target.y
		);

		return (
			<div
				key={`skill-cell-${target.x}-${target.y}-${index}`}
				style={{
					position: "absolute",
					left: `${bounds.left}%`,
					top: `${bounds.top}%`,
					width: `${bounds.width}%`,
					height: `${bounds.height}%`,
					overflow: "hidden",
					pointerEvents: "none",
					zIndex: 50 + target.y,
				}}
			>
				<EffectComponent skillName={skillName} />
			</div>
		);
	});

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				zIndex: 50,
			}}
		>
			{cells}
		</div>
	);
};
