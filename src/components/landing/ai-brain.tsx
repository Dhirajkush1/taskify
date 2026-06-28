"use client";

import { useEffect, useRef, useState } from "react";

interface Node3D {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  speed: number;
  pulsePhase: number;
}

interface OrbitItem {
  id: string;
  label: string;
  angle: number;
  radiusX: number;
  heightOffset: number;
  speed: number;
}

interface AIBrainProps {
  activeModule: string | null;
  onOrbitUpdate: (positions: Record<string, { x: number; y: number; z: number; scale: number }>) => void;
  hoveredModule: string | null;
}

export function AIBrain({ activeModule, onOrbitUpdate, hoveredModule }: AIBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  // 12 Orbiting Modules distributed volumetrically around the brain to prevent clumping
  const orbitItemsRef = useRef<OrbitItem[]>([
    { id: "mission", label: "Mission Control", angle: 0, radiusX: 245, heightOffset: -140, speed: 0.003 },
    { id: "calendar", label: "Calendar", angle: (Math.PI * 2) / 12 * 1, radiusX: 280, heightOffset: -95, speed: 0.0025 },
    { id: "telegram", label: "Telegram Bot", angle: (Math.PI * 2) / 12 * 2, radiusX: 260, heightOffset: -50, speed: 0.0032 },
    { id: "voice", label: "Voice Sync", angle: (Math.PI * 2) / 12 * 3, radiusX: 240, heightOffset: -10, speed: 0.0028 },
    { id: "habits", label: "Habit Engine", angle: (Math.PI * 2) / 12 * 4, radiusX: 275, heightOffset: 35, speed: 0.003 },
    { id: "rescue", label: "Rescue Mode", angle: (Math.PI * 2) / 12 * 5, radiusX: 290, heightOffset: 80, speed: 0.0022 },
    { id: "planner", label: "Daily Planner", angle: (Math.PI * 2) / 12 * 6, radiusX: 250, heightOffset: 125, speed: 0.0035 },
    { id: "debrief", label: "Daily Debrief", angle: (Math.PI * 2) / 12 * 7, radiusX: 285, heightOffset: -115, speed: 0.0024 },
    { id: "analytics", label: "Analytics OS", angle: (Math.PI * 2) / 12 * 8, radiusX: 265, heightOffset: -75, speed: 0.0031 },
    { id: "whatif", label: "What-If Simulator", angle: (Math.PI * 2) / 12 * 9, radiusX: 245, heightOffset: 15, speed: 0.0029 },
    { id: "reminders", label: "Smart Reminders", angle: (Math.PI * 2) / 12 * 10, radiusX: 270, heightOffset: 60, speed: 0.0033 },
    { id: "goals", label: "Goal Tracker", angle: (Math.PI * 2) / 12 * 11, radiusX: 300, heightOffset: 105, speed: 0.0026 },
  ]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track mouse movements relative to container center
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        mouseRef.current.tx = (e.clientX - centerX) / (rect.width / 2);
        mouseRef.current.ty = (e.clientY - centerY) / (rect.height / 2);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Generate 3D Brain points
    const nodesCount = 350;
    const nodes: Node3D[] = [];
    for (let i = 0; i < nodesCount; i++) {
      // Golden spiral distribution for a perfect sphere shell
      const phi = Math.acos(-1 + (2 * i) / nodesCount);
      const theta = Math.sqrt(nodesCount * Math.PI) * phi;
      const radius = 120 + Math.sin(i) * 5; // adding subtle texture ridges

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      nodes.push({
        x,
        y,
        z,
        ox: x,
        oy: y,
        oz: z,
        speed: 0.002 + Math.random() * 0.003,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let angleX = 0;
    let angleY = 0;
    let animationId: number;

    const fov = 400;

    const render = () => {
      // Clear with soft premium background
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Lerp mouse coordinates for smooth inertia tilt
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.05;

      // Base rotation + cursor tilt
      angleY = 0.0035 + mouseRef.current.x * 0.01;
      angleX = mouseRef.current.y * 0.01;

      // Rotate nodes in 3D
      nodes.forEach((n) => {
        // Rotate around Y
        let x1 = n.x * Math.cos(angleY) - n.z * Math.sin(angleY);
        let z1 = n.z * Math.cos(angleY) + n.x * Math.sin(angleY);

        // Rotate around X
        let y2 = n.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        let z2 = z1 * Math.cos(angleX) + n.y * Math.sin(angleX);

        n.x = x1;
        n.y = y2;
        n.z = z2;
        n.pulsePhase += 0.02;
      });

      // Update and project orbiting items
      const updatedPositions: Record<string, { x: number; y: number; z: number; scale: number }> = {};
      const isAnyHovered = hoveredModule !== null || activeModule !== null;

      orbitItemsRef.current.forEach((item) => {
        // Orbit speed drops to 0 or slows down on hover
        const isHovered = hoveredModule === item.id || activeModule === item.id;
        const currentSpeed = isHovered ? 0 : isAnyHovered ? item.speed * 0.15 : item.speed;

        item.angle += currentSpeed;

        // Base 3D coordinates for orbiting elements
        let ox = Math.cos(item.angle) * item.radiusX;
        let oz = Math.sin(item.angle) * item.radiusX; // dynamic depth
        let oy = item.heightOffset + Math.sin(item.angle * 2) * 15; // static offset + micro-wave

        // Apply mouse tilt to orbit items too
        let rx1 = ox * Math.cos(angleY) - oz * Math.sin(angleY);
        let rz1 = oz * Math.cos(angleY) + ox * Math.sin(angleY);
        let ry2 = oy * Math.cos(angleX) - rz1 * Math.sin(angleX);
        let rz2 = rz1 * Math.cos(angleX) + oy * Math.sin(angleX);

        // 3D Perspective mapping
        const scale = fov / (fov + rz2);
        const screenX = rx1 * scale + dimensions.width / 2;
        const screenY = ry2 * scale + dimensions.height / 2;

        updatedPositions[item.id] = {
          x: screenX,
          y: screenY,
          z: rz2,
          scale,
        };
      });

      // Notify parent of 2D screen positions to overlay HTML cards dynamically
      onOrbitUpdate(updatedPositions);

      // Draw Connections (lines) between brain nodes
      ctx.lineWidth = 0.5;
      const maxDistance = 75;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        
        // Project node to screen space
        const scale1 = fov / (fov + n1.z);
        const x1 = n1.x * scale1 + dimensions.width / 2;
        const y1 = n1.y * scale1 + dimensions.height / 2;

        // Skip drawing if outside screen boundaries
        if (x1 < 0 || x1 > dimensions.width || y1 < 0 || y1 > dimensions.height) continue;

        // Draw node dot
        const size = (1.5 + Math.sin(n1.pulsePhase) * 0.75) * scale1;
        const alpha = Math.max(0.1, (fov - n1.z) / (fov * 1.5));
        
        ctx.beginPath();
        // Brain glows with beautiful soft violet/indigo tints
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.arc(x1, y1, size, 0, Math.PI * 2);
        ctx.fill();

        // Check nearest neighbors to connect
        let connectionsCount = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          if (connectionsCount > 3) break; // Limit lines per node to keep UI clean and performant
          const n2 = nodes[j];

          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dz = n1.z - n2.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            const scale2 = fov / (fov + n2.z);
            const x2 = n2.x * scale2 + dimensions.width / 2;
            const y2 = n2.y * scale2 + dimensions.height / 2;

            // Connection opacity based on distance and depth
            const lineAlpha = (1 - dist / maxDistance) * 0.16 * ((scale1 + scale2) / 2);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${lineAlpha})`;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            connectionsCount++;
          }
        }
      }

      // Draw volumetric glowing central core
      const coreX = dimensions.width / 2;
      const coreY = dimensions.height / 2;
      
      const gradient = ctx.createRadialGradient(
        coreX, coreY, 0,
        coreX, coreY, 110
      );
      gradient.addColorStop(0, "rgba(237, 233, 254, 0.22)"); // Soft violet glow center
      gradient.addColorStop(0.5, "rgba(219, 234, 254, 0.08)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(coreX, coreY, 110, 0, Math.PI * 2);
      ctx.fill();

      // If a module is hovered/active, draw a laser-like highlight wireframe connection
      if (isAnyHovered) {
        const targetId = hoveredModule || activeModule;
        const targetPos = updatedPositions[targetId!];
        if (targetPos) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.moveTo(dimensions.width / 2, dimensions.height / 2);
          ctx.lineTo(targetPos.x, targetPos.y);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw target node impact point
          ctx.beginPath();
          ctx.fillStyle = "rgba(139, 92, 246, 0.65)";
          ctx.arc(targetPos.x, targetPos.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [dimensions, hoveredModule, activeModule, onOrbitUpdate]);

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="max-w-full max-h-full block z-10 pointer-events-none"
      />
    </div>
  );
}
