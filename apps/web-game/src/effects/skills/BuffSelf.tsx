import * as React from "react";

/**
 * Hiệu ứng Buff bản thân trên từng ô: Viền vàng phát sáng.
 */
export const BuffSelf: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		border: '2px solid rgba(255, 215, 0, 0.7)',
		borderRadius: '6px',
		background: 'radial-gradient(circle, rgba(255,215,0,0.25) 0%, transparent 80%)',
		animation: 'buffGlow 1s ease-out forwards',
		boxSizing: 'border-box',
	}}>
		<span style={{
			color: '#ffd700', fontSize: '0.8rem', fontWeight: 'bold',
			textShadow: '0 0 4px #ffa000',
			animation: 'buffTextRise 0.8s ease-out forwards',
		}}>
			💪
		</span>
		<style>{`
			@keyframes buffGlow {
				0% { opacity: 0; border-color: rgba(255,215,0,0); }
				30% { opacity: 1; border-color: rgba(255,215,0,0.8); }
				100% { opacity: 0; border-color: rgba(255,215,0,0); }
			}
			@keyframes buffTextRise {
				0% { transform: translateY(4px); opacity: 0; }
				40% { transform: translateY(-2px); opacity: 1; }
				100% { transform: translateY(-8px); opacity: 0; }
			}
		`}</style>
	</div>
);
