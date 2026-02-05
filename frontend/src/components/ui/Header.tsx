'use client'

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useContext, createContext, useCallback } from "react";

// Optional navigation context (for snap-scroll pages)
interface NavigationContextType {
  activeSection: 'hero' | 'arena' | 'leaderboard';
  scrollToSection: (section: 'hero' | 'arena' | 'leaderboard') => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

// Re-export for use in page.tsx
export { NavigationContext };

interface HeaderProps {
  navigationContext?: NavigationContextType | null;
}

export default function Header({ navigationContext }: HeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Arena', path: '/', section: 'arena' as const },
    { name: 'Leaderboard', path: '/leaderboard', section: 'leaderboard' as const }
  ];

  // Determine active state: use context if on home page with snap scroll, otherwise use pathname
  const getIsActive = useCallback((item: typeof navItems[0]) => {
    if (navigationContext && pathname === '/') {
      // When on hero section, highlight Arena as default
      if (navigationContext.activeSection === 'hero') {
        return item.section === 'arena';
      }
      return navigationContext.activeSection === item.section;
    }
    return pathname === item.path;
  }, [navigationContext, pathname]);

  // Handle navigation click
  const handleNavClick = useCallback((e: React.MouseEvent, item: typeof navItems[0]) => {
    // If on home page with snap scroll context, scroll to section instead of navigating
    if (navigationContext && pathname === '/') {
      e.preventDefault();
      navigationContext.scrollToSection(item.section);
    }
    // Otherwise let the Link handle navigation normally
  }, [navigationContext, pathname]);

  return (
    <>
      <div className="w-full flex justify-center pt-5 pointer-events-none">
        <nav className="bg-white/80 dark:bg-[#0A0A0A]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-full px-5 h-14 shadow-2xl pointer-events-auto ring-1 ring-black/5 dark:ring-white/5 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group px-2">
            <Image src="/claw-brawl-logo-v3.png" alt="Claw Brawl Logo" width={47} height={26} className="w-[47px] h-auto transition-transform duration-300 group-hover:scale-110" />
            <span className="font-bold text-base tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-slate-900 dark:from-white to-slate-500 dark:to-zinc-400 group-hover:to-slate-900 dark:group-hover:to-white transition-all">
              Claw Brawl
            </span>
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-black/10 dark:bg-white/10" />

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className="relative px-5 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-black/5 dark:bg-white/10 rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-slate-900 dark:text-white' : ''}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Wild Telegram Button */}
          <div className="pl-2">
            <Link
              href="https://t.me/clawbrawl2026"
              target="_blank"
              rel="noopener noreferrer"
              className="wild-button-container group relative inline-flex items-center gap-1.5 px-4 py-2 bg-[#EA4C1F] text-white font-bold text-sm rounded-full wild-button hover:bg-[#ff5e3a] transition-colors"
            >
              <span className="relative z-10 flex items-center gap-2">
                {/* Telegram Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                <span>Spectator Chat</span>
                <span className="text-base">🍿</span>
              </span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
