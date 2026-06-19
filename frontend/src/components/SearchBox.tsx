import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, HelpCircle } from 'lucide-react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('blackhole_search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Keyboard shortcut listener: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close history list on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        historyRef.current &&
        !historyRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save query to search history
  const saveToHistory = (searchQuery: string) => {
    const cleaned = searchQuery.trim();
    if (!cleaned) return;
    
    setHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== cleaned.toLowerCase());
      const updated = [cleaned, ...filtered].slice(0, 5); // Store top 5 searches
      localStorage.setItem('blackhole_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query);
      if (query.trim()) {
        saveToHistory(query);
      }
    }, 450); // 450ms debounce delay

    return () => clearTimeout(handler);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleHistorySelect = (selected: string) => {
    setQuery(selected);
    onSearch(selected);
    setShowHistory(false);
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory([]);
    localStorage.removeItem('blackhole_search_history');
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-4 w-5 h-5 text-purple-400/70 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setShowHistory(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Semantic profiling query... (e.g. 'finance', 'invoices', 'receipt')"
          className="w-full bg-[#0b0a12]/80 border border-purple-950/40 rounded-2xl py-4 pl-12 pr-24 text-gray-200 placeholder-purple-400/40 focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/30 transition-all backdrop-blur-xl shadow-inner shadow-purple-950/20 text-base"
        />

        {/* Action Indicators */}
        <div className="absolute right-4 flex items-center gap-2">
          {isLoading && (
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          )}
          {query && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-purple-950/30 rounded-full text-purple-400 hover:text-purple-300 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-purple-950 text-[10px] font-mono text-purple-400 bg-purple-950/30 select-none">
            /
          </span>
        </div>
      </div>

      {/* Search History Suggestion Overlay */}
      {showHistory && history.length > 0 && (
        <div
          ref={historyRef}
          className="absolute z-20 w-full mt-2 bg-[#090810]/95 backdrop-blur-2xl border border-purple-950/50 rounded-2xl shadow-2xl p-4 overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-purple-950/30 pb-2 mb-2">
            <span className="text-xs font-semibold text-purple-400/80 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent Semantic Inquiries
            </span>
            <button
              onClick={clearHistory}
              className="text-[10px] text-pink-400 hover:text-pink-300 transition-colors hover:underline"
            >
              Clear History
            </button>
          </div>
          <div className="space-y-1">
            {history.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleHistorySelect(item)}
                className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-purple-950/30 hover:text-white transition-all flex items-center gap-2 font-mono"
              >
                <Clock className="w-3.5 h-3.5 text-purple-500/50" />
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Search Prompts Helper */}
      <div className="flex flex-wrap items-center gap-2 mt-2 px-2 text-xs">
        <span className="text-purple-400/50 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" /> Try:
        </span>
        {['Microeconomics', 'ledger', 'documents', 'archive', 'finance'].map(tag => (
          <button
            key={tag}
            onClick={() => setQuery(tag)}
            className="text-purple-400/70 hover:text-purple-300 hover:bg-purple-950/30 border border-purple-950/40 rounded-full px-2.5 py-0.5 transition-all text-[11px] font-medium cursor-pointer"
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
};
