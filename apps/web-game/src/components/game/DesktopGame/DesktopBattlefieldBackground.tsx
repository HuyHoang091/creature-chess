import * as React from "react";

import styles from "./DesktopBattlefieldBackground.module.css";

type BattlefieldTheme =
	| "water"
	| "fire"
	| "earth"
	| "wood"
	| "metal"
	| "arcane"
	| "valiant"
	| "cunning";

type ThemeConfig = {
	energyA: string;
	energyAZero: string;
	energyB: string;
	energyBZero: string;
	glowA: string;
	glowAMid: string;
	glowAZero: string;
	ringB: string;
	ringA: string;
	fog: string;
	moteA: string;
	moteB: string;
	lightningChance: number;
	lightningStroke: string;
	lightningShadow: string;
	lightningFlash: string;
};

const themeConfigs: Record<BattlefieldTheme, ThemeConfig> = {
	water: {
		energyA: "rgba(94, 226, 201, 0.28)",
		energyAZero: "rgba(94, 226, 201, 0)",
		energyB: "rgba(112, 116, 255, 0.18)",
		energyBZero: "rgba(112, 116, 255, 0)",
		glowA: "rgba(96, 240, 214, 0.24)",
		glowAMid: "rgba(96, 240, 214, 0.1)",
		glowAZero: "rgba(96, 240, 214, 0)",
		ringB: "rgba(113, 117, 255, ALPHA)",
		ringA: "rgba(96, 240, 214, ALPHA)",
		fog: "rgba(78, 217, 194, 0.09)",
		moteA: "rgba(132, 242, 217, ALPHA)",
		moteB: "rgba(112, 116, 255, ALPHA)",
		lightningChance: 0.008,
		lightningStroke: "rgba(193, 237, 255, ALPHA)",
		lightningShadow: "rgba(132, 213, 255, ALPHA)",
		lightningFlash: "rgba(170, 221, 255, ALPHA)",
	},
	fire: {
		energyA: "rgba(255, 120, 64, 0.32)",
		energyAZero: "rgba(255, 120, 64, 0)",
		energyB: "rgba(255, 197, 82, 0.18)",
		energyBZero: "rgba(255, 197, 82, 0)",
		glowA: "rgba(255, 125, 66, 0.24)",
		glowAMid: "rgba(255, 125, 66, 0.1)",
		glowAZero: "rgba(255, 125, 66, 0)",
		ringB: "rgba(255, 202, 96, ALPHA)",
		ringA: "rgba(255, 125, 66, ALPHA)",
		fog: "rgba(255, 132, 74, 0.08)",
		moteA: "rgba(255, 158, 99, ALPHA)",
		moteB: "rgba(255, 205, 121, ALPHA)",
		lightningChance: 0.004,
		lightningStroke: "rgba(255, 214, 150, ALPHA)",
		lightningShadow: "rgba(255, 155, 92, ALPHA)",
		lightningFlash: "rgba(255, 170, 104, ALPHA)",
	},
	earth: {
		energyA: "rgba(166, 134, 92, 0.22)",
		energyAZero: "rgba(166, 134, 92, 0)",
		energyB: "rgba(101, 160, 108, 0.14)",
		energyBZero: "rgba(101, 160, 108, 0)",
		glowA: "rgba(158, 129, 88, 0.16)",
		glowAMid: "rgba(158, 129, 88, 0.08)",
		glowAZero: "rgba(158, 129, 88, 0)",
		ringB: "rgba(104, 165, 111, ALPHA)",
		ringA: "rgba(158, 129, 88, ALPHA)",
		fog: "rgba(136, 117, 82, 0.07)",
		moteA: "rgba(192, 170, 122, ALPHA)",
		moteB: "rgba(129, 173, 118, ALPHA)",
		lightningChance: 0.002,
		lightningStroke: "rgba(213, 196, 138, ALPHA)",
		lightningShadow: "rgba(160, 139, 97, ALPHA)",
		lightningFlash: "rgba(188, 171, 120, ALPHA)",
	},
	wood: {
		energyA: "rgba(98, 206, 116, 0.22)",
		energyAZero: "rgba(98, 206, 116, 0)",
		energyB: "rgba(141, 233, 172, 0.14)",
		energyBZero: "rgba(141, 233, 172, 0)",
		glowA: "rgba(98, 206, 116, 0.18)",
		glowAMid: "rgba(98, 206, 116, 0.08)",
		glowAZero: "rgba(98, 206, 116, 0)",
		ringB: "rgba(140, 233, 172, ALPHA)",
		ringA: "rgba(98, 206, 116, ALPHA)",
		fog: "rgba(94, 190, 112, 0.07)",
		moteA: "rgba(136, 242, 156, ALPHA)",
		moteB: "rgba(181, 255, 194, ALPHA)",
		lightningChance: 0.003,
		lightningStroke: "rgba(194, 255, 204, ALPHA)",
		lightningShadow: "rgba(121, 223, 142, ALPHA)",
		lightningFlash: "rgba(154, 242, 174, ALPHA)",
	},
	metal: {
		energyA: "rgba(190, 211, 228, 0.26)",
		energyAZero: "rgba(190, 211, 228, 0)",
		energyB: "rgba(124, 151, 178, 0.18)",
		energyBZero: "rgba(124, 151, 178, 0)",
		glowA: "rgba(188, 211, 228, 0.16)",
		glowAMid: "rgba(188, 211, 228, 0.08)",
		glowAZero: "rgba(188, 211, 228, 0)",
		ringB: "rgba(124, 151, 178, ALPHA)",
		ringA: "rgba(188, 211, 228, ALPHA)",
		fog: "rgba(166, 185, 204, 0.07)",
		moteA: "rgba(220, 236, 246, ALPHA)",
		moteB: "rgba(158, 182, 204, ALPHA)",
		lightningChance: 0.006,
		lightningStroke: "rgba(239, 246, 250, ALPHA)",
		lightningShadow: "rgba(194, 215, 231, ALPHA)",
		lightningFlash: "rgba(220, 234, 246, ALPHA)",
	},
	arcane: {
		energyA: "rgba(166, 99, 255, 0.28)",
		energyAZero: "rgba(166, 99, 255, 0)",
		energyB: "rgba(76, 224, 255, 0.18)",
		energyBZero: "rgba(76, 224, 255, 0)",
		glowA: "rgba(167, 100, 255, 0.22)",
		glowAMid: "rgba(167, 100, 255, 0.1)",
		glowAZero: "rgba(167, 100, 255, 0)",
		ringB: "rgba(76, 224, 255, ALPHA)",
		ringA: "rgba(167, 100, 255, ALPHA)",
		fog: "rgba(143, 101, 255, 0.08)",
		moteA: "rgba(191, 145, 255, ALPHA)",
		moteB: "rgba(115, 236, 255, ALPHA)",
		lightningChance: 0.009,
		lightningStroke: "rgba(217, 191, 255, ALPHA)",
		lightningShadow: "rgba(148, 109, 255, ALPHA)",
		lightningFlash: "rgba(178, 132, 255, ALPHA)",
	},
	valiant: {
		energyA: "rgba(243, 210, 126, 0.24)",
		energyAZero: "rgba(243, 210, 126, 0)",
		energyB: "rgba(111, 186, 255, 0.14)",
		energyBZero: "rgba(111, 186, 255, 0)",
		glowA: "rgba(243, 210, 126, 0.18)",
		glowAMid: "rgba(243, 210, 126, 0.08)",
		glowAZero: "rgba(243, 210, 126, 0)",
		ringB: "rgba(111, 186, 255, ALPHA)",
		ringA: "rgba(243, 210, 126, ALPHA)",
		fog: "rgba(212, 183, 112, 0.07)",
		moteA: "rgba(255, 227, 148, ALPHA)",
		moteB: "rgba(160, 210, 255, ALPHA)",
		lightningChance: 0.004,
		lightningStroke: "rgba(255, 240, 193, ALPHA)",
		lightningShadow: "rgba(255, 221, 130, ALPHA)",
		lightningFlash: "rgba(255, 229, 163, ALPHA)",
	},
	cunning: {
		energyA: "rgba(226, 77, 128, 0.28)",
		energyAZero: "rgba(226, 77, 128, 0)",
		energyB: "rgba(114, 79, 201, 0.18)",
		energyBZero: "rgba(114, 79, 201, 0)",
		glowA: "rgba(226, 77, 128, 0.2)",
		glowAMid: "rgba(226, 77, 128, 0.1)",
		glowAZero: "rgba(226, 77, 128, 0)",
		ringB: "rgba(114, 79, 201, ALPHA)",
		ringA: "rgba(226, 77, 128, ALPHA)",
		fog: "rgba(186, 72, 116, 0.07)",
		moteA: "rgba(245, 117, 162, ALPHA)",
		moteB: "rgba(151, 118, 238, ALPHA)",
		lightningChance: 0.005,
		lightningStroke: "rgba(255, 187, 210, ALPHA)",
		lightningShadow: "rgba(227, 93, 143, ALPHA)",
		lightningFlash: "rgba(233, 115, 158, ALPHA)",
	},
};

