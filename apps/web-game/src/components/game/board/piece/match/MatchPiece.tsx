import * as React from "react";

import classNames from "classnames";
import { useSelector } from "react-redux";
import { AppState } from "~/store";

import { attackTypes, PieceModel } from "@creature-chess/models";

import { Piece } from "../Piece";
import { usePiece } from "../PieceContext";
import { Projectile } from "../Projectile";
import animationStyles from "./MatchPiece.module.css";
import {
	Animation,
	AnimationVariables,
	getAnimationCssVariables,
} from "./animation";

const getHealthbar = (ownerId: string, viewingPlayerId: string) =>
	ownerId === viewingPlayerId ? "friendly" : "enemy";

const animationEventMatchesAnimation = (
	event: React.AnimationEvent<HTMLDivElement>,
	animation: Animation
): boolean =>
	event.animationName.includes(`piece-${animation.keyframesName}-anim`);

export const MatchPiece: React.FC = () => {
	const { piece, viewingPlayerId } = usePiece();

	// ===== THÊM MỚI: Enemy reveal state =====
	const enemyRevealed = useSelector<AppState, boolean>(
		(state) => state.game.ui.enemyRevealed
	);
	const isEnemy = piece ? piece.ownerId !== viewingPlayerId : false;
	// ===== KẾT THÚC =====

	const [currentAnimations, setCurrentAnimations] = React.useState<Animation[]>(
		[]
	);
	const [lastRenderedPiece, setLastRenderedPiece] =
		React.useState<PieceModel | null>(null);

	const runAnimation = (
		name: string,
		keyframesName: string,
		variables?: AnimationVariables
	) =>
		setCurrentAnimations((oldAnimations) => {
			const newAnimation: Animation = { name, keyframesName, variables };
			return [...oldAnimations.filter((a) => a.name !== name), newAnimation];
		});

	const removeAnimation = (name: string) =>
		setCurrentAnimations((oldAnimations) =>
			oldAnimations.filter((animation) => animation.name !== name)
		);

	const onAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
		if (event.animationName.includes("piece-dying-anim")) {
			return;
		}
		setCurrentAnimations((oldAnimations) =>
			oldAnimations.filter((a) => !animationEventMatchesAnimation(event, a))
		);
	};

	const runAnimations = React.useCallback(
		(newPiece: PieceModel) => {
			const { attacking, hit, currentHealth } = newPiece;

			if (!lastRenderedPiece) {
				setLastRenderedPiece(newPiece);
				return;
			}

			if (attacking && !lastRenderedPiece.attacking) {
				if (attacking.attackType.name === attackTypes.basic.name) {
					runAnimation(animationStyles.attackBasic, "attack-basic", {
						attackPower: attacking.damage,
						attackXDirection: attacking.direction.x,
						attackYDirection: attacking.direction.y,
					});
				} else if (attacking.attackType.name === attackTypes.shoot.name) {
					runAnimation(animationStyles.attackShoot, "attack-shoot", {
						attackPower: attacking.damage,
						attackXDirection: attacking.direction.x,
						attackYDirection: attacking.direction.y,
						attackDistance: attacking.distance,
					});
				}
			}

			if (hit && !lastRenderedPiece.hit) {
				runAnimation(animationStyles.receiveHit, "receive-hit", {
					hitPower: hit.damage,
					hitXDirection: hit.direction.x,
					hitYDirection: hit.direction.y,
				});
			}

			if (currentHealth === 0) {
				if (lastRenderedPiece.currentHealth !== 0) {
					runAnimation(animationStyles.dying, "dying");
				}
			} else {
				if (lastRenderedPiece.currentHealth === 0) {
					removeAnimation(animationStyles.dying);
				}
			}

			setLastRenderedPiece(newPiece);
		},
		[lastRenderedPiece]
	);

	const [activeEffects, setActiveEffects] = React.useState<{ id: string; text: string; color: string }[]>([]);

	React.useEffect(() => {
		if (piece?.visualEffects && piece.visualEffects.length > 0) {
			// Find new effects that we haven't seen yet
			const newEffects = piece.visualEffects.filter(e => !activeEffects.find(a => a.id === e.id));
			if (newEffects.length > 0) {
				setActiveEffects(prev => [...prev, ...newEffects]);
				// Each effect self-removes after 1.5 seconds
				newEffects.forEach(e => {
					setTimeout(() => {
						setActiveEffects(prev => prev.filter(a => a.id !== e.id));
					}, 1500);
				});
			}
		}
	}, [piece?.visualEffects, activeEffects]);

	React.useEffect(() => {
		if (piece) {
			runAnimations(piece);
		} else {
			setLastRenderedPiece(null);
		}
	}, [piece, runAnimations]);

	if (!piece) {
		return null;
	}

	const animationClasses = currentAnimations.map((a) => a.name);
	const className = classNames(animationStyles.piece, ...animationClasses);

	// ===== THÊM MỚI: Ẩn quân địch cho đến khi reveal =====
	const enemyHiddenStyle: React.CSSProperties =
		isEnemy && !enemyRevealed
			? {
					opacity: 0,
					transform: "scale(0.3)",
					transition: "opacity 0.5s ease, transform 0.5s ease",
				}
			: isEnemy
				? {
						opacity: 1,
						transform: "scale(1)",
						transition: "opacity 0.5s ease, transform 0.5s ease",
					}
				: {};
	// ===== KẾT THÚC =====

	return (
		<div
			className={className}
			style={{
				...getAnimationCssVariables(currentAnimations),
				...enemyHiddenStyle,
			}}
			onAnimationEnd={onAnimationEnd}
		>
			<Piece healthbar={getHealthbar(piece.ownerId, viewingPlayerId)}>
				<Projectile className={animationStyles.projectile} />
				{activeEffects.map((effect) => (
					<div
						key={effect.id}
						className={animationStyles.floatingText}
						style={{ color: effect.color }}
					>
						{effect.text}
					</div>
				))}
			</Piece>
		</div>
	);
};
