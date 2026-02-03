'use client';

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState, memo } from "react";

const FluidBackgroundInner = memo(function FluidBackgroundInner() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 在 mounted 之前不渲染任何内容，避免 hydration 闪烁
  if (!mounted) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: '#030303' }} />
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <div 
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      style={{
        // 隔离渲染层，防止背景动画影响其他元素
        contain: 'strict',
        isolation: 'isolate',
      }}
    >
      {/* Base Background */}
      <div 
        className="absolute inset-0"
        style={{ 
          background: isDark ? '#030303' : '#f8fafc',
          // 避免使用 transition，减少不必要的重绘
        }}
      />

      {/* Orb 1: Golden - Top Left */}
      <motion.div
        animate={{
          x: [0, 80, -50, 0],
          y: [0, 50, 80, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute rounded-full"
        style={{
          width: '70vw',
          height: '70vw',
          top: '-30%',
          left: '-20%',
          background: isDark 
            ? 'radial-gradient(circle, rgba(255, 184, 0, 0.15) 0%, rgba(255, 184, 0, 0) 70%)'
            : 'radial-gradient(circle, rgba(217, 160, 0, 0.15) 0%, rgba(217, 160, 0, 0) 70%)',
          filter: 'blur(80px)',
          // GPU 加速提示
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Orb 2: Orange-Red - Bottom Right */}
      <motion.div
        animate={{
          x: [0, -60, 40, 0],
          y: [0, -80, 50, 0],
          scale: [1, 0.85, 1.15, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute rounded-full"
        style={{
          width: '60vw',
          height: '60vw',
          bottom: '-20%',
          right: '-15%',
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 87, 34, 0.12) 0%, rgba(255, 87, 34, 0) 70%)'
            : 'radial-gradient(circle, rgba(234, 76, 31, 0.12) 0%, rgba(234, 76, 31, 0) 70%)',
          filter: 'blur(90px)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Orb 3: Deep Orange - Center Left */}
      <motion.div
        animate={{
          x: [0, 100, -60, 0],
          y: [0, -50, 70, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute rounded-full"
        style={{
          width: '50vw',
          height: '50vw',
          bottom: '0%',
          left: '10%',
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 120, 50, 0.1) 0%, rgba(255, 120, 50, 0) 70%)'
            : 'radial-gradient(circle, rgba(234, 76, 31, 0.1) 0%, rgba(234, 76, 31, 0) 70%)',
          filter: 'blur(100px)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Noise Texture - 使用静态 opacity 避免重绘 */}
      <svg 
        className="absolute inset-0 w-full h-full" 
        style={{ 
          opacity: isDark ? 0.04 : 0.02,
          pointerEvents: 'none',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Vignette - 移除 transition 避免重绘 */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 20%, rgba(0,0,0,0.6) 100%)'
            : 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.08) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

// 使用 memo 包装导出，防止父组件更新时重渲染
export const FluidBackground = memo(function FluidBackground() {
  return <FluidBackgroundInner />;
});
