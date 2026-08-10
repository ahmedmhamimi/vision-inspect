/**
 * Nav.tsx
 * Shared header for the marketing route group. Client component for the mobile menu
 * toggle, but account state (profile) is passed down from the server layout — see
 * app/(marketing)/layout.tsx, which calls getCurrentProfile() — rather than fetched
 * here, since that lookup needs server-only Supabase access. This is what makes account
 * state (signed in vs signed out, email, admin link, sign out) visible site-wide instead
 * of only after clicking into /visioninspect.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Profile } from '@/lib/auth/session';

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export function Nav({ profile }: { profile: Profile | null }) {
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

          {profile ? (
            <div className="flex items-center gap-3">
              {profile.role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-graphite-soft transition-colors hover:text-teal"
                >
                  Admin
                </Link>
              )}
              <span className="text-sm text-graphite-soft">
                {profile.email} · <span className="uppercase tracking-wide">{profile.role}</span>
              </span>
              <form action="/logout" method="POST">
                <button
                  type="submit"
                  className="rounded-tag border border-steel px-3 py-1.5 text-sm text-graphite transition hover:border-steel-dark"
                >
                  Sign out
                </button>
              </form>
              <Link
                href="/visioninspect"
                className="touch-target inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-105"
              >
                Open app
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-graphite-soft transition-colors hover:text-teal"
              >
                Sign in
              </Link>
              <Link
                href="/visioninspect"
                className="touch-target inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-105"
              >
                Launch app
              </Link>
            </div>
          )}
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

          {profile ? (
            <>
              <div className="mt-2 border-t border-steel/60 px-3 pt-3 text-sm text-graphite-soft">
                {profile.email} · <span className="uppercase tracking-wide">{profile.role}</span>
              </div>
              {profile.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-graphite-soft hover:bg-porcelain-dim hover:text-teal"
                >
                  Admin dashboard
                </Link>
              )}
              <Link
                href="/visioninspect"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20"
              >
                Open app
              </Link>
              <form action="/logout" method="POST">
                <button
                  type="submit"
                  onClick={() => setOpen(false)}
                  className="mt-2 w-full rounded-full border border-steel px-5 py-2.5 text-sm font-medium text-graphite transition hover:border-steel-dark"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-graphite-soft hover:bg-porcelain-dim hover:text-teal"
              >
                Sign in
              </Link>
              <Link
                href="/visioninspect"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20"
              >
                Launch app
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
