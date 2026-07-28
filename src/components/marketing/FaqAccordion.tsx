/**
 * FaqAccordion.tsx
 * Simple single-open accordion, no external dependency — just local state.
 */
'use client';

import { useState } from 'react';

export type FaqItem = {
  question: string;
  answer: string;
};

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="rounded-tag border border-steel bg-white shadow-tag">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              className="touch-target flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-display text-sm font-medium text-graphite sm:text-base">
                {item.question}
              </span>
              <span
                className={`flex-none font-mono text-lg leading-none text-teal transition-transform ${
                  isOpen ? 'rotate-45' : ''
                }`}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <div className="tag-perforation mb-3" />
                <p className="text-sm text-graphite-soft">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
