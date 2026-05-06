import * as React from "react";

/**
 * Hiệu ứng Chain Lightning / Bounce trên từng ô: tia sét xanh.
 */
export const BounceLightning: React.FC<{ skillName: string }> = ({ skillName }) => (
	<div style={{
		position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
		display: 'flex', justifyContent: 'center', alignItems: 'center',
		background: 'radial-gradient(circle, rgba(0,200,255,0.5) 0%, rgba(80,160,255,0.15) 70%, transparent 100%)',
		borderRadius: '6px',
		animation: 'bounceFade 0.9s forwards',
	}}>
		<span style={{
			color: '#00d4ff', fontSize: '0.8rem', fontWeight: 'bold',
			textShadow: '0 0 4px #00bfff',
			animation: 'bounceZap 0.2s ease-in-out 4',
		}}>
			⚡
		</span>
		<style>{`
			@keyframes bounceFade {
				0% { opacity: 0; }
				15% { opacity: 1; }
				80% { opacity: 0.6; }
				100% { opacity: 0; }
			}
			@keyframes bounceZap {
				0% { transform: translateX(-3px) skewX(-8deg); }
				50% { transform: translateX(3px) skewX(8deg); }
				100% { transform: translateX(-3px) skewX(-8deg); }
			}
		`}</style>
	</div>
);
