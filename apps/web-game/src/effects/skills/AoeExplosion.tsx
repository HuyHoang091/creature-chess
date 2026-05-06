import * as React from "react";

/**
 * Hiệu ứng AoE Damage trên từng ô: Vòng tròn đỏ/cam bung nổ.
 */
export const AoeExplosion: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		background: 'radial-gradient(circle, rgba(255,80,0,0.65) 0%, rgba(255,30,0,0.2) 70%, transparent 100%)',
		borderRadius: '6px',
		animation: 'skillAoeFade 1.1s forwards',
	}}>
		<span style={{
			color: '#fff', fontSize: '0.7rem', fontWeight: 'bold',
			textShadow: '0 0 6px #ff4500, 0 0 12px #ff0000',
		}}>
			🔥
		</span>
		<style>{`
			@keyframes skillAoeFade {
				0% { opacity: 0.2; transform: scale(0.5); }
				30% { opacity: 1; transform: scale(1.1); }
				100% { opacity: 0; transform: scale(1.2); }
			}
		`}</style>
	</div>
);
