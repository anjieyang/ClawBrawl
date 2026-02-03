'use client';

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const FluidBackground = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base Background */}
      <div 
        className="absolute inset-0 transition-colors duration-500"
        style={{ background: isDark ? '#030303' : '#f8fafc' }}
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
        className="absolute rounded-full transition-all duration-500"
        style={{
          width: '70vw',
          height: '70vw',
          top: '-30%',
          left: '-20%',
          background: isDark 
            ? 'radial-gradient(circle, rgba(255, 184, 0, 0.15) 0%, rgba(255, 184, 0, 0) 70%)'
            : 'radial-gradient(circle, rgba(217, 160, 0, 0.15) 0%, rgba(217, 160, 0, 0) 70%)',
          filter: 'blur(80px)',
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
        className="absolute rounded-full transition-all duration-500"
        style={{
          width: '60vw',
          height: '60vw',
          bottom: '-20%',
          right: '-15%',
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 87, 34, 0.12) 0%, rgba(255, 87, 34, 0) 70%)'
            : 'radial-gradient(circle, rgba(234, 76, 31, 0.12) 0%, rgba(234, 76, 31, 0) 70%)',
          filter: 'blur(90px)',
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
        className="absolute rounded-full transition-all duration-500"
        style={{
          width: '50vw',
          height: '50vw',
          bottom: '0%',
          left: '10%',
          background: isDark
            ? 'radial-gradient(circle, rgba(255, 120, 50, 0.1) 0%, rgba(255, 120, 50, 0) 70%)'
            : 'radial-gradient(circle, rgba(234, 76, 31, 0.1) 0%, rgba(234, 76, 31, 0) 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Noise Texture */}
      <svg 
        className="absolute inset-0 w-full h-full transition-opacity duration-500" 
        style={{ opacity: isDark ? 0.04 : 0.02 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Vignette */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 20%, rgba(0,0,0,0.6) 100%)'
            : 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.08) 100%)',
        }}
      />
    </div>
  );
};
