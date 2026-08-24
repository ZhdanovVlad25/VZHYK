'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  label: string;
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Опції ще підвантажуються (напр. getRegions() у польоті) — без цього прапорця
      відкритий список із порожнім options.length рендериться як згорнута до
      кількох пікселів риска: <ul> без жодного <li> замість "триває завантаження". */
  isLoading?: boolean;
  /** Поле пошуку зверху списку (фільтрує за підрядком, без урахування регістру) — для
      довгих списків (міста, області), щоб не гортати вручну. За замовчуванням увімкнено
      лише коли options.length > 8 — короткі списки (стан, коробка передач) в пошуку
      не потребують, зайве поле лише займало б місце. */
  searchable?: boolean;
}

const SEARCH_THRESHOLD = 8;

/**
 * Доступний dropdown: справжня <button> як trigger з aria-haspopup/aria-expanded,
 * role="listbox"/"option" для списку, keyboard: Enter/Space відкриває, Escape закриває,
 * стрілки перемикають опції — базова accessibility (decisions.md DEC-09).
 */
export function Dropdown({
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
  isLoading,
  searchable,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState('');
  const buttonId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const filteredOptions = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, showSearch]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    if (showSearch) searchInputRef.current?.focus();
  }, [isOpen, showSearch]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (isOpen) {
        if (filteredOptions[activeIndex]) {
          onChange(filteredOptions[activeIndex].value);
          setIsOpen(false);
        }
      } else {
        setIsOpen(true);
      }
    } else if (event.key === ' ' && !showSearch) {
      // Пробіл відкриває/обирає лише коли немає пошукового поля — інакше неможливо
      // ввести пробіл у назві (напр. "Івано-Франківськ" тут не має пробілу, але деякі
      // варіанти — можуть).
      event.preventDefault();
      if (isOpen) {
        if (filteredOptions[activeIndex]) {
          onChange(filteredOptions[activeIndex].value);
          setIsOpen(false);
        }
      } else {
        setIsOpen(true);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <span id={`${buttonId}-label`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && (
          <span className="text-accent-600 dark:text-accent-500" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          disabled={isLoading}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${buttonId}-label ${buttonId}`}
          onClick={() => setIsOpen((v) => !v)}
          onKeyDown={onKeyDown}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <span className={cn(!selected && 'text-gray-400 dark:text-gray-500')}>
            {isLoading ? 'Завантаження…' : (selected?.label ?? placeholder ?? 'Оберіть значення')}
          </span>
          <span aria-hidden="true">▾</span>
        </button>
        {isOpen && !isLoading && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {showSearch && (
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Пошук…"
                aria-label="Пошук у списку"
                className="w-full border-b border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            )}
            <ul id={listId} role="listbox" aria-labelledby={`${buttonId}-label`} className="max-h-60 overflow-auto">
              {filteredOptions.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500" aria-disabled="true">
                  {options.length === 0 ? 'Немає варіантів' : 'Нічого не знайдено'}
                </li>
              )}
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm text-gray-900 hover:bg-brand-50 dark:text-gray-100 dark:hover:bg-gray-700',
                    index === activeIndex && 'bg-brand-50 dark:bg-gray-700',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
