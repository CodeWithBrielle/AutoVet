import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiChevronDown, FiX } from 'react-icons/fi';
import clsx from 'clsx';

/**
 * SearchableSelect Component
 * 
 * A high-performance, accessible search-ahead component with list fallback.
 * Designed for Phase 3 usability outcomes to handle large datasets (Owners/Pets).
 * 
 * @param {Array} options - List of { value, label, sublabel } objects
 * @param {Function} onChange - Callback when value changes
 * @param {string} value - Selected value
 * @param {string} placeholder - Input placeholder
 * @param {string} error - Error message
 * @param {boolean} disabled - Disabled state
 * @param {string} className - Additional classes
 */
const SearchableSelect = ({ 
  options = [], 
  onChange, 
  value, 
  placeholder = "Search...", 
  error,
  disabled = false,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
    setSearch("");
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div className={clsx("relative w-full", className)} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={clsx(
          "flex min-h-[42px] items-center justify-between rounded-lg border px-3 py-2 transition-all cursor-pointer",
          "bg-white dark:bg-dark-surface/50",
          isOpen ? "border-primary ring-2 ring-primary/10" : "border-slate-200 dark:border-zinc-700",
          error ? "border-red-500 bg-red-50/10" : "hover:border-slate-300 dark:hover:border-zinc-600",
          disabled && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-dark-surface/20"
        )}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-slate-500 dark:text-zinc-400">{selectedOption.sublabel}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 pl-2">
          {value && !disabled && (
            <button 
              onClick={clearSelection}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
          <FiChevronDown className={clsx("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-dark-surface animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center border-b border-slate-100 p-2 dark:border-zinc-800">
            <FiSearch className="ml-2 h-4 w-4 text-slate-400" />
            <input 
              ref={inputRef}
              autoFocus
              className="w-full bg-transparent p-2 text-sm outline-none placeholder:text-slate-400 dark:text-zinc-100"
              placeholder="Type to filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={clsx(
                    "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors",
                    value === opt.value 
                      ? "bg-primary/10 text-primary-600 dark:bg-primary/20 dark:text-primary-400" 
                      : "hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="text-xs text-slate-500 dark:text-zinc-400">{opt.sublabel}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="py-4 text-center text-sm text-slate-500 dark:text-zinc-400">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      )}
    </div>
  );
};

export default SearchableSelect;
