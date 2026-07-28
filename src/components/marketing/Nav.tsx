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
    <header className="sticky top-0 z-20 border-b border-steel/60 bg-white/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5 font-display text-lg font-bold text-graphite transition-opacity hover:opacity-90">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-xs font-bold text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            VI
          </span>
          <span className="tracking-tight text-gradient font-semibold">VisionInspect</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-graphite-soft transition-colors hover:text-teal"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/visioninspect"
            className="touch-target inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-105"
          >
            Launch app
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="touch-target inline-flex items-center justify-center rounded-xl border border-steel bg-white p-2 text-graphite-soft md:hidden"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-steel/60 bg-white/95 px-5 py-4 md:hidden animate-fade-in">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-graphite-soft hover:bg-porcelain-dim hover:text-teal"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/visioninspect"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20"
          >
            Launch app
          </Link>
        </nav>
      )}
    </header>
  );
}
