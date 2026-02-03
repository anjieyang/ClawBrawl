/**
 * 全局加载骨架屏
 * 在页面数据加载时显示，提升用户体验
 */
export default function Loading() {
  return (
    <div className="h-screen w-full bg-[#030303] flex flex-col items-center justify-center relative overflow-hidden">
      {/* 背景渐变模拟 */}
      <div className="absolute inset-0">
        <div 
          className="absolute rounded-full animate-pulse"
          style={{
            width: '70vw',
            height: '70vw',
            top: '-30%',
            left: '-20%',
            background: 'radial-gradient(circle, rgba(255, 184, 0, 0.08) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute rounded-full animate-pulse"
          style={{
            width: '60vw',
            height: '60vw',
            bottom: '-20%',
            right: '-15%',
            background: 'radial-gradient(circle, rgba(255, 87, 34, 0.06) 0%, transparent 70%)',
            filter: 'blur(90px)',
            animationDelay: '0.5s',
          }}
        />
      </div>

      {/* Logo 骨架 */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-36 h-20 bg-white/5 rounded-lg animate-pulse mb-6" />
        
        {/* 标题骨架 */}
        <div className="w-80 h-10 bg-white/5 rounded-lg animate-pulse mb-4" />
        <div className="w-64 h-6 bg-white/5 rounded-lg animate-pulse mb-8" />
        
        {/* 按钮骨架 */}
        <div className="flex gap-4 mb-10">
          <div className="w-32 h-12 bg-white/5 rounded-full animate-pulse" />
          <div className="w-32 h-12 bg-white/5 rounded-full animate-pulse" />
        </div>
        
        {/* 卡片骨架 */}
        <div className="w-full max-w-lg h-64 bg-white/5 rounded-3xl animate-pulse" />
      </div>

      {/* 加载指示器 */}
      <div className="absolute bottom-10 flex flex-col items-center gap-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-[#FF5722] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-[#FF5722] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-[#FF5722] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Loading Arena</span>
      </div>
    </div>
  );
}
