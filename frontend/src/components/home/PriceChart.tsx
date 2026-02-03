'use client'

import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine, XAxis } from 'recharts';
import { useMemo } from 'react';

interface PriceSnapshot {
  timestamp: number;
  price: number;
}

interface PriceChartProps {
  openPrice: number;
  currentPrice: number;
  isUp: boolean;
  timeLeft: number; 
  totalDurationSeconds: number;
  priceHistory?: PriceSnapshot[];
}

interface DataPoint {
  time: number;
  value: number | null;
}

const CustomizedDot = (props: any) => {
  const { cx, cy, index, data, color, dataKey, isActiveSeries } = props;
  
  if (!data || data.length === 0) return null;
  // Only render dot for the active series (the one containing current price)
  if (!isActiveSeries) return null;
  
  // Find the last valid (non-null) point index for this specific dataKey (above or below)
  let lastValidIndex = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    const val = data[i][dataKey];
    if (val !== null && val !== undefined) {
      lastValidIndex = i;
      break;
    }
  }
  
  // Only render dot on the last valid point
  if (index !== lastValidIndex || lastValidIndex === -1) return null;
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      {/* Outer glow - pure opacity animation, no scale transform */}
      <circle cx={cx} cy={cy} r="8" fill={color} fillOpacity="0.2">
        <animate 
          attributeName="opacity" 
          values="0.4;0.1;0.4" 
          dur="1.5s" 
          repeatCount="indefinite" 
        />
      </circle>
      {/* Middle ring */}
      <circle cx={cx} cy={cy} r="5" fill={color} fillOpacity="0.35" />
      {/* Inner solid dot */}
      <circle cx={cx} cy={cy} r="3" fill={color} stroke="#fff" strokeWidth="0.5" />
    </g>
  );
};

