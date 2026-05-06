import * as React from "react";

/**
 * Hiệu ứng Single Target Damage trên từng ô: Chấn động mạnh.
 */
export const SingleHit: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		background: 'radial-gradient(circle, rgba(255,23,68,0.6) 0%, rgba(183,28,28,0.2) 70%, transparent 100%)',
		borderRadius: '6px',
		animation: 'singleHitShake 0.12s ease-in-out 4, singleHitFade 1s forwards',
	}}>
		<span style={{
			color: '#ff1744', fontSize: '0.9rem', fontWeight: 'bold',
			textShadow: '0 0 4px #ff0000',
		}}>
			⚔️
		</span>
		<style>{`
			@keyframes singleHitShake {
				0% { transform: translateX(0); }
				25% { transform: translateX(-3px); }
				75% { transform: translateX(3px); }
				100% { transform: translateX(0); }
			}
			@keyframes singleHitFade {
				0% { opacity: 0.3; }
				20% { opacity: 1; }
				100% { opacity: 0; }
			}
		`}</style>
	</div>
);
