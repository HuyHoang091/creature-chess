import React, { useState, useEffect } from "react";
import classNames from "classnames";
import styles from "./VFXStorybook.module.css";

// Interface animation tương tự bản gốc
interface Animation {
	name: string;
	keyframesName: string;
	variables?: Record<string, string | number>;
}

const getAnimationCssVariables = (
	animations: Animation[]
): React.CSSProperties => {
	const result: Record<string, string | number> = {};
	animations.forEach((animation) => {
		if (animation.variables) {
			Object.entries(animation.variables).forEach(([key, value]) => {
				result[`--${key}`] = value;
			});
		}
	});
	return result as React.CSSProperties;
};

// Component MockPiece giả lập piece của bảng 
const VFXPiece: React.FC<{
    action: string | null;
    onAnimEnd: () => void;
}> = ({ action, onAnimEnd }) => {
    
    const [currentAnimations, setCurrentAnimations] = useState<Animation[]>([]);

    useEffect(() => {
        if (!action) return;

        if (action === "attack-basic") {
            setCurrentAnimations([{
                name: styles.attackBasic,
                keyframesName: "attack-basic",
                variables: {
                    attackPower: 1,
                    attackXDirection: 1,
                    attackYDirection: -0.5,
                }
            }]);
        } else if (action === "attack-shoot") {
            setCurrentAnimations([{
                name: styles.attackShoot,
                keyframesName: "attack-shoot",
                variables: {
                    attackDistance: 1.5,
                    attackXDirection: 1,
                    attackYDirection: -0.5,
                }
            }]);
        } else if (action === "receive-hit") {
            setCurrentAnimations([{
                name: styles.receiveHit,
                keyframesName: "receive-hit",
                variables: {
                    hitPower: 1,
                    hitXDirection: 1,
                    hitYDirection: 0,
                }
            }]);
        } else if (action === "dying") {
            setCurrentAnimations([{
                name: styles.dying,
                keyframesName: "dying",
            }]);
        }
    }, [action]);

    const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
        // Log to console if needed
        console.log("Animation Ended:", event.animationName);
        if (event.animationName.includes('die')) {
            // Keep the dying state
            return;
        }
        setCurrentAnimations([]);
        onAnimEnd();
    };

    const animationClasses = currentAnimations.map((a) => a.name);
    const className = classNames(styles.pieceContainer, ...animationClasses);

    return (
        <div 
            className={className} 
            style={getAnimationCssVariables(currentAnimations)}
            onAnimationEnd={handleAnimationEnd}
        >
            <div className={styles.dummyPieceVisual}></div>
            {/* The projectile div used for shooting */}
            <div className={styles.projectile}></div>
        </div>
    );
};

export const VFXStorybook: React.FC = () => {
    const [currentAction, setCurrentAction] = useState<string | null>(null);

    const triggerAction = (actionName: string) => {
        setCurrentAction(null); // Reset
        setTimeout(() => setCurrentAction(actionName), 50); // Small delay to retrigger CSS animation
    };

    const resetPiece = () => setCurrentAction(null);

    return (
        <div className={styles.storybookContainer}>
            <div className={styles.header}>
                <h1>VFX / Animations Playground</h1>
                <p>Nơi thử nghiệm mượt mà các hiệu ứng kỹ năng của Creature Chess</p>
            </div>

            <div className={styles.content}>
                <div className={styles.controlsPanel}>
                    <h2>Bảng Điều Khiển</h2>
                    
                    <div className={styles.buttonGroup}>
                        <button className={classNames(styles.btn, styles.primary)} onClick={() => triggerAction('attack-basic')}>
                            Tấn công Cận chiến
                        </button>
                        <button className={classNames(styles.btn, styles.primary)} onClick={() => triggerAction('attack-shoot')}>
                            Bắn Đạn Xa (Shoot)
                        </button>
                        <button className={classNames(styles.btn, styles.warning)} onClick={() => triggerAction('receive-hit')}>
                            Bị Đánh (Hit/Knockback)
                        </button>
                        <button className={classNames(styles.btn, styles.danger)} onClick={() => triggerAction('dying')}>
                            Tử trận (Death)
                        </button>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <button className={styles.btn} style={{ width: '100%' }} onClick={resetPiece}>
                            Reset Khung Hình
                        </button>
                    </div>
                </div>

                <div className={styles.stage}>
                    <div className={styles.gridOverlay}></div>
                    <VFXPiece action={currentAction} onAnimEnd={() => setCurrentAction(null)} />
                </div>
            </div>
        </div>
    );
};
