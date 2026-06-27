"use client";

import { motion } from "framer-motion";
import { TrendingUp, BarChart4, AlertTriangle, Sparkles } from "lucide-react";

interface CustomChartsProps {
  analytics: {
    weekly_completion_trend: Array<{ day: string; completed: number }>;
    probability_trend: Array<{ date: string; probability: number }>;
    insufficientHistory?: boolean;
  };
}

export function CustomCharts({ analytics }: CustomChartsProps) {
  const completionData = analytics.weekly_completion_trend || [];
  const probabilityData = analytics.probability_trend || [];
  const isHistoryEmpty = analytics.insufficientHistory || completionData.length === 0;

  // --- CHART 1: Productivity Area Chart (Glow & Gradient) ---
  const width = 500;
  const height = 150;
  const padding = 20;

  // Compute points for Area Chart
  const getAreaPoints = () => {
    if (completionData.length === 0) return "";
    const maxVal = Math.max(...completionData.map((d) => d.completed), 4);
    
    return completionData
      .map((d, idx) => {
        const x = padding + (idx * (width - padding * 2)) / (completionData.length - 1);
        const y = height - padding - (d.completed * (height - padding * 2)) / maxVal;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const areaPoints = getAreaPoints();
  
  // Create closed path for the gradient fill
  const getFillPoints = () => {
    if (!areaPoints) return "";
    const pointsList = areaPoints.split(" ");
    const firstX = pointsList[0].split(",")[0];
    const lastX = pointsList[pointsList.length - 1].split(",")[0];
    return `${areaPoints} ${lastX},${height - padding} ${firstX},${height - padding}`;
  };

  const fillPoints = getFillPoints();

  // --- CHART 2: Risk & Probability Line Chart ---
  const getLinePoints = () => {
    if (probabilityData.length === 0) return "";
    return probabilityData
      .map((d, idx) => {
        const x = padding + (idx * (width - padding * 2)) / (probabilityData.length - 1);
        // Map 0-100% to height
        const y = height - padding - (d.probability * (height - padding * 2)) / 100;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const linePoints = getLinePoints();

  if (isHistoryEmpty) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
        {/* Empty State Chart 1 */}
        <div
          className="rounded-2xl p-6 border flex flex-col items-center justify-center text-center gap-3 min-h-[220px] relative overflow-hidden"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/5 border border-violet-500/10 flex items-center justify-center mb-1">
            <TrendingUp className="w-5 h-5 text-violet-400/70" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Productivity Timeline
          </h4>
          <p className="text-xs text-neutral-500 max-w-[80%] leading-relaxed">
            Insufficient history to plot trends. Complete focus sessions and check off active tasks to compile your performance curves!
          </p>
        </div>

        {/* Empty State Chart 2 */}
        <div
          className="rounded-2xl p-6 border flex flex-col items-center justify-center text-center gap-3 min-h-[220px] relative overflow-hidden"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center mb-1">
            <AlertTriangle className="w-5 h-5 text-amber-400/70" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Success & Risk Forecast
          </h4>
          <p className="text-xs text-neutral-500 max-w-[80%] leading-relaxed">
            Your daily completion probability and deadline risk forecasts will unlock here once your first two daily cycles are logged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
      {/* Chart 1: Productivity Trends */}
      <div
        className="rounded-2xl p-5 border flex flex-col gap-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Productivity & Completion Trend
            </h4>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" /> Active Sync
          </span>
        </div>

        {/* SVG Drawing */}
        <div className="relative w-full h-[150px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* Gradient Fill */}
            {fillPoints && (
              <polygon points={fillPoints} fill="url(#areaGrad)" />
            )}

            {/* Stroke Line */}
            {areaPoints && (
              <motion.polyline
                fill="none"
                stroke="rgb(139, 92, 246)"
                strokeWidth="2.5"
                points={areaPoints}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            )}

            {/* Data nodes */}
            {completionData.map((d, idx) => {
              if (completionData.length === 0) return null;
              const maxVal = Math.max(...completionData.map((v) => v.completed), 4);
              const x = padding + (idx * (width - padding * 2)) / (completionData.length - 1);
              const y = height - padding - (d.completed * (height - padding * 2)) / maxVal;

              return (
                <g key={idx} className="group cursor-pointer">
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="rgb(139, 92, 246)"
                    className="transition-all duration-250 hover:r-6"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="9"
                    fill="rgb(139, 92, 246)"
                    fillOpacity="0.15"
                    className="opacity-0 group-hover:opacity-100 transition-all duration-250"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Labels */}
        <div className="flex justify-between px-2 text-[10px] text-neutral-500 font-bold">
          {completionData.map((d, idx) => (
            <span key={idx}>{d.day}</span>
          ))}
        </div>
      </div>

      {/* Chart 2: Success Probability Forecast */}
      <div
        className="rounded-2xl p-5 border flex flex-col gap-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Completion Probability & Risk Forecast
            </h4>
          </div>
          <span className="text-[10px] text-neutral-500 font-medium">
            Timeline Log
          </span>
        </div>

        {/* SVG Drawing */}
        <div className="relative w-full h-[150px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(245, 158, 11)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="rgb(245, 158, 11)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

            {/* Stroke Line */}
            {linePoints && (
              <motion.polyline
                fill="none"
                stroke="rgb(245, 158, 11)"
                strokeWidth="2.5"
                points={linePoints}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
            )}

            {/* Data nodes */}
            {probabilityData.map((d, idx) => {
              const x = padding + (idx * (width - padding * 2)) / (probabilityData.length - 1);
              const y = height - padding - (d.probability * (height - padding * 2)) / 100;

              return (
                <g key={idx} className="group cursor-pointer">
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="rgb(245, 158, 11)"
                    className="transition-all duration-250"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="9"
                    fill="rgb(245, 158, 11)"
                    fillOpacity="0.15"
                    className="opacity-0 group-hover:opacity-100 transition-all"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Labels */}
        <div className="flex justify-between px-2 text-[10px] text-neutral-500 font-bold">
          {probabilityData.map((d, idx) => (
            <span key={idx}>{d.date}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
