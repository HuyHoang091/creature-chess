import * as React from "react";

/**
 * Hiệu ứng Heal/Support trên từng ô: Ánh sáng xanh lá + hạt bay lên.
 */
export const HealBuff: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		background: 'radial-gradient(circle, rgba(76,175,80,0.5) 0%, rgba(76,175,80,0.1) 70%, transparent 100%)',
		borderRadius: '6px',
		animation: 'healFade 1.2s ease-out forwards',
		overflow: 'hidden',
	}}>
		{[0, 1, 2].map((i) => (
			<div key={i} style={{
				position: 'absolute',
				width: '5px', height: '5px',
				borderRadius: '50%',
				background: '#69f0ae',
				boxShadow: '0 0 4px #69f0ae',
				left: `${25 + i * 25}%`,
				bottom: '20%',
				animation: `healParticle 0.9s ease-out ${i * 0.15}s forwards`,
				opacity: 0,
			}} />
		))}
		<span style={{
			color: '#69f0ae', fontSize: '0.8rem', fontWeight: 'bold',
			textShadow: '0 0 4px #4caf50',
			zIndex: 2,
		}}>
			💚
		</span>
		<style>{`
			@keyframes healFade {
				0% { opacity: 0; }
				20% { opacity: 1; }
				100% { opacity: 0; }
			}
			@keyframes healParticle {
				0% { opacity: 0; transform: translateY(0); }
				30% { opacity: 1; }
				100% { opacity: 0; transform: translateY(-20px); }
			}
		`}</style>
	</div>
);
