'use client';

import { useEffect, useState, useRef } from 'react';

interface FlipDigitProps {
  digit: string;
  isUrgent?: boolean;
}

function FlipDigit({ digit, isUrgent = false }: FlipDigitProps) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [previousDigit, setPreviousDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setCurrentDigit(digit);
      setPreviousDigit(digit);
      return;
    }

    if (digit !== currentDigit) {
      setPreviousDigit(currentDigit);
      setIsFlipping(true);
      
      // After flip animation, update current digit
      const timer = setTimeout(() => {
        setCurrentDigit(digit);
        setIsFlipping(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [digit, currentDigit]);

  const baseColor = isUrgent ? 'bg-red-900/80' : 'bg-zinc-900/90';
  const textColor = isUrgent ? 'text-red-400' : 'text-white';
  const borderColor = isUrgent ? 'border-red-500/30' : 'border-white/10';
  const glowStyle = isUrgent ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' : '';

  return (
    <div className={`relative w-[44px] h-[64px] ${glowStyle}`} style={{ perspective: '200px' }}>
      {/* Static bottom half (shows current digit) */}
      <div 
        className={`absolute inset-0 ${baseColor} rounded-lg border ${borderColor} overflow-hidden`}
      >
        {/* Top half static */}
        <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
          <div className={`w-full h-[64px] flex items-center justify-center font-mono font-black text-4xl ${textColor}`}>
            {currentDigit}
          </div>
        </div>
        
        {/* Bottom half static */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden">
          <div className={`w-full h-[64px] flex items-center justify-center font-mono font-black text-4xl ${textColor} -translate-y-1/2`}>
            {currentDigit}
          </div>
        </div>
        
        {/* Middle line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/40" />
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Flipping card - top half flipping down */}
      {isFlipping && (
        <div 
          className="absolute inset-x-0 top-0 h-1/2 origin-bottom animate-flip-top"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
        >
          {/* Front face (previous digit top half) */}
          <div 
            className={`absolute inset-0 ${baseColor} rounded-t-lg border-t border-x ${borderColor} overflow-hidden`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className={`w-full h-[64px] flex items-center justify-center font-mono font-black text-4xl ${textColor}`}>
              {previousDigit}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          </div>
          
          {/* Back face (current digit top half) */}
          <div 
            className={`absolute inset-0 ${baseColor} rounded-t-lg border-t border-x ${borderColor} overflow-hidden`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
          >
            <div className={`w-full h-[64px] flex items-center justify-center font-mono font-black text-4xl ${textColor}`}>
              {currentDigit}
            </div>
          </div>
        </div>
      )}

      {/* Flipping card - bottom half flipping up (reveals new digit) */}
      {isFlipping && (
        <div 
          className="absolute inset-x-0 bottom-0 h-1/2 origin-top animate-flip-bottom"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
        >
          {/* Front face (previous digit bottom half - starts hidden) */}
          <div 
            className={`absolute inset-0 ${baseColor} rounded-b-lg border-b border-x ${borderColor} overflow-hidden`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
          >
            <div className={`w-full h-[64px] flex items-center justify-center font-mono font-black text-4xl ${textColor} -translate-y-1/2`}>
              {previousDigit}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FlipClockProps {
  minutes: number;
  seconds: number;
  isUrgent?: boolean;
  isWaiting?: boolean;
}

export default function FlipClock({ minutes, seconds, isUrgent = false, isWaiting = false }: FlipClockProps) {
  const min1 = Math.floor(minutes / 10).toString();
  const min2 = (minutes % 10).toString();
  const sec1 = Math.floor(seconds / 10).toString();
  const sec2 = (seconds % 10).toString();

  if (isWaiting) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-[44px] h-[64px] bg-zinc-900/90 rounded-lg border border-yellow-500/30 flex items-center justify-center animate-pulse">
            <span className="font-mono font-black text-4xl text-yellow-500">-</span>
          </div>
          <div className="w-[44px] h-[64px] bg-zinc-900/90 rounded-lg border border-yellow-500/30 flex items-center justify-center animate-pulse">
            <span className="font-mono font-black text-4xl text-yellow-500">-</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 py-3">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        </div>
        <div className="flex gap-1">
          <div className="w-[44px] h-[64px] bg-zinc-900/90 rounded-lg border border-yellow-500/30 flex items-center justify-center animate-pulse">
            <span className="font-mono font-black text-4xl text-yellow-500">-</span>
          </div>
          <div className="w-[44px] h-[64px] bg-zinc-900/90 rounded-lg border border-yellow-500/30 flex items-center justify-center animate-pulse">
            <span className="font-mono font-black text-4xl text-yellow-500">-</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'animate-urgent-text' : ''}`}>
      {/* Minutes */}
      <div className="flex gap-1">
        <FlipDigit digit={min1} isUrgent={isUrgent} />
        <FlipDigit digit={min2} isUrgent={isUrgent} />
      </div>
      
      {/* Colon separator */}
      <div className="flex flex-col gap-2 py-3">
        <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-white/60'}`} />
        <div className={`w-2 h-2 rounded-full ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-white/60'}`} />
      </div>
      
      {/* Seconds */}
      <div className="flex gap-1">
        <FlipDigit digit={sec1} isUrgent={isUrgent} />
        <FlipDigit digit={sec2} isUrgent={isUrgent} />
      </div>
    </div>
  );
}
