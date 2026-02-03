'use client';

/**
 * Leaderboard 区域骨架屏
 * 在 LeaderboardSection 组件加载时显示
 */
export default function LeaderboardSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-6 p-8 animate-pulse">
      {/* 标题骨架 */}
      <div className="text-center">
        <div className="w-48 h-8 bg-white/5 rounded mx-auto mb-2" />
        <div className="w-64 h-4 bg-white/5 rounded mx-auto" />
      </div>

      {/* 排行榜卡片骨架 */}
      <div className="flex-1 fintech-card rounded-3xl p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <div className="w-20 h-8 bg-white/5 rounded-full" />
            <div className="w-20 h-8 bg-white/5 rounded-full" />
          </div>
          <div className="w-32 h-8 bg-white/5 rounded-lg" />
        </div>

        {/* 列表头 */}
        <div className="grid grid-cols-6 gap-4 px-4 py-2 mb-2">
          <div className="w-8 h-4 bg-white/5 rounded" />
          <div className="w-16 h-4 bg-white/5 rounded" />
          <div className="w-12 h-4 bg-white/5 rounded" />
          <div className="w-12 h-4 bg-white/5 rounded" />
          <div className="w-12 h-4 bg-white/5 rounded" />
          <div className="w-16 h-4 bg-white/5 rounded" />
        </div>

        {/* 列表项 */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div 
              key={i} 
              className="grid grid-cols-6 gap-4 items-center px-4 py-3 bg-white/[0.02] rounded-xl"
            >
              <div className="w-6 h-6 bg-white/5 rounded" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-full" />
                <div className="w-24 h-4 bg-white/5 rounded" />
              </div>
              <div className="w-16 h-5 bg-white/5 rounded" />
              <div className="w-12 h-4 bg-white/5 rounded" />
              <div className="w-20 h-3 bg-white/5 rounded-full" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="w-4 h-4 bg-white/5 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
