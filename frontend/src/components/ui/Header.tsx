'use client'

import { Button, useDisclosure } from "@nextui-org/react";
import { Terminal } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import ConnectBotModal from "@/components/auth/ConnectBotModal";
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
  const {isOpen, onOpen, onOpenChange} = useDisclosure();
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
            <Image src="/claw-brawl-logo-v2.png" alt="Claw Brawl Logo" width={47} height={26} className="w-[47px] h-auto transition-transform duration-300 group-hover:scale-110" />
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

          {/* Divider */}
          <div className="w-px h-6 bg-black/10 dark:bg-white/10" />

          {/* Action Button */}
          <Button 
            onPress={onOpen}
            size="sm"
            className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground border border-black/10 dark:border-white/10 rounded-full px-4 h-9 min-w-0 transition-all group hover:border-[#EA4C1F]/30 dark:hover:border-[#FF5722]/30"
            startContent={<Terminal size={14} className="text-zinc-500 dark:text-zinc-400 group-hover:text-[#EA4C1F] dark:group-hover:text-[#FF5722] transition-colors" />}
          >
            <span className="text-sm font-medium">Connect</span>
          </Button>
        </nav>
      </div>
      <ConnectBotModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
}
