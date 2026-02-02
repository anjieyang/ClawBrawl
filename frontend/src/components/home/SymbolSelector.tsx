'use client'

export default function SymbolSelector() {
  return (
    <div className="flex items-center gap-3">
      {/* Active Symbol - Minimalist Tag */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
        <div className="w-4 h-4 rounded-full bg-[#F7931A] flex items-center justify-center text-[8px] font-bold text-white">₿</div>
        <span className="font-bold text-white text-xs tracking-wide">BTC/USDT</span>
      </div>
    </div>
  );
}
