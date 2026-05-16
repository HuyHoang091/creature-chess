const canvas = document.getElementById("board-scene");
const context = canvas.getContext("2d");
const shell = document.querySelector(".shell");
const shopToggle = document.querySelector(".shop-toggle");

const dpr = Math.min(window.devicePixelRatio || 1, 2);
let width = 0;
let height = 0;
let lightningAlpha = 0;
let lightningDecay = 0.9;
let lightningBranches = [];

const motes = Array.from({ length: 110 }, (_, index) => ({
  x: Math.random(),
  y: Math.random(),
  radius: 0.8 + Math.random() * 2.4,
  speed: 0.08 + Math.random() * 0.24,
  sway: Math.random() * Math.PI * 2,
  alpha: 0.16 + Math.random() * 0.4,
  spectral: index % 3 !== 0,
}));

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawSky() {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#02050a");
  gradient.addColorStop(0.28, "#08111a");
  gradient.addColorStop(0.62, "#0d1821");
  gradient.addColorStop(1, "#101b20");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawAuroraRing(offsetY, colorA, colorB, phase, alpha) {
  const yBase = height * offsetY;
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineWidth = 36;
  context.lineCap = "round";
  context.shadowBlur = 24;
  context.shadowColor = colorA;
  context.globalAlpha = alpha;

  const gradient = context.createLinearGradient(0, yBase - 60, 0, yBase + 50);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(1, colorB);
  context.strokeStyle = gradient;

  context.beginPath();
  for (let x = -60; x <= width + 60; x += 12) {
    const normalized = x / width;
    const wave =
      Math.sin(normalized * 9 + phase) * 24 +
      Math.sin(normalized * 16 - phase * 0.8) * 10;
    const y = yBase + wave;
    if (x === -60) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  context.restore();
}

function drawBackdropArchitecture() {
  context.save();

  const leftGradient = context.createLinearGradient(0, 0, width * 0.2, 0);
  leftGradient.addColorStop(0, "rgba(3, 7, 10, 0.96)");
  leftGradient.addColorStop(1, "rgba(3, 7, 10, 0)");
  context.fillStyle = leftGradient;
  context.fillRect(0, 0, width * 0.26, height);

  const rightGradient = context.createLinearGradient(width, 0, width * 0.8, 0);
  rightGradient.addColorStop(0, "rgba(3, 7, 10, 0.96)");
  rightGradient.addColorStop(1, "rgba(3, 7, 10, 0)");
  context.fillStyle = rightGradient;
  context.fillRect(width * 0.74, 0, width * 0.26, height);

  for (let i = 0; i < 7; i += 1) {
    const x = width * 0.12 + i * width * 0.11;
    const h = height * (0.24 + (i % 3) * 0.05);
    context.fillStyle = "rgba(9, 14, 19, 0.9)";
    context.beginPath();
    context.moveTo(x, height * 0.24);
    context.lineTo(x + 18, height * 0.24 - h);
    context.lineTo(x + 36, height * 0.24);
    context.closePath();
    context.fill();
  }

  context.restore();
}

function drawCenterGlow(time) {
  const x = width * 0.5;
  const y = height * 0.54;
  const radius = Math.min(width, height) * 0.22;

  const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.7);
  glow.addColorStop(0, "rgba(96, 240, 214, 0.22)");
  glow.addColorStop(0.4, "rgba(96, 240, 214, 0.08)");
  glow.addColorStop(1, "rgba(96, 240, 214, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * 2.7, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `rgba(112, 126, 255, ${0.08 + Math.sin(time * 0.0016) * 0.02})`;
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(x, y, radius * 2.1, radius * 1.06, 0, 0, Math.PI * 2);
  context.stroke();
}

function maybeTriggerLightning() {
  if (lightningAlpha > 0.02) {
    return;
  }

  if (Math.random() > 0.007) {
    return;
  }

  lightningAlpha = 0.92;
  lightningDecay = 0.87 + Math.random() * 0.05;
  const startX = width * (0.18 + Math.random() * 0.64);
  const startY = height * 0.05;
  let currentX = startX;
  let currentY = startY;
  lightningBranches = [{ points: [[currentX, currentY]] }];

  const segments = 7 + Math.floor(Math.random() * 4);
  for (let i = 0; i < segments; i += 1) {
    currentX += (Math.random() - 0.5) * width * 0.08;
    currentY += height * (0.03 + Math.random() * 0.045);
    lightningBranches[0].points.push([currentX, currentY]);
  }
}

function drawLightning() {
  if (lightningAlpha <= 0.02 || lightningBranches.length === 0) {
    return;
  }

  context.save();
  context.globalCompositeOperation = "screen";
  context.strokeStyle = `rgba(196, 236, 255, ${lightningAlpha})`;
  context.shadowColor = `rgba(129, 213, 255, ${lightningAlpha})`;
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

  context.fillStyle = `rgba(170, 221, 255, ${lightningAlpha * 0.06})`;
  context.fillRect(0, 0, width, height);
  context.restore();

  lightningAlpha *= lightningDecay;
}

function drawMotes(time) {
  for (const mote of motes) {
    const x = mote.x * width + Math.sin(time * 0.0006 * mote.speed + mote.sway) * 26;
    const y = ((mote.y + time * 0.00002 * mote.speed) % 1) * height;
    context.beginPath();
    context.fillStyle = mote.spectral
      ? `rgba(141, 242, 218, ${mote.alpha})`
      : `rgba(112, 126, 255, ${mote.alpha * 0.72})`;
    context.arc(x, y, mote.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function render(time) {
  context.clearRect(0, 0, width, height);
  drawSky();
  drawAuroraRing(0.2, "rgba(95, 226, 202, 0.24)", "rgba(95, 226, 202, 0)", time * 0.0012, 0.84);
  drawAuroraRing(0.32, "rgba(112, 126, 255, 0.18)", "rgba(112, 126, 255, 0)", time * 0.001, 0.68);
  drawBackdropArchitecture();
  drawCenterGlow(time);
  maybeTriggerLightning();
  drawLightning();
  drawMotes(time);
  requestAnimationFrame(render);
}

function setShopState(nextState) {
  if (!shell || !shopToggle) {
    return;
  }

  shell.dataset.shopState = nextState;
  const expanded = nextState === "expanded";
  shopToggle.setAttribute("aria-expanded", String(expanded));
}

if (shopToggle) {
  shopToggle.addEventListener("click", () => {
    const nextState =
      shell?.dataset.shopState === "collapsed" ? "expanded" : "collapsed";
    setShopState(nextState);
  });
}

resize();
window.addEventListener("resize", resize);
setShopState(shell?.dataset.shopState || "expanded");
requestAnimationFrame(render);
