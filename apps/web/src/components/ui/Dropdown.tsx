'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
}

/**
 * Доступний dropdown: справжня <button> як trigger з aria-haspopup/aria-expanded,
 * role="listbox"/"option" для списку, keyboard: Enter/Space відкриває, Escape закриває,
 * стрілки перемикають опції — базова accessibility (decisions.md DEC-09).
 */
export function Dropdown({ label, options, value, onChange, placeholder }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

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

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        onChange(options[activeIndex].value);
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <span id={`${buttonId}-label`} className="text-sm font-medium text-gray-700">
        {label}
      </span>
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${buttonId}-label ${buttonId}`}
          onClick={() => setIsOpen((v) => !v)}
          onKeyDown={onKeyDown}
          className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 px-3 text-sm"
        >
          <span className={cn(!selected && 'text-gray-400')}>
            {selected?.label ?? placeholder ?? 'Оберіть значення'}
          </span>
          <span aria-hidden="true">▾</span>
        </button>
        {isOpen && (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={`${buttonId}-label`}
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm hover:bg-brand-50',
                  index === activeIndex && 'bg-brand-50',
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
        )}
      </div>
    </div>
  );
}
