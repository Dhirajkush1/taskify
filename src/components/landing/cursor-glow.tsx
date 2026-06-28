"use client";

import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

export function CursorGlow() {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    // Disable on mobile/touch interfaces for accessibility
    const checkDevice = () => {
      const mobile = window.matchMedia("(max-width: 768px)").matches || 
                     ("ontouchstart" in window) || 
                     (navigator.maxTouchPoints > 0);
      setIsMobile(mobile);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);

    if (isMobile) return;

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) setIsVisible(true);

      // Simple magnetic attraction calculation
      const target = e.target as HTMLElement;
      const isButton = target.closest("button") || target.closest("a") || target.classList.contains("magnetic-btn");
      
      setIsHovered(!!isButton);

      if (isButton) {
        const rect = (target.closest("button") || target.closest("a") || target).getBoundingClientRect();
        const btnCenterX = rect.left + rect.width / 2;
        const btnCenterY = rect.top + rect.height / 2;

        // Pull cursor slightly to button center (magnetic pull)
        mouseX += (btnCenterX - mouseX) * 0.28;
        mouseY += (btnCenterY - mouseY) * 0.28;
      }
    };

    const handleMouseDown = () => {
      setIsClicking(true);
      createExplosion(mouseX, mouseY);
    };

    const handleMouseUp = () => {
      setIsClicking(false);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Frame loops to animate cursor trailing ring & canvas particles
    let animId: number;
    const updateRing = () => {
      // Smooth lerp for trailing cursor ring
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }

      // Draw canvas particles
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          particlesRef.current.forEach((p, idx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
              particlesRef.current.splice(idx, 1);
            } else {
              ctx.beginPath();
              ctx.fillStyle = p.color;
              ctx.globalAlpha = p.alpha;
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
          });
          ctx.globalAlpha = 1.0;
        }
      }

      animId = requestAnimationFrame(updateRing);
    };

    animId = requestAnimationFrame(updateRing);

    // Set canvas sizes
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animId);
    };
  }, [isMobile, isVisible]);

  const createExplosion = (x: number, y: number) => {
    const colors = ["rgba(139, 92, 246, 0.7)", "rgba(59, 130, 246, 0.7)", "rgba(236, 72, 153, 0.7)"];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.02,
      });
    }
  };

  if (isMobile) return null;

  return (
    <>
      {/* Click Particles Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-[9999]"
      />

      {/* Main Cursor Dot */}
      <div
        ref={cursorDotRef}
        className={`fixed top-0 left-0 w-2 h-2 bg-violet-600 rounded-full pointer-events-none z-[9999] transition-all duration-150 ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        } ${isHovered ? "scale-[3] bg-violet-500 mix-blend-difference" : ""} ${
          isClicking ? "scale-[0.8] bg-blue-500" : ""
        }`}
      />

      {/* Trailing Cursor Ring */}
      <div
        ref={cursorRingRef}
        className={`fixed top-0 left-0 w-8 h-8 rounded-full border border-violet-500/20 pointer-events-none z-[9999] transition-all duration-300 ease-out flex items-center justify-center ${
          isVisible ? "opacity-100" : "opacity-0"
        } ${isHovered ? "scale-[1.8] border-violet-400 bg-violet-400/5 backdrop-blur-[1px]" : ""} ${
          isClicking ? "scale-[0.6] border-blue-400/40 bg-blue-400/10" : ""
        }`}
      >
        {/* Central glowing indicator */}
        <div
          className={`w-0.5 h-0.5 bg-violet-500/0 rounded-full transition-all duration-300 ${
            isHovered ? "scale-[6] bg-violet-400/20" : ""
          }`}
        />
      </div>
    </>
  );
}
