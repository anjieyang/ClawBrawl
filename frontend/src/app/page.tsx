'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Header from "@/components/ui/Header";
import HeroSection from "@/components/home/HeroSection";
import ArenaContainer from "@/components/home/ArenaContainer";
import LeaderboardSection from "@/components/home/LeaderboardSection";
import { FluidBackground } from "@/components/ui/FluidBackground";

type Section = 'hero' | 'arena' | 'leaderboard';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<Section>('hero');

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

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Navigation context to pass to Header
  const navigationContext = {
    activeSection,
    scrollToSection
  };

  return (
    <>
      {/* Dynamic Fluid Background */}
      <FluidBackground />
      
      {/* Main App Content */}
      <main className="h-screen w-full text-foreground relative z-10">
        {/* Floating Header - hide on hero section */}
        <div className={`transition-all duration-500 ${activeSection === 'hero' ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'}`}>
          <Header navigationContext={navigationContext} />
        </div>

        {/* Snap Scroll Container */}
        <div 
          ref={containerRef}
          className="h-screen overflow-y-auto snap-y snap-mandatory"
          style={{ scrollBehavior: 'smooth' }}
        >
          {/* Hero Section */}
          <section 
            id="section-hero"
            className="h-screen w-full snap-start snap-always"
          >
            <HeroSection onScrollToArena={() => scrollToSection('arena')} />
          </section>

          {/* Arena Section */}
          <section 
            id="section-arena"
            className="h-screen w-full snap-start snap-always flex flex-col relative"
          >
            <div className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-24 max-w-[1400px] flex flex-col min-h-0">
              <ArenaContainer symbol="BTCUSDT" onScrollToLeaderboard={() => scrollToSection('leaderboard')} />
            </div>
          </section>

          {/* Leaderboard Section */}
          <section 
            id="section-leaderboard"
            className="min-h-screen w-full snap-start snap-always"
          >
            <LeaderboardSection />
          </section>
        </div>
      </main>
    </>
  );
}
