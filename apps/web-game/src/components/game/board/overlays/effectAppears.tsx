import React, { useEffect, useRef, useState } from 'react';
import { Settings2, Zap, Shield, Sword } from 'lucide-react';

// --- CÁC KIỂU DỮ LIỆU ---
interface WhirlpoolProps {
  size?: number;
  speedMultiplier?: number;
  intensity?: number;
  hue?: number; // Điều chỉnh màu sắc (mặc định là xanh nước biển)
  className?: string;
}

interface Particle {
  radius: number;
  angleOffset: number;
  size: number;
  speed: number;
  opacity: number;
  isFoam: boolean;
}

// --- COMPONENT VẼ CANVAS ---
const WhirlpoolEffect: React.FC<WhirlpoolProps> = ({
  size = 150,
  speedMultiplier = 1,
  intensity = 1,
  hue = 210, // Đổi màu mặc định thành xanh đại dương sâu hơn
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const maxRadius = size / 2;

    // Khởi tạo hệ thống hạt (Particles / Bọt biển)
    const particleCount = Math.floor(150 * intensity);
    const particles: Particle[] = Array.from({ length: particleCount }).map(() => ({
      radius: Math.random() * maxRadius,
      angleOffset: Math.random() * Math.PI * 2,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.1,
      isFoam: Math.random() > 0.75, // 25% là bọt trắng sáng
    }));

    const render = () => {
      time += 1 * speedMultiplier;
      const cx = size / 2;
      const cy = size / 2;

      // Xóa canvas
      ctx.clearRect(0, 0, size, size);

      // 1. NỀN NƯỚC SÂU (The Abyss) - Gradient đậm ở giữa, nhạt dần ra viền
      const bgGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      bgGradient.addColorStop(0, `hsla(${hue}, 90%, 5%, 0.95)`);
      bgGradient.addColorStop(0.3, `hsla(${hue}, 80%, 15%, 0.8)`);
      bgGradient.addColorStop(0.7, `hsla(${hue}, 70%, 25%, 0.4)`);
      bgGradient.addColorStop(1, `hsla(${hue}, 50%, 30%, 0)`);

      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. CÁC NHÁNH SÓNG XOÁY (Procedural Spiral Arms)
      const arms = 5;
      for (let i = 0; i < arms; i++) {
        const armOffset = (Math.PI * 2 / arms) * i;

        // Vẽ 3 lớp cho mỗi nhánh để tạo độ sâu (Đáy tối -> Nước giữa -> Bọt trên mặt)
        const layers = [
          { weight: 20, light: 20, alpha: 0.4 }, // Lớp bóng nước sâu
          { weight: 10, light: 40, alpha: 0.5 }, // Lớp nước giữa
          { weight: 3, light: 65, alpha: 0.6 }   // Lớp gợn sóng/bọt nước
        ];

        layers.forEach(layer => {
          ctx.beginPath();
          // Vẽ dọc theo bán kính từ trong ra ngoài bằng đường cong nối liền
          for (let r = 2; r <= maxRadius; r += 3) {
            // Toán học xoắn ốc: càng ra xa xoắn càng rộng (dùng hàm mũ 0.6)
            const spiralTwist = Math.pow(r / maxRadius, 0.6) * 12;
            const theta = armOffset + spiralTwist - time * 0.03 * speedMultiplier;

            // Biến dạng sóng (Wave distortion) để nước có vẻ cuộn trào tự nhiên
            const wave = Math.sin(r * 0.08 - time * 0.06 * speedMultiplier) * (r * 0.06);
            const actualR = r + wave;

            const x = cx + actualR * Math.cos(theta);
            const y = cy + actualR * Math.sin(theta);

            if (r === 2) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `hsla(${hue}, 80%, ${layer.light}%, ${layer.alpha})`;
          ctx.lineWidth = layer.weight;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      }

      // 3. TÂM MẮT BÃO (Tạo chiều sâu đen ngòm hút xuống)
      const eyeGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 0.4);
      eyeGradient.addColorStop(0, `hsla(${hue}, 100%, 2%, 1)`);
      eyeGradient.addColorStop(0.4, `hsla(${hue}, 90%, 8%, 0.8)`);
      eyeGradient.addColorStop(1, `hsla(${hue}, 50%, 20%, 0)`);
      ctx.fillStyle = eyeGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // 4. HẠT BỌT NƯỚC / VẬT CHẤT BỊ HÚT
      particles.forEach((p) => {
        // Hút vào tâm
        p.radius -= p.speed * speedMultiplier;

        // Tái tạo hạt nếu đã rơi vào tâm
        if (p.radius <= 2) {
          p.radius = maxRadius + Math.random() * 10;
          p.angleOffset = Math.random() * Math.PI * 2;
        }

        // Tính toán vị trí hạt di chuyển đồng bộ với dòng xoáy
        const spiralTwist = Math.pow(p.radius / maxRadius, 0.6) * 12;
        const theta = p.angleOffset + spiralTwist - time * 0.03 * speedMultiplier;
        const x = cx + p.radius * Math.cos(theta);
        const y = cy + p.radius * Math.sin(theta);

        // Vẽ vệt đuôi hạt (Motion Blur Tail)
        const prevRadius = p.radius + p.speed * speedMultiplier * 2.5;
        const prevTwist = Math.pow(prevRadius / maxRadius, 0.6) * 12;
        const prevTheta = p.angleOffset + prevTwist - (time - 1) * 0.03 * speedMultiplier;
        const px = cx + prevRadius * Math.cos(prevTheta);
        const py = cy + prevRadius * Math.sin(prevTheta);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);

        const lightness = p.isFoam ? 90 : 50;
        const alpha = p.isFoam ? p.opacity : p.opacity * 0.5;
        const fade = Math.min(1, p.radius / 15); // Mờ đi khi rơi vào vùng đen giữa tâm

        ctx.strokeStyle = `hsla(${hue}, ${p.isFoam ? '80%' : '60%'}, ${lightness}%, ${alpha * fade})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size, speedMultiplier, intensity, hue]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      style={{ pointerEvents: 'none' }} // Cho phép click xuyên qua nếu cần
    />
  );
};

export { WhirlpoolEffect };
