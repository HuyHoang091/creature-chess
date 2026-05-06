import * as React from "react";

/**
 * Hiệu ứng Line/Pierce Damage trên từng ô: Tia laser tím hồng.
 */
export const LinePierce: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		overflow: 'hidden',
		borderRadius: '6px',
		animation: 'laserTileFade 0.8s forwards',
	}}>
		<div style={{
			position: 'absolute',
			width: '100%', height: '4px',
			background: 'linear-gradient(90deg, transparent 0%, #e040fb 30%, #ff4081 50%, #e040fb 70%, transparent 100%)',
			boxShadow: '0 0 10px #e040fb, 0 0 20px #ff4081',
			animation: 'laserSweepTile 0.5s ease-out forwards',
		}} />
		<span style={{
			color: '#e040fb', fontSize: '0.7rem', fontWeight: 'bold',
			textShadow: '0 0 6px #e040fb',
			zIndex: 2,
		}}>
			🔻
		</span>
		<style>{`
			@keyframes laserSweepTile {
				0% { transform: scaleX(0); opacity: 0; }
				40% { transform: scaleX(1.2); opacity: 1; }
				100% { transform: scaleX(1); opacity: 0.5; }
			}
			@keyframes laserTileFade {
				0% { opacity: 0; }
				20% { opacity: 1; }
				100% { opacity: 0; }
			}
		`}</style>
	</div>
);
