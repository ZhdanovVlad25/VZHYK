'use client';

import { ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTabId?: string;
}

/**
 * WAI-ARIA Tabs pattern: role="tablist"/"tab"/"tabpanel", aria-selected,
 * aria-controls/labelledby зв'язок, стрілки ←/→ перемикають вкладки з клавіатури.
 */
export function Tabs({ items, defaultTabId }: TabsProps) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const baseId = useId();

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') {
      const next = items[(index + 1) % items.length];
      setActiveId(next.id);
    } else if (event.key === 'ArrowLeft') {
      const prev = items[(index - 1 + items.length) % items.length];
      setActiveId(prev.id);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Вкладки" className="flex gap-2 border-b border-gray-200">
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                'px-3 py-2 text-sm font-medium',
                isActive ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== activeId}
          className="py-4"
        >
          {item.id === activeId && item.content}
        </div>
      ))}
    </div>
  );
}
