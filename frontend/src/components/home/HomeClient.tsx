'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from "@/components/ui/Header";
import HeroSection from "@/components/home/HeroSection";
import { FluidBackground } from "@/components/ui/FluidBackground";
import ArenaSkeleton from "@/components/skeletons/ArenaSkeleton";
import LeaderboardSkeleton from "@/components/skeletons/LeaderboardSkeleton";

// Dynamic imports with preload support
const ArenaContainerImport = () => import('@/components/home/ArenaContainer');
const LeaderboardSectionImport = () => import('@/components/home/LeaderboardSection');

const ArenaContainer = dynamic(ArenaContainerImport, {
  loading: () => <ArenaSkeleton />,
  ssr: false, // Arena 依赖客户端 API（WebSocket）
});

const LeaderboardSection = dynamic(LeaderboardSectionImport, {
  loading: () => <LeaderboardSkeleton />,
});

type Section = 'hero' | 'arena' | 'leaderboard';

/**
 * 首页客户端组件
 * 处理滚动、导航和动态加载
 */
export default function HomeClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<Section>('hero');
  // Mount all sections immediately - preload JS and start data fetching early
  const [componentsReady, setComponentsReady] = useState(false);

  // Aggressive preload: Start loading JS bundles immediately on mount
  useEffect(() => {
    // Preload JS bundles in parallel immediately
    Promise.all([
      ArenaContainerImport(),
      LeaderboardSectionImport(),
    ]).then(() => {
      // JS loaded, components can render
      setComponentsReady(true);
    });
    
    // Also set ready after a timeout in case preload is slow
    const fallbackTimer = setTimeout(() => {
      setComponentsReady(true);
    }, 100);
    
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Scroll to section function
  const scrollToSection = useCallback((section: Section) => {
    const element = document.getElementById(`section-${section}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Track scroll position to update active section
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;
      
      // Determine which section is mostly visible
      if (scrollTop < viewportHeight * 0.5) {
        setActiveSection('hero');
      } else if (scrollTop < viewportHeight * 1.5) {
        setActiveSection('arena');
      } else {
        setActiveSection('leaderboard');
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 点击 Enter Arena 时滚动
  const handleScrollToArena = useCallback(() => {
    scrollToSection('arena');
  }, [scrollToSection]);

  // Navigation context to pass to Header
  const navigationContext = {
    activeSection,
    scrollToSection
  };

  const sections: { id: Section; label: string }[] = [
    { id: 'hero', label: 'Home' },
    { id: 'arena', label: 'Arena' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <>
      {/* Dynamic Fluid Background */}
      <FluidBackground />

      {/* Floating Header - hide on hero section */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${activeSection === 'hero' ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'}`}>
        <Header navigationContext={navigationContext} />
      </div>

      {/* Page Indicator Dots - Right Side */}
      <div className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="group relative flex items-center"
            aria-label={`Go to ${section.label}`}
          >
            {/* Tooltip on hover */}
            <span className="absolute right-full mr-3 px-2 py-1 text-xs font-medium text-white bg-black/70 dark:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {section.label}
            </span>
            {/* Dot */}
            <span
              className={`block rounded-full transition-all duration-300 ${
                activeSection === section.id
                  ? 'w-3 h-3 bg-[#EA4C1F] shadow-[0_0_10px_rgba(234,76,31,0.5)]'
                  : 'w-2 h-2 bg-slate-400/50 dark:bg-white/30 hover:bg-slate-500 dark:hover:bg-white/50'
              }`}
            />
          </button>
        ))}
      </div>
      
      {/* Main App Content */}
      <main className="h-screen w-full text-foreground relative z-10">
        {/* Snap Scroll Container */}
        <div 
          ref={containerRef}
          className="h-screen overflow-y-auto snap-y snap-mandatory"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Hero Section - 优先加载 */}
          <section 
            id="section-hero"
            className="h-screen w-full snap-start snap-always"
          >
            <HeroSection onScrollToArena={handleScrollToArena} />
          </section>

          {/* Arena Section - Render immediately, data fetching starts early */}
          <section 
            id="section-arena"
            className="h-screen w-full snap-start snap-always flex flex-col relative"
          >
            <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24 max-w-[1400px] flex flex-col min-h-0">
              {componentsReady ? (
                <ArenaContainer
                  symbol="BTCUSDT"
                  onScrollToLeaderboard={() => scrollToSection('leaderboard')}
                />
              ) : (
                <ArenaSkeleton />
              )}
            </div>
          </section>

          {/* Leaderboard Section - Render immediately so data fetching starts early */}
          <section 
            id="section-leaderboard"
            className="min-h-screen w-full snap-start snap-always"
          >
            {componentsReady ? (
              <LeaderboardSection />
            ) : (
              <LeaderboardSkeleton />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
