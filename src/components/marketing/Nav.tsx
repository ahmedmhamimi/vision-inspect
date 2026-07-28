/**
 * Nav.tsx
 * Shared header for the marketing route group. Small client component only because of
 * the mobile menu toggle — everything else here is static.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-steel bg-porcelain/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-medium text-graphite">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-tag border-2 border-teal text-xs font-semibold text-teal">
            VI
          </span>
          VisionInspect
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-graphite-soft transition-colors hover:text-graphite"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/visioninspect"
            className="touch-target inline-flex items-center rounded-tag bg-teal px-4 py-2 text-sm font-medium text-porcelain shadow-tag transition-colors hover:bg-teal-dark"
          >
            Launch app
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="touch-target inline-flex items-center justify-center rounded-tag border border-steel md:hidden"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-steel px-5 pb-4 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-tag px-2 py-2.5 text-sm text-graphite-soft hover:bg-porcelain-dim hover:text-graphite"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/visioninspect"
            onClick={() => setOpen(false)}
            className="mt-1 inline-flex items-center justify-center rounded-tag bg-teal px-4 py-2.5 text-sm font-medium text-porcelain"
          >
            Launch app
          </Link>
        </nav>
      )}
    </header>
  );
}
