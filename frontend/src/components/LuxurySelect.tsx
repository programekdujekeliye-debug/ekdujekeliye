'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CheckIcon, SearchIcon } from './Icons';

export interface SelectOption {
  value: string | number;
  label: string;
  badge?: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface LuxurySelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  variant?: 'card' | 'outline' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

export const LuxurySelect: React.FC<LuxurySelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  label,
  searchable = false,
  disabled = false,
  className = '',
  dropdownClassName = '',
  variant = 'card',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.sublabel?.toLowerCase().includes(q) ||
      opt.badge?.toLowerCase().includes(q) ||
      String(opt.value).toLowerCase().includes(q)
    );
  });

  const handleSelect = (val: string | number) => {
    onChange(String(val));
    setIsOpen(false);
    setSearchQuery('');
  };

  // Variant styles for trigger button
  const getTriggerStyles = () => {
    switch (variant) {
      case 'card':
        return 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-900 shadow-2xs';
      case 'outline':
        return 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900 shadow-xs';
      case 'subtle':
        return 'bg-transparent hover:bg-slate-100/60 border-transparent text-slate-800';
      default:
        return 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'py-1 px-2.5 text-[11px] min-h-[30px] rounded-lg';
      case 'lg':
        return 'py-2 px-3.5 text-xs sm:text-sm min-h-[42px] rounded-xl';
      case 'md':
      default:
        return 'py-1.5 px-3 text-xs min-h-[36px] rounded-xl';
    }
  };

  return (
    <div className={`relative w-full min-w-0 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 truncate">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-w-0 border transition-all flex items-center justify-between gap-2 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 disabled:opacity-50 disabled:cursor-not-allowed ${getTriggerStyles()} ${getSizeStyles()} ${
          isOpen ? 'ring-2 ring-rose-500/20 border-rose-600 bg-white' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className={`truncate font-bold ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded-md shrink-0 uppercase tracking-tight">
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* Custom Animated Chevron Arrow */}
        <svg
          className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rose-700' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 max-w-full animate-in fade-in-50 zoom-in-95 ${dropdownClassName}`}
        >
          {/* Integrated Search Filter if enabled or if many options */}
          {(searchable || options.length >= 7) && (
            <div className="relative px-1 pt-1 pb-1">
              <SearchIcon className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to filter..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 divide-y divide-slate-100/80 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-medium">
                No matching options found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer flex items-center justify-between gap-2 min-w-0 ${
                      isSelected
                        ? 'bg-rose-50 text-rose-950 font-extrabold'
                        : 'text-slate-800 hover:bg-slate-50 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0 truncate">
                        <span className="text-xs truncate block">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="text-[10px] text-slate-500 block truncate font-normal">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded-md bg-slate-100 text-slate-700 uppercase">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <CheckIcon className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