export function DesktopBattlefieldBackground({
	theme = "water",
}: {
	theme?: BattlefieldTheme;
}) {
	const canvasRef = React.useRef<HTMLCanvasElement>(null);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}

		const themeConfig = themeConfigs[theme];
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const embers = Array.from({ length: 90 }, (_, index) => ({
			x: Math.random(),
			y: Math.random(),
			radius: 0.8 + Math.random() * 2.4,
			drift: 0.08 + Math.random() * 0.22,
			sway: Math.random() * Math.PI * 2,
			alpha: 0.16 + Math.random() * 0.38,
			cool: index % 3 !== 0,
		}));

		let width = 0;
		let height = 0;
		let frameId = 0;
		let lightningAlpha = 0;
		let lightningDecay = 0.92;
		let lightningBranches: { points: [number, number][] }[] = [];

		const resize = () => {
			const nextWidth = canvas.clientWidth || window.innerWidth;
			const nextHeight = canvas.clientHeight || window.innerHeight;
			width = nextWidth;
			height = nextHeight;
			canvas.width = Math.floor(nextWidth * dpr);
			canvas.height = Math.floor(nextHeight * dpr);
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const drawSky = () => {
			const gradient = context.createLinearGradient(0, 0, 0, height);
			gradient.addColorStop(0, "#02050a");
			gradient.addColorStop(0.26, "#07111a");
			gradient.addColorStop(0.58, "#0b1822");
			gradient.addColorStop(1, "#111e25");
			context.fillStyle = gradient;
			context.fillRect(0, 0, width, height);
		};

		const drawEnergyVein = (
			time: number,
			offset: number,
			colorA: string,
			colorB: string,
			alpha: number
		) => {
			const yBase = height * offset;
			context.save();
			context.globalCompositeOperation = "screen";
			context.lineWidth = 30;
			context.lineCap = "round";
			context.shadowBlur = 26;
			context.shadowColor = colorA;

			const gradient = context.createLinearGradient(0, yBase - 40, 0, yBase + 40);
			gradient.addColorStop(0, colorA);
			gradient.addColorStop(1, colorB);
			context.strokeStyle = gradient;
			context.globalAlpha = alpha;

			context.beginPath();
			for (let x = -60; x <= width + 60; x += 12) {
				const normalized = x / width;
				const wave =
					Math.sin(normalized * 8 + time * 0.0014) * 22 +
					Math.sin(normalized * 18 - time * 0.001 + offset * 10) * 9;
				const y = yBase + wave;
				if (x === -60) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			}
			context.stroke();
			context.restore();
		};

		const drawArenaWalls = () => {
			context.save();

			const leftGradient = context.createLinearGradient(0, 0, width * 0.2, 0);
			leftGradient.addColorStop(0, "rgba(3, 7, 10, 0.92)");
			leftGradient.addColorStop(1, "rgba(3, 7, 10, 0)");
			context.fillStyle = leftGradient;
			context.fillRect(0, 0, width * 0.28, height);

			const rightGradient = context.createLinearGradient(width, 0, width * 0.8, 0);
			rightGradient.addColorStop(0, "rgba(3, 7, 10, 0.92)");
			rightGradient.addColorStop(1, "rgba(3, 7, 10, 0)");
			context.fillStyle = rightGradient;
			context.fillRect(width * 0.72, 0, width * 0.28, height);

			for (let i = 0; i < 8; i += 1) {
				const x = width * 0.08 + i * width * 0.11;
				const heightScale = height * (0.28 + (i % 3) * 0.04);
				context.fillStyle = "rgba(9, 14, 19, 0.94)";
				context.beginPath();
				context.moveTo(x, height * 0.3);
				context.lineTo(x + 16, height * 0.3 - heightScale);
				context.lineTo(x + 36, height * 0.3);
				context.closePath();
				context.fill();

				context.fillStyle = "rgba(84, 222, 198, 0.11)";
				context.fillRect(x + 14, height * 0.3 - heightScale * 0.44, 4, 20);
			}

			context.restore();
		};

		const drawFloorFog = () => {
			const fog = context.createLinearGradient(0, height * 0.48, 0, height);
			fog.addColorStop(0, "rgba(0, 0, 0, 0)");
			fog.addColorStop(0.36, themeConfig.fog);
			fog.addColorStop(1, "rgba(5, 10, 14, 0.72)");
			context.fillStyle = fog;
			context.fillRect(0, height * 0.44, width, height * 0.56);
		};

		const drawCentralGlow = (time: number) => {
			const radius = Math.min(width, height) * 0.18;
			const x = width * 0.5;
			const y = height * 0.54;
			const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.8);
			glow.addColorStop(0, themeConfig.glowA);
			glow.addColorStop(0.32, themeConfig.glowAMid);
			glow.addColorStop(1, themeConfig.glowAZero);
			context.fillStyle = glow;
			context.beginPath();
			context.arc(x, y, radius * 2.8, 0, Math.PI * 2);
			context.fill();

			context.strokeStyle = themeConfig.ringB.replace(
				"ALPHA",
				`${0.07 + Math.sin(time * 0.0018) * 0.02}`
			);
			context.lineWidth = 2;
			context.beginPath();
			context.arc(x, y, radius * 1.24, 0, Math.PI * 2);
			context.stroke();

			context.strokeStyle = themeConfig.ringA.replace(
				"ALPHA",
				`${0.08 + Math.sin(time * 0.0014) * 0.025}`
			);
			context.lineWidth = 1;
			context.beginPath();
			context.ellipse(x, y, radius * 2.1, radius * 1.14, 0, 0, Math.PI * 2);
			context.stroke();
		};

		const maybeTriggerLightning = () => {
			if (lightningAlpha > 0.02 || Math.random() > themeConfig.lightningChance) {
				return;
			}

			lightningAlpha = 0.9;
			lightningDecay = 0.86 + Math.random() * 0.06;
			const startX = width * (0.18 + Math.random() * 0.64);
			const startY = height * 0.06;
			const segments = 7 + Math.floor(Math.random() * 4);
			let currentX = startX;
			let currentY = startY;

			lightningBranches = [{ points: [[currentX, currentY]] }];

			for (let i = 0; i < segments; i += 1) {
				currentX += (Math.random() - 0.5) * width * 0.08;
				currentY += height * (0.035 + Math.random() * 0.05);
				lightningBranches[0].points.push([currentX, currentY]);

				if (i > 1 && Math.random() > 0.55) {
					const branch: [number, number][] = [[currentX, currentY]];
					let bx = currentX;
					let by = currentY;
					const branchSegments = 2 + Math.floor(Math.random() * 3);
					for (let j = 0; j < branchSegments; j += 1) {
						bx += (Math.random() - 0.5) * width * 0.06;
						by += height * (0.02 + Math.random() * 0.04);
						branch.push([bx, by]);
					}
					lightningBranches.push({ points: branch });
				}
			}
		};

		const drawLightning = () => {
			if (lightningAlpha <= 0.02 || lightningBranches.length === 0) {
				return;
			}

			context.save();
			context.globalCompositeOperation = "screen";
			context.strokeStyle = themeConfig.lightningStroke.replace(
				"ALPHA",
				`${lightningAlpha}`
			);
			context.shadowColor = themeConfig.lightningShadow.replace(
				"ALPHA",
				`${lightningAlpha}`
			);
			context.shadowBlur = 18;
			context.lineWidth = 2;

			for (const branch of lightningBranches) {
				context.beginPath();
				branch.points.forEach(([x, y], index) => {
					if (index === 0) {
						context.moveTo(x, y);
					} else {
						context.lineTo(x, y);
					}
				});
				context.stroke();
			}

			context.fillStyle = themeConfig.lightningFlash.replace(
				"ALPHA",
				`${lightningAlpha * 0.08}`
			);
			context.fillRect(0, 0, width, height);
			context.restore();

			lightningAlpha *= lightningDecay;
		};

		const drawMotes = (time: number) => {
			for (const ember of embers) {
				const x =
					ember.x * width +
					Math.sin(time * 0.0007 * ember.drift + ember.sway) * 24;
				const y = ((ember.y + time * 0.00002 * ember.drift) % 1) * height;
				context.beginPath();
				context.fillStyle = ember.cool
					? themeConfig.moteA.replace("ALPHA", `${ember.alpha}`)
					: themeConfig.moteB.replace("ALPHA", `${ember.alpha * 0.7}`);
				context.arc(x, y, ember.radius, 0, Math.PI * 2);
				context.fill();
			}
		};

		const render = (time: number) => {
			context.clearRect(0, 0, width, height);
			drawSky();
			drawEnergyVein(time, 0.18, themeConfig.energyA, themeConfig.energyAZero, 0.8);
			drawEnergyVein(time, 0.3, themeConfig.energyB, themeConfig.energyBZero, 0.62);
			drawArenaWalls();
			drawCentralGlow(time);
			drawFloorFog();
			maybeTriggerLightning();
			drawLightning();
			drawMotes(time);
			frameId = window.requestAnimationFrame(render);
		};

		resize();
		window.addEventListener("resize", resize);
		frameId = window.requestAnimationFrame(render);

		return () => {
			window.removeEventListener("resize", resize);
			window.cancelAnimationFrame(frameId);
		};
	}, [theme]);

	return (
		<div className={styles.root} aria-hidden="true">
			<canvas ref={canvasRef} className={styles.canvas} />
			<div className={styles.boardBackdrop}>
				<div className={`${styles.arenaRing} ${styles.arenaRingOuter}`} />
				<div className={`${styles.arenaRing} ${styles.arenaRingMid}`} />
				<div className={`${styles.arenaRing} ${styles.arenaRingInner}`} />
				<div className={styles.arenaCoreGlow} />
				<div className={styles.arenaRunes} />

				<div className={`${styles.skyIsland} ${styles.islandA}`}>
					<span className={styles.islandBody} />
					<span className={`${styles.hut} ${styles.hutA}`} />
					<span className={`${styles.tree} ${styles.treeA}`} />
				</div>
				<div className={`${styles.skyIsland} ${styles.islandB}`}>
					<span className={styles.islandBody} />
					<span className={`${styles.hut} ${styles.hutB}`} />
					<span className={`${styles.tree} ${styles.treeB}`} />
				</div>
				<div className={`${styles.skyIsland} ${styles.islandC}`}>
					<span className={styles.islandBody} />
					<span className={`${styles.hut} ${styles.hutC}`} />
				</div>
				<div className={`${styles.skyIsland} ${styles.islandD}`}>
					<span className={styles.islandBody} />
					<span className={`${styles.hut} ${styles.hutD}`} />
					<span className={`${styles.tree} ${styles.treeC}`} />
				</div>
				<div className={`${styles.skyIsland} ${styles.islandE}`}>
					<span className={styles.islandBody} />
					<span className={`${styles.tree} ${styles.treeD}`} />
				</div>
			</div>
			<div className={styles.vignette} />
			<div className={styles.grain} />
		</div>
	);
}
