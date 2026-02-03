'use client';

/**
 * Arena 区域骨架屏
 * 在 BattleArena 组件加载时显示
 */
export default function ArenaSkeleton() {
  return (
    <div className="w-full h-full flex flex-col gap-4 animate-pulse">
      {/* 顶部信息栏骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg" />
          <div className="w-32 h-6 bg-white/5 rounded" />
        </div>
        <div className="w-24 h-8 bg-white/5 rounded-full" />
      </div>

      {/* 主要内容区 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧 - Long Bets */}
        <div className="flex-1 fintech-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-green-500/20 rounded" />
            <div className="w-16 h-5 bg-white/5 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-full" />
                <div className="flex-1">
                  <div className="w-24 h-4 bg-white/5 rounded mb-1" />
                  <div className="w-16 h-3 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 中间 - 价格图表 */}
        <div className="w-80 fintech-card rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="w-24 h-8 bg-white/5 rounded" />
            <div className="w-16 h-6 bg-white/5 rounded" />
          </div>
          <div className="flex-1 bg-white/5 rounded-lg" />
          <div className="mt-4 flex justify-center">
            <div className="w-32 h-12 bg-white/5 rounded-lg" />
          </div>
        </div>

        {/* 右侧 - Short Bets */}
        <div className="flex-1 fintech-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-red-500/20 rounded" />
            <div className="w-16 h-5 bg-white/5 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-full" />
                <div className="flex-1">
                  <div className="w-24 h-4 bg-white/5 rounded mb-1" />
                  <div className="w-16 h-3 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部历史记录骨架 */}
      <div className="h-16 fintech-card rounded-xl flex items-center justify-center gap-2 px-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="w-8 h-8 bg-white/5 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
