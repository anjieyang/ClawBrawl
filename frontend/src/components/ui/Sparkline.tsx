import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export const Sparkline = ({ 
  data, 
  width = 100, 
  height = 30, 
  color = "#FF5722", 
  strokeWidth = 2 
}: SparklineProps) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Calculate points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Determine trend color if not overridden
  const isUp = data[data.length - 1] >= data[0];
  const finalColor = color === "auto" ? (isUp ? "#FF5722" : "#FF4D4D") : color;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Gradient defs could go here for fill effect */}
      <defs>
        <linearGradient id={`gradient-${isUp}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={finalColor} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={finalColor} stopOpacity="0"/>
        </linearGradient>
      </defs>
      
      {/* Fill Area */}
      <path 
        d={`M 0,${height} L ${points.split(' ').map((p, i) => i === 0 ? `0,${p.split(',')[1]}` : p).join(' L ')} L ${width},${height} Z`} 
        fill={`url(#gradient-${isUp})`} 
        stroke="none" 
      />

      {/* Line */}
      <polyline 
        points={points} 
        fill="none" 
        stroke={finalColor} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* End dot */}
      <circle 
        cx={width} 
        cy={height - ((data[data.length - 1] - min) / range) * height} 
        r={2} 
        fill={finalColor} 
      />
    </svg>
  );
};
