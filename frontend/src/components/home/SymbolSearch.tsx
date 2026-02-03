'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Star, Sparkles, Loader2 } from 'lucide-react';
import api from '@/lib/api';

// Symbol data structure
interface Symbol {
  id: string;
  name: string;
  fullName: string;
  category: string;
  icon: string;
  available: boolean;
  popular?: boolean;
}

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Sparkles },
  { id: 'crypto', name: 'Crypto', icon: TrendingUp },
  { id: 'commodities', name: 'Commodities', icon: Star },
  { id: 'forex', name: 'Forex', icon: TrendingUp },
  { id: 'stocks', name: 'Stocks', icon: TrendingUp },
];

interface SymbolSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: string) => void;
  currentSymbol: string;
}

export default function SymbolSearch({ isOpen, onClose, onSelect, currentSymbol }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch symbols from API
  const fetchSymbols = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getSymbols();
      if (response.success && response.data) {
        const transformed = response.data.items.map(s => ({
          id: s.symbol.replace('USDT', '/USDT').replace('USD', '/USD'),
          name: s.symbol.replace('USDT', '/USDT').replace('USD', '/USD'),
          fullName: s.display_name,
          category: s.category,
          icon: s.emoji || '●',
          available: s.enabled && (s.has_active_round || false),
          popular: s.category === 'crypto',
        }));
        setSymbols(transformed);
      }
    } catch (err) {
      console.error('Failed to fetch symbols:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch symbols when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSymbols();
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedCategory('all');
    }
  }, [isOpen, fetchSymbols]);

  // Filter symbols based on query and category
  const filteredSymbols = useMemo(() => {
    let results = symbols;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      results = results.filter(s => s.category === selectedCategory);
    }
    
    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.fullName.toLowerCase().includes(q)
      );
    }
    
    // Sort: available first, then popular, then alphabetical
    return results.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [query, selectedCategory, symbols]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSymbols]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredSymbols.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          const selected = filteredSymbols[selectedIndex];
          if (selected?.available) {
            onSelect(selected.id);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredSymbols, selectedIndex, onSelect, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Search Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 flex items-start justify-center pt-[12vh] z-50 pointer-events-none"
          >
            <div className="w-full max-w-xl mx-4 pointer-events-auto">
            <div className="bg-[#0C0C0E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              
              {/* Search Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <Search size={20} className="text-zinc-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markets..."
                  className="flex-1 bg-transparent text-white text-lg placeholder:text-zinc-600 outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="p-1 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
                <div className="flex items-center gap-1 text-xs text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">
                  <span>ESC</span>
                </div>
              </div>

              {/* Categories */}
              <div className="flex gap-1 px-4 py-3 border-b border-white/5 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                      ${selectedCategory === cat.id 
                        ? 'bg-white/10 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                      }`}
                  >
                    <cat.icon size={12} />
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Results */}
              <div className="max-h-[360px] overflow-y-auto py-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                  </div>
                ) : filteredSymbols.length === 0 ? (
                  <div className="px-5 py-8 text-center text-zinc-500">
                    <p className="text-sm">No markets found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  filteredSymbols.map((symbol, index) => (
                    <button
                      key={symbol.id}
                      onClick={() => {
                        if (symbol.available) {
                          onSelect(symbol.id);
                          onClose();
                        }
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      disabled={!symbol.available}
                      className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors
                        ${index === selectedIndex ? 'bg-white/5' : ''}
                        ${symbol.available 
                          ? 'hover:bg-white/5 cursor-pointer' 
                          : 'opacity-50 cursor-not-allowed'
                        }
                        ${symbol.id === currentSymbol ? 'bg-white/5' : ''}
                      `}
                    >
                      {/* Icon */}
                      <span className="text-xl">{symbol.icon}</span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{symbol.name}</span>
                          {symbol.available && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF5722]/10 text-[#FF5722] font-medium">
                              LIVE
                            </span>
                          )}
                          {!symbol.available && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 font-medium">
                              SOON
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{symbol.fullName}</p>
                      </div>

                      {/* Category Badge */}
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        {symbol.category}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer Hint */}
              <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">↵</kbd>
                    Select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">K</kbd>
                  Open Search
                </span>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
