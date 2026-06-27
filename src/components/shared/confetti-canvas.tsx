"use client";

import { useEffect, useRef, useState } from "react";

// Global event name for triggering confetti
const CONFETTI_EVENT = "clutch-trigger-confetti";

export function triggerConfetti() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONFETTI_EVENT));
  }
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const colors = [
  "#a78bfa", // violet
  "#f43f5e", // rose
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
];

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const spawnConfetti = useCallback(() => {
    setActive(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newParticles: Particle[] = [];
    const particleCount = 120;

    for (let i = 0; i < particleCount; i++) {
      // Spawn from the bottom center/sides
      const fromLeft = Math.random() > 0.5;
      newParticles.push({
        x: fromLeft ? 0 : canvas.width,
        y: canvas.height * 0.8,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (fromLeft ? 1 : -1) * (Math.random() * 12 + 6),
        speedY: -(Math.random() * 18 + 12),
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        opacity: 1,
      });
    }

    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, []);

  useEffect(() => {
    const handleTrigger = () => {
      spawnConfetti();
    };

    window.addEventListener(CONFETTI_EVENT, handleTrigger);
    return () => {
      window.removeEventListener(CONFETTI_EVENT, handleTrigger);
    };
  }, [spawnConfetti]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // Animation Loop
  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateAndRender = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Apply physics
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.45; // gravity
        p.speedX *= 0.98; // friction
        p.rotation += p.rotationSpeed;

        // Fade out as they fall near bottom
        if (p.y > canvas.height * 0.7) {
          p.opacity -= 0.02;
        }

        // Remove dead particles
        if (p.y > canvas.height || p.opacity <= 0 || p.x < 0 || p.x > canvas.width) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        // Draw rectangle shape
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
        ctx.restore();
      }

      if (particles.length === 0) {
        setActive(false);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        animationFrameRef.current = requestAnimationFrame(updateAndRender);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateAndRender);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-55 w-full h-full"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
