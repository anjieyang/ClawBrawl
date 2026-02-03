'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from "@/components/ui/Header";
import HeroSection from "@/components/home/HeroSection";
import { FluidBackground } from "@/components/ui/FluidBackground";
import ArenaSkeleton from "@/components/skeletons/ArenaSkeleton";
import LeaderboardSkeleton from "@/components/skeletons/LeaderboardSkeleton";

// 动态导入重型组件 - 减少初始 bundle 大小
const ArenaContainer = dynamic(
  () => import('@/components/home/ArenaContainer'),
  {
    loading: () => <ArenaSkeleton />,
    ssr: false, // Arena 依赖客户端 API，无需 SSR
  }
);

const LeaderboardSection = dynamic(
  () => import('@/components/home/LeaderboardSection'),
  {
    loading: () => <LeaderboardSkeleton />,
    ssr: false,
  }
);

type Section = 'hero' | 'arena' | 'leaderboard';

/**
 * 首页客户端组件
 * 处理滚动、导航和动态加载
 */
export default function HomeClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<Section>('hero');
  const [shouldLoadArena, setShouldLoadArena] = useState(false);
  const [shouldLoadLeaderboard, setShouldLoadLeaderboard] = useState(false);

  // 预加载策略：Hero 渲染后立即开始预加载其他组件
  // 这样当用户滚动时，内容已经准备好了
  useEffect(() => {
    // 使用 requestIdleCallback 在浏览器空闲时预加载
    const preloadComponents = () => {
      // 第一阶段：立即预加载 Arena（最重要）
      setShouldLoadArena(true);
      
      // 第二阶段：延迟预加载 Leaderboard
      setTimeout(() => {
        setShouldLoadLeaderboard(true);
      }, 1000); // Arena 加载 1 秒后开始加载 Leaderboard
    };

    if ('requestIdleCallback' in window) {
      // 在浏览器空闲时预加载，不影响首屏渲染
      const idleId = requestIdleCallback(preloadComponents, { timeout: 2000 });
      return () => cancelIdleCallback(idleId);
    } else {
      // Fallback: 500ms 后开始预加载
      const timeoutId = setTimeout(preloadComponents, 500);
      return () => clearTimeout(timeoutId);
    }
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

          {/* Arena Section - 预加载 */}
          <section 
            id="section-arena"
            className="h-screen w-full snap-start snap-always flex flex-col relative"
          >
            <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24 max-w-[1400px] flex flex-col min-h-0">
              {shouldLoadArena ? (
                <ArenaContainer
                  symbol="BTCUSDT"
                  onScrollToLeaderboard={() => scrollToSection('leaderboard')}
                />
              ) : (
                <ArenaSkeleton />
              )}
            </div>
          </section>

          {/* Leaderboard Section - 预加载 */}
          <section 
            id="section-leaderboard"
            className="min-h-screen w-full snap-start snap-always"
          >
            {shouldLoadLeaderboard ? (
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
