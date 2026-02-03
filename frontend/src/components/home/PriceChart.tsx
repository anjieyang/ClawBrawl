'use client'

import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine, XAxis } from 'recharts';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';

interface PriceChartProps {
  openPrice: number;
  currentPrice: number;
  isUp: boolean;
  timeLeft: number; 
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

export default function PriceChart({ openPrice, currentPrice, isUp, timeLeft }: PriceChartProps) {
  const TOTAL_DURATION = 600; // 10 minutes
  const POINTS_COUNT = 50;
  
  // Use ref to store historical prices that should NOT change once generated
  const historicalDataRef = useRef<DataPoint[]>([]);
  const lastOpenPriceRef = useRef<number | null>(null);
  const lastPointIndexRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  
  const [data, setData] = useState<DataPoint[]>([]);

  // Seeded random for reproducible history generation
  const seededRandom = useCallback((seed: number) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  }, []);

  // Generate full historical path from openPrice to targetPrice with natural randomness
  const generateHistoricalPath = useCallback((
    startPrice: number, 
    endPrice: number, 
    pointCount: number,
    seed: number
  ): number[] => {
    const prices: number[] = [startPrice];
    
    for (let i = 1; i < pointCount; i++) {
      const progress = i / pointCount;
      // Base trend towards target
      const trendValue = startPrice + (endPrice - startPrice) * progress;
      // Add wave-like variation that diminishes towards the end
      const waveAmplitude = Math.abs(endPrice - startPrice) * 0.15 * (1 - progress * 0.5);
      const wave = Math.sin(i * 0.8 + seed) * waveAmplitude;
      // Add small random noise
      const noise = (seededRandom(seed + i * 7) - 0.5) * Math.abs(endPrice - startPrice) * 0.08;
      
      prices.push(trendValue + wave + noise);
    }
    
    prices.push(endPrice);
    return prices;
  }, [seededRandom]);

  useEffect(() => {
    // If openPrice changed (new round started), reset all historical data
    if (lastOpenPriceRef.current !== openPrice) {
      historicalDataRef.current = [];
      lastOpenPriceRef.current = openPrice;
      lastPointIndexRef.current = 0;
      isInitializedRef.current = false;
    }

    const timeElapsed = Math.max(0, TOTAL_DURATION - timeLeft);
    const progressPercent = Math.min(1, Math.max(0.02, timeElapsed / TOTAL_DURATION));
    const currentPointIndex = Math.floor(POINTS_COUNT * progressPercent);
    
    const historical = historicalDataRef.current;
    const newData: DataPoint[] = [];

    // Detect if we received fresh data after page refresh:
    // If currentPointIndex jumped significantly (more than 3 points) from last known index,
    // and we don't have historical data to match, regenerate full history
    const needsHistoryRegeneration = 
      currentPointIndex > 3 && 
      (currentPointIndex - lastPointIndexRef.current > 3 || !isInitializedRef.current) &&
      historical.filter(p => p?.value !== null).length < currentPointIndex - 2;

    if (needsHistoryRegeneration) {
      // Clear and regenerate full historical path
      historicalDataRef.current = [];
      const seed = Math.floor(openPrice) % 1000;
      const historicalPrices = generateHistoricalPath(openPrice, currentPrice, currentPointIndex, seed);
      
      for (let i = 0; i < historicalPrices.length; i++) {
        historicalDataRef.current[i] = { time: i, value: historicalPrices[i] };
      }
      isInitializedRef.current = true;
    }
    
    // Update last known point index
    lastPointIndexRef.current = currentPointIndex;
    
    // Refresh reference after potential regeneration
    const updatedHistorical = historicalDataRef.current;

    for (let i = 0; i <= POINTS_COUNT; i++) {
      if (i > currentPointIndex) {
        // Future points: null (chart doesn't reach here yet)
        newData.push({ time: i, value: null });
      } else if (i === 0) {
        // First point: always openPrice
        if (!updatedHistorical[0]) {
          updatedHistorical[0] = { time: 0, value: openPrice };
        }
        newData.push({ ...updatedHistorical[0] });
      } else if (i === currentPointIndex) {
        // Current "head" point: update to actual currentPrice (this is the "live" candle)
        newData.push({ time: i, value: currentPrice });
      } else if (updatedHistorical[i]) {
        // Historical point already exists: keep it unchanged (append-only!)
        newData.push({ ...updatedHistorical[i] });
      } else {
        // New historical point: generate based on previous value with some randomness
        const prevValue = updatedHistorical[i - 1]?.value ?? openPrice;
        const stepsToTarget = currentPointIndex - i;
        const diff = currentPrice - prevValue;
        const stepSize = diff / stepsToTarget;
        const noise = stepSize * (seededRandom(openPrice + i * 13) - 0.5) * 0.6;
        const generatedValue = prevValue + stepSize + noise;
        
        updatedHistorical[i] = { time: i, value: generatedValue };
        newData.push({ ...updatedHistorical[i] });
      }
    }
    
    // Store historical data for future updates
    historicalDataRef.current = updatedHistorical;
    setData(newData);
  }, [openPrice, currentPrice, timeLeft, generateHistoricalPath, seededRandom]);
  
  // Calculate Y-axis domain: openPrice is ALWAYS at vertical center
  const yDomain = (() => {
    const validValues = data.filter(d => d.value !== null).map(d => d.value as number);
    if (validValues.length === 0) return [openPrice - 100, openPrice + 100];
    
    const dataMax = Math.max(...validValues);
    const dataMin = Math.min(...validValues);
    
    // Find max deviation from openPrice (either direction)
    const deviationUp = dataMax - openPrice;
    const deviationDown = openPrice - dataMin;
    const maxDeviation = Math.max(deviationUp, deviationDown, 50); // minimum 50 for visibility
    
    // Add 20% padding
    const paddedDeviation = maxDeviation * 1.2;
    
    // Symmetric domain around openPrice
    return [openPrice - paddedDeviation, openPrice + paddedDeviation];
  })();

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
            strokeDasharray="6 4" 
            strokeOpacity={0.18} 
            strokeWidth={1}
          />

          {/* Above openPrice: GREEN line + fill to openPrice */}
          <Area
            type="monotone"
            dataKey="above"
            stroke="#FF5722"
            strokeOpacity={0.9}
            strokeWidth={2}
            fill="#FF5722"
            fillOpacity={0.18}
            baseValue={openPrice}
            isAnimationActive={false}
            dot={<CustomizedDot data={splitSeries} color="#FF5722" dataKey="above" isActiveSeries={isUp} />}
            connectNulls={false}
          />

          {/* Below openPrice: RED line + fill to openPrice */}
          <Area
            type="monotone"
            dataKey="below"
            stroke="#FF4D4D"
            strokeOpacity={0.9}
            strokeWidth={2}
            fill="#FF4D4D"
            fillOpacity={0.18}
            baseValue={openPrice}
            isAnimationActive={false}
            dot={<CustomizedDot data={splitSeries} color="#FF4D4D" dataKey="below" isActiveSeries={!isUp} />}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
