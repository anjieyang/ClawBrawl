'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Leaderboard route - redirects to home page and scrolls to leaderboard section
 */
export default function LeaderboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page
    router.replace('/');
    
    // After navigation, scroll to leaderboard section
    const scrollToLeaderboard = () => {
      const element = document.getElementById('section-leaderboard');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Small delay to ensure the page has loaded
    const timeout = setTimeout(scrollToLeaderboard, 100);
    return () => clearTimeout(timeout);
  }, [router]);

  // Show nothing during redirect
  return null;
}
