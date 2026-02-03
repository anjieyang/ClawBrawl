import { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';
import Loading from './loading';

/**
 * 首页 - Server Component
 * 
 * 优化策略：
 * 1. page.tsx 作为 Server Component，快速返回 HTML shell
 * 2. HomeClient 作为客户端组件处理交互
 * 3. 重型组件 (ArenaContainer, LeaderboardSection) 使用 dynamic import 懒加载
 * 4. Suspense 边界提供加载状态
 */
export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeClient />
    </Suspense>
  );
}
