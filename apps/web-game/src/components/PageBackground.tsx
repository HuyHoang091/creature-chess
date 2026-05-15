import React from "react";

import styles from "./PageBackground.module.css";

type Mote = {
	x: number;
	y: number;
	radius: number;
	speed: number;
	sway: number;
	alpha: number;
	spectral: boolean;
};

type Thorn = {
	x: number;
	width: number;
	height: number;
	sway: number;
};

const moteCount = 78;
const thornCount = 52;

function createMotes(): Mote[] {
	return Array.from({ length: moteCount }, (_, index) => ({
		x: Math.random(),
		y: Math.random(),
		radius: 0.6 + Math.random() * 2.8,
		speed: 0.08 + Math.random() * 0.24,
		sway: Math.random() * Math.PI * 2,
		alpha: 0.16 + Math.random() * 0.44,
		spectral: index % 4 !== 0,
	}));
}

function createThorns(): Thorn[] {
	return Array.from({ length: thornCount }, (_, index) => ({
		x: index * 34 - 40,
		width: 18 + Math.random() * 10,
		height: 34 + Math.random() * 20,
		sway: Math.random() * Math.PI * 2,
	}));
}

export function PageBoardBackground() {
	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}

		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const motes = createMotes();
		const thorns = createThorns();
		let width = 0;
		let height = 0;
		let frameId = 0;

		const resize = () => {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const drawMountainLayer = (
			baseY: number,
			color: string,
			peaks: number,
			amplitude: number,
			roughness: number
		) => {
			context.beginPath();
			context.moveTo(0, height);
			context.lineTo(0, baseY);

			for (let x = 0; x <= width; x += 14) {
				const t = x / width;
				const ridge =
					Math.sin(t * peaks * Math.PI + roughness) * amplitude +
					Math.sin(t * peaks * Math.PI * 2.4 - roughness * 1.4) *
						(amplitude * 0.28);
				context.lineTo(x, baseY - ridge);
			}

			context.lineTo(width, height);
			context.closePath();
			context.fillStyle = color;
			context.fill();
		};

		const drawAuroraBand = (
			offsetY: number,
			colorA: string,
			colorB: string,
			phase: number
		) => {
			const yBase = height * offsetY;
			context.save();
			context.globalCompositeOperation = "screen";
			context.lineWidth = 52;
			context.lineCap = "round";
			context.shadowBlur = 30;
			context.shadowColor = colorA;

			const gradient = context.createLinearGradient(0, yBase - 40, 0, yBase + 70);
			gradient.addColorStop(0, colorA);
			gradient.addColorStop(1, colorB);
			context.strokeStyle = gradient;

			context.beginPath();
			for (let x = -80; x <= width + 80; x += 14) {
				const normalized = x / width;
				const wave =
					Math.sin(normalized * 7 + phase) * 34 +
					Math.sin(normalized * 14 - phase * 0.7) * 14;
				const y = yBase + wave;
				if (x === -80) {
					context.moveTo(x, y);
				} else {
					context.lineTo(x, y);
				}
			}
			context.stroke();
			context.restore();
		};

		const drawFloatingIsland = (
			cx: number,
			cy: number,
			scale: number,
			shift: number,
			time: number
		) => {
			context.save();
			context.translate(
				cx + Math.sin(time * 0.0004 + shift) * 10,
				cy + Math.cos(time * 0.0003 + shift) * 6
			);
			context.scale(scale, scale);

			context.fillStyle = "rgba(17, 28, 34, 0.95)";
			context.beginPath();
			context.moveTo(-120, 10);
			context.quadraticCurveTo(-30, -22, 105, 0);
			context.quadraticCurveTo(98, 22, 36, 40);
			context.quadraticCurveTo(14, 90, -20, 96);
			context.quadraticCurveTo(-10, 56, -78, 44);
			context.quadraticCurveTo(-112, 34, -120, 10);
			context.fill();

			context.fillStyle = "rgba(8, 14, 19, 0.95)";
			context.beginPath();
			context.moveTo(-58, -18);
			context.lineTo(-22, -60);
			context.lineTo(-8, -26);
			context.lineTo(10, -88);
			context.lineTo(25, -20);
			context.lineTo(52, -48);
			context.lineTo(68, -10);
			context.lineTo(82, -6);
			context.lineTo(90, 10);
			context.lineTo(-65, 10);
			context.closePath();
			context.fill();

			context.strokeStyle = "rgba(140, 231, 205, 0.24)";
			context.lineWidth = 1.2;
			context.beginPath();
			context.moveTo(-42, -6);
			context.lineTo(-42, -42);
			context.lineTo(-24, -60);
			context.lineTo(-8, -60);
			context.lineTo(-8, -4);
			context.moveTo(8, -4);
			context.lineTo(8, -50);
			context.lineTo(26, -50);
			context.lineTo(26, -4);
			context.moveTo(44, -4);
			context.lineTo(44, -32);
			context.lineTo(60, -32);
			context.lineTo(60, -2);
			context.stroke();

			context.fillStyle = "rgba(109, 199, 175, 0.1)";
			context.fillRect(-40, -6, 96, 6);
			context.restore();
		};

		const drawSpire = (
			x: number,
			baseY: number,
			widthScale: number,
			heightScale: number,
			color: string
		) => {
			context.save();
			context.translate(x, baseY);
			context.fillStyle = color;
			context.beginPath();
			context.moveTo(-36 * widthScale, 0);
			context.lineTo(-18 * widthScale, -90 * heightScale);
			context.lineTo(-8 * widthScale, -180 * heightScale);
			context.lineTo(0, -260 * heightScale);
			context.lineTo(10 * widthScale, -168 * heightScale);
			context.lineTo(22 * widthScale, -104 * heightScale);
			context.lineTo(38 * widthScale, 0);
			context.closePath();
			context.fill();

			context.fillStyle = "rgba(246, 202, 145, 0.16)";
			context.fillRect(
				-12 * widthScale,
				-88 * heightScale,
				8 * widthScale,
				24 * heightScale
			);
			context.fillRect(
				5 * widthScale,
				-142 * heightScale,
				7 * widthScale,
				22 * heightScale
			);
			context.restore();
		};

		const draw = (timestamp: number) => {
			context.clearRect(0, 0, width, height);

			const skyGradient = context.createLinearGradient(0, 0, 0, height);
			skyGradient.addColorStop(0, "#02060b");
			skyGradient.addColorStop(0.22, "#0a1320");
			skyGradient.addColorStop(0.55, "#11283b");
			skyGradient.addColorStop(1, "#284b4d");
			context.fillStyle = skyGradient;
			context.fillRect(0, 0, width, height);

			const bloom = context.createRadialGradient(
				width * 0.52,
				height * 0.6,
				0,
				width * 0.52,
				height * 0.6,
				width * 0.36
			);
			bloom.addColorStop(0, "rgba(155, 241, 228, 0.38)");
			bloom.addColorStop(0.45, "rgba(122, 188, 177, 0.16)");
			bloom.addColorStop(1, "rgba(122, 188, 177, 0)");
			context.fillStyle = bloom;
			context.fillRect(0, 0, width, height);

			drawAuroraBand(
				0.2,
				"rgba(92, 231, 191, 0.14)",
				"rgba(93, 120, 255, 0.06)",
				timestamp * 0.0011
			);
			drawAuroraBand(
				0.28,
				"rgba(84, 163, 255, 0.08)",
				"rgba(176, 255, 245, 0.03)",
				timestamp * 0.0009 + 1.8
			);

			const moonX = width * 0.53;
			const moonY = height * 0.57;
			const moonRadius = Math.min(width, height) * 0.072;
			const moonGlow = context.createRadialGradient(
				moonX,
				moonY,
				0,
				moonX,
				moonY,
				moonRadius * 4.5
			);
			moonGlow.addColorStop(0, "rgba(211, 255, 245, 0.72)");
			moonGlow.addColorStop(0.26, "rgba(147, 219, 204, 0.34)");
			moonGlow.addColorStop(0.58, "rgba(109, 170, 164, 0.12)");
			moonGlow.addColorStop(1, "rgba(109, 170, 164, 0)");
			context.fillStyle = moonGlow;
			context.beginPath();
			context.arc(moonX, moonY, moonRadius * 4.5, 0, Math.PI * 2);
			context.fill();

			context.fillStyle = "#d9f8f0";
			context.beginPath();
			context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
			context.fill();

			context.fillStyle = "rgba(8, 20, 27, 0.42)";
			context.beginPath();
			context.arc(
				moonX + moonRadius * 0.34,
				moonY - moonRadius * 0.1,
				moonRadius * 0.82,
				0,
				Math.PI * 2
			);
			context.fill();

			drawMountainLayer(height * 0.62, "rgba(28, 54, 64, 0.34)", 4.8, 56, 0.7);
			drawMountainLayer(height * 0.7, "rgba(18, 31, 40, 0.7)", 5.6, 78, 1.9);

			drawFloatingIsland(width * 0.24, height * 0.29, 1.06, 0.4, timestamp);
			drawFloatingIsland(width * 0.78, height * 0.24, 0.88, 2.2, timestamp);
			drawFloatingIsland(width * 0.55, height * 0.18, 0.58, 4.1, timestamp);

			drawSpire(width * 0.14, height * 0.82, 1.1, 1.24, "rgba(17, 25, 31, 0.95)");
			drawSpire(width * 0.34, height * 0.79, 0.84, 1.05, "rgba(21, 31, 39, 0.94)");
			drawSpire(width * 0.67, height * 0.81, 0.98, 1.18, "rgba(20, 29, 36, 0.95)");
			drawSpire(width * 0.9, height * 0.84, 1.28, 1.42, "rgba(15, 22, 27, 0.97)");

			drawMountainLayer(height * 0.84, "rgba(13, 18, 22, 0.95)", 7.4, 104, 0.4);

			const fog = context.createLinearGradient(0, height * 0.58, 0, height);
			fog.addColorStop(0, "rgba(126, 198, 181, 0)");
			fog.addColorStop(0.38, "rgba(126, 198, 181, 0.16)");
			fog.addColorStop(1, "rgba(8, 11, 14, 0.76)");
			context.fillStyle = fog;
			context.fillRect(0, height * 0.46, width, height * 0.54);

			context.save();
			context.fillStyle = "rgba(5, 10, 13, 0.92)";
			for (const thorn of thorns) {
				const thornHeight = thorn.height + Math.sin(thorn.sway + timestamp * 0.0008) * 10;
				context.beginPath();
				context.moveTo(thorn.x, height);
				context.lineTo(thorn.x + thorn.width * 0.45, height - thornHeight);
				context.lineTo(thorn.x + thorn.width, height);
				context.closePath();
				context.fill();
			}
			context.restore();

			for (const mote of motes) {
				const x = mote.x * width + Math.sin(timestamp * 0.0005 * mote.speed + mote.sway) * 24;
				const y = ((mote.y + timestamp * 0.000012 * mote.speed) % 1) * height;
				context.beginPath();
				context.fillStyle = mote.spectral
					? `rgba(151, 240, 213, ${mote.alpha})`
					: `rgba(121, 147, 255, ${mote.alpha * 0.56})`;
				context.arc(x, y, mote.radius, 0, Math.PI * 2);
				context.fill();
			}

			frameId = window.requestAnimationFrame(draw);
		};

		resize();
		window.addEventListener("resize", resize);
		frameId = window.requestAnimationFrame(draw);

		return () => {
			window.removeEventListener("resize", resize);
			window.cancelAnimationFrame(frameId);
		};
	}, []);

	return (
		<div className={styles.root} aria-hidden="true">
			<canvas className={styles.canvas} ref={canvasRef} />
			<div className={styles.auroraGlow} />
			<div className={styles.godrayLeft} />
			<div className={styles.godrayRight} />
			<div className={styles.vignette} />
			<div className={styles.grain} />
		</div>
	);
}
