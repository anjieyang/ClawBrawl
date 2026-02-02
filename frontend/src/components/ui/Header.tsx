'use client'

import { Button, useDisclosure } from "@nextui-org/react";
import { Terminal } from "lucide-react";
import Link from "next/link";
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

// SVG Lobster Component
const BoxingLobster = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Legs */}
    <path d="M35 70C30 75 25 72 25 72" stroke="#FF4D4D" strokeWidth="3" strokeLinecap="round"/>
    <path d="M65 70C70 75 75 72 75 72" stroke="#FF4D4D" strokeWidth="3" strokeLinecap="round"/>
    <path d="M32 65C27 70 22 67 22 67" stroke="#FF4D4D" strokeWidth="3" strokeLinecap="round"/>
    <path d="M68 65C73 70 78 67 78 67" stroke="#FF4D4D" strokeWidth="3" strokeLinecap="round"/>

    {/* Body */}
    <path d="M50 85C65 85 72 70 68 50C64 30 55 20 50 20C45 20 36 30 32 50C28 70 35 85 50 85Z" fill="#FF4D4D" stroke="currentColor" strokeWidth="2"/>
    
    {/* Belly Segments */}
    <path d="M38 55C38 55 42 58 50 58C58 58 62 55 62 55" stroke="#991F1F" strokeWidth="2" strokeLinecap="round" className="opacity-40"/>
    <path d="M36 65C36 65 42 68 50 68C58 68 64 65 64 65" stroke="#991F1F" strokeWidth="2" strokeLinecap="round" className="opacity-40"/>
    <path d="M38 75C38 75 42 78 50 78C58 78 62 75 62 75" stroke="#991F1F" strokeWidth="2" strokeLinecap="round" className="opacity-40"/>

    {/* Tail */}
    <path d="M42 85L40 92C40 92 45 95 50 95C55 95 60 92 60 92L58 85" fill="#FF4D4D" stroke="currentColor" strokeWidth="2"/>

    {/* Left Arm & Claw */}
    <path d="M35 45C25 45 15 40 15 30" stroke="#FF4D4D" strokeWidth="6" strokeLinecap="round"/>
    {/* Left Wrist (Blue) */}
    <rect x="8" y="24" width="14" height="10" rx="3" fill="#00E5FF" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 29L22 29" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3"/>
    {/* Left Claw */}
    <path d="M5 25C-5 10 10 -5 20 10C20 10 25 15 15 25Z" fill="#FF4D4D" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 25C10 25 15 20 15 25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>

    {/* Right Arm & Claw */}
    <path d="M65 45C75 45 85 40 85 30" stroke="#FF4D4D" strokeWidth="6" strokeLinecap="round"/>
    {/* Right Wrist (Blue) */}
    <rect x="78" y="24" width="14" height="10" rx="3" fill="#00E5FF" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M78 29L92 29" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3"/>
    {/* Right Claw */}
    <path d="M95 25C105 10 90 -5 80 10C80 10 75 15 85 25Z" fill="#FF4D4D" stroke="currentColor" strokeWidth="2"/>
    <path d="M95 25C90 25 85 20 85 25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>

    {/* Head & Face */}
    <path d="M45 20C45 20 42 5 35 5" stroke="#FF4D4D" strokeWidth="2" strokeLinecap="round"/>
    <path d="M55 20C55 20 58 5 65 5" stroke="#FF4D4D" strokeWidth="2" strokeLinecap="round"/>
    
    {/* Eyes (Angry) */}
    <circle cx="42" cy="35" r="5" fill="white" stroke="currentColor" strokeWidth="1"/>
    <circle cx="43" cy="35" r="2" fill="black"/>
    <path d="M37 28L47 31" stroke="black" strokeWidth="2" strokeLinecap="round"/>
    
    <circle cx="58" cy="35" r="5" fill="white" stroke="currentColor" strokeWidth="1"/>
    <circle cx="57" cy="35" r="2" fill="black"/>
    <path d="M63 28L53 31" stroke="black" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

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
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 pointer-events-none">
        <nav className="bg-[#0A0A0A]/70 backdrop-blur-2xl border border-white/5 rounded-full px-5 h-14 shadow-2xl pointer-events-auto ring-1 ring-white/5 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group px-2">
            <BoxingLobster className="w-[26px] h-[26px] transition-transform duration-300 group-hover:scale-110" />
            <span className="font-bold text-base tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 group-hover:to-white transition-all">
              Claw Brawl
            </span>
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10" />

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <Link 
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className="relative px-5 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white/10 rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10" />

          {/* Action Button */}
          <Button 
            onPress={onOpen}
            size="sm"
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full px-4 h-9 min-w-0 transition-all group hover:border-[#20E696]/30"
            startContent={<Terminal size={14} className="text-zinc-400 group-hover:text-[#20E696] transition-colors" />}
          >
            <span className="text-sm font-medium">Connect</span>
          </Button>
        </nav>
      </div>
      <ConnectBotModal isOpen={isOpen} onOpenChange={onOpenChange} />
    </>
  );
}
