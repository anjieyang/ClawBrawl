'use client';

import { motion } from "framer-motion";

export const FluidBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base Black */}
      <div className="absolute inset-0 bg-[#030303]" />

      {/* Orb 1: Cyan - Top Left - REDUCED OPACITY */}
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
          // Opacity reduced from 0.3 to 0.15
          background: 'radial-gradient(circle, rgba(0, 220, 255, 0.15) 0%, rgba(0, 220, 255, 0) 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Orb 2: Purple/Indigo - Bottom Right - REDUCED OPACITY */}
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
          // Opacity reduced from 0.25 to 0.12
          background: 'radial-gradient(circle, rgba(130, 80, 255, 0.12) 0%, rgba(130, 80, 255, 0) 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Orb 3: Green/Teal - Center Left - REDUCED OPACITY */}
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
          // Opacity reduced from 0.2 to 0.1
          background: 'radial-gradient(circle, rgba(32, 230, 150, 0.1) 0%, rgba(32, 230, 150, 0) 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Noise Texture - Slightly stronger to diffuse light better */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* Vignette - Stronger to focus attention */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 20%, rgba(0,0,0,0.6) 100%)',
        }}
      />
    </div>
  );
};