export default function PriceChart({ 
  openPrice, 
  currentPrice, 
  isUp, 
  timeLeft, 
  totalDurationSeconds,
  priceHistory = []
}: PriceChartProps) {
  const TOTAL_DURATION =
    Number.isFinite(totalDurationSeconds) && totalDurationSeconds > 0 ? totalDurationSeconds : 600;
  const POINTS_COUNT = 50;

  // Build chart data from real price history
  const data = useMemo((): DataPoint[] => {
    const timeElapsed = Math.max(0, TOTAL_DURATION - timeLeft);
    const progressPercent = Math.min(1, Math.max(0.02, timeElapsed / TOTAL_DURATION));
    const currentPointIndex = Math.floor(POINTS_COUNT * progressPercent);
    
    const newData: DataPoint[] = [];

    // If we have real price history, use it
    if (priceHistory.length > 0) {
      // Calculate round start time from current time and elapsed time
      const nowMs = Date.now();
      const timeElapsedMs = timeElapsed * 1000;
      const roundStartMs = nowMs - timeElapsedMs;
      const totalDurationMs = TOTAL_DURATION * 1000;
      
      for (let i = 0; i <= POINTS_COUNT; i++) {
        if (i > currentPointIndex) {
          // Future points: null (chart doesn't reach here yet)
          newData.push({ time: i, value: null });
        } else if (i === 0) {
          // First point: always openPrice
          newData.push({ time: 0, value: openPrice });
        } else if (i === currentPointIndex) {
          // Current "head" point: use actual currentPrice
          newData.push({ time: i, value: currentPrice });
        } else {
          // Historical point: find the closest price snapshot for this time slot
          const targetProgress = i / POINTS_COUNT;
          const targetMs = roundStartMs + (targetProgress * totalDurationMs);
          
          // Find the snapshot closest to this target time
          let closestSnapshot: PriceSnapshot | null = null;
          let minDiff = Infinity;
          
          for (const snapshot of priceHistory) {
            const diff = Math.abs(targetMs - snapshot.timestamp);
            if (diff < minDiff) {
              minDiff = diff;
              closestSnapshot = snapshot;
            }
          }
          
          // Use closest snapshot if found, otherwise interpolate
          if (closestSnapshot && minDiff < 30000) { // Within 30 seconds
            newData.push({ time: i, value: closestSnapshot.price });
          } else {
            // No close snapshot found - interpolate between open and current
            const progress = i / currentPointIndex;
            const interpolatedValue = openPrice + (currentPrice - openPrice) * progress;
            newData.push({ time: i, value: interpolatedValue });
          }
        }
      }
    } else {
      // Fallback: no history available, show only current price point
      for (let i = 0; i <= POINTS_COUNT; i++) {
        if (i > currentPointIndex) {
          newData.push({ time: i, value: null });
        } else if (i === 0) {
          newData.push({ time: 0, value: openPrice });
        } else if (i === currentPointIndex) {
          newData.push({ time: i, value: currentPrice });
        } else {
          // Interpolate between open and current when no history
          const progress = i / currentPointIndex;
          const interpolatedValue = openPrice + (currentPrice - openPrice) * progress;
          newData.push({ time: i, value: interpolatedValue });
        }
      }
    }
    
    return newData;
  }, [openPrice, currentPrice, timeLeft, priceHistory, TOTAL_DURATION, POINTS_COUNT]);
  
  // Calculate Y-axis domain: openPrice is ALWAYS at vertical center
  const yDomain = useMemo(() => {
    const validValues = data.filter(d => d.value !== null).map(d => d.value as number);
    if (validValues.length === 0) return [openPrice - 100, openPrice + 100];
    
    const dataMax = Math.max(...validValues);
    const dataMin = Math.min(...validValues);
    
    // Find max deviation from openPrice (either direction)
    const deviationUp = dataMax - openPrice;
    const deviationDown = openPrice - dataMin;
    
    // Use percentage-based minimum deviation for high-value assets
    // 0.1% of openPrice ensures visibility even for BTC at 78000+
    const minDeviationPercent = 0.001; // 0.1%
    const minDeviation = Math.max(50, openPrice * minDeviationPercent);
    
    const maxDeviation = Math.max(deviationUp, deviationDown, minDeviation);
    
    // Add 20% padding
    const paddedDeviation = maxDeviation * 1.2;
    
    // Symmetric domain around openPrice
    return [openPrice - paddedDeviation, openPrice + paddedDeviation];
  }, [data, openPrice]);

  // Split series into above/below openPrice, inserting intersection points when crossing.
  const splitSeries = useMemo(() => {
    type SplitPoint = { time: number; above: number | null; below: number | null };

    const out: SplitPoint[] = [];
    if (data.length === 0) return out;

    const pushPoint = (time: number, value: number | null) => {
      if (value === null) {
        out.push({ time, above: null, below: null });
        return;
      }
      if (value === openPrice) {
        out.push({ time, above: openPrice, below: openPrice });
      } else if (value > openPrice) {
        out.push({ time, above: value, below: null });
      } else {
        out.push({ time, above: null, below: value });
      }
    };

    let prevTime: number | null = null;
    let prevValue: number | null = null;

    for (let i = 0; i < data.length; i++) {
      const { time, value } = data[i];

      // Always include future points as nulls so X domain stays stable
      if (value === null) {
        pushPoint(time, null);
        prevTime = time;
        prevValue = null;
        continue;
      }

      if (prevValue === null || prevTime === null) {
        // Start of visible series
        pushPoint(time, value);
        prevTime = time;
        prevValue = value;
        continue;
      }

      const a = prevValue - openPrice;
      const b = value - openPrice;
      const crosses = a === 0 || b === 0 ? false : (a > 0 && b < 0) || (a < 0 && b > 0);

      if (!crosses) {
        pushPoint(time, value);
        prevTime = time;
        prevValue = value;
        continue;
      }

      // Insert intersection at openPrice between prev and current.
      const denom = value - prevValue;
      const ratio = denom === 0 ? 0.5 : (openPrice - prevValue) / denom;
      const clampedRatio = Math.min(1, Math.max(0, ratio));
      const crossTime = prevTime + (time - prevTime) * clampedRatio;

      out.push({ time: crossTime, above: openPrice, below: openPrice });
      pushPoint(time, value);

      prevTime = time;
      prevValue = value;
    }

    // Ensure time=0 exists in output for left-edge anchoring
    if (out.length > 0 && out[0].time !== 0) {
      out.unshift({ time: 0, above: openPrice, below: openPrice });
    }

    return out;
  }, [data, openPrice]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={splitSeries} margin={{ top: 20, right: 0, left: 0, bottom: 20 }}>
          <defs>
            {/* (kept empty intentionally) */}
          </defs>
          
          <XAxis 
            dataKey="time" 
            type="number" 
            domain={[0, POINTS_COUNT]}
            allowDataOverflow={true}
            padding={{ left: 0, right: 0 }}
            scale="linear"
            hide 
          />
          <YAxis 
            domain={yDomain}
            allowDataOverflow={true}
            hide 
          />
          
          {/* Opening price reference line - horizontal dashed line at center */}
          <ReferenceLine 
            y={openPrice} 
            stroke="#ffffff" 
            strokeDasharray="8 4" 
            strokeOpacity={0.45} 
            strokeWidth={1.5}
          />

          {/* Above openPrice: GREEN line + fill (price is UP = profit) */}
          <Area
            type="monotone"
            dataKey="above"
            stroke="#22C55E"
            strokeOpacity={0.9}
            strokeWidth={2}
            fill="#22C55E"
            fillOpacity={0.18}
            baseValue={openPrice}
            isAnimationActive={false}
            dot={<CustomizedDot data={splitSeries} color="#22C55E" dataKey="above" isActiveSeries={isUp} />}
            connectNulls={false}
          />

          {/* Below openPrice: RED line + fill (price is DOWN = loss) */}
          <Area
            type="monotone"
            dataKey="below"
            stroke="#EF4444"
            strokeOpacity={0.9}
            strokeWidth={2}
            fill="#EF4444"
            fillOpacity={0.18}
            baseValue={openPrice}
            isAnimationActive={false}
            dot={<CustomizedDot data={splitSeries} color="#EF4444" dataKey="below" isActiveSeries={!isUp} />}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
