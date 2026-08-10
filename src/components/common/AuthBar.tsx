/**
 * AuthBar.tsx
 * Small server-rendered header strip showing who's signed in, a link into the admin
 * dashboard (only rendered for admins), and a sign-out button. Shared by the
 * /visioninspect layout and the /admin layout so both authenticated areas look
 * consistent — see app/visioninspect/layout.tsx and app/admin/layout.tsx.
 */
import Link from 'next/link';
import type { Profile } from '@/lib/auth/session';

export function AuthBar({ profile, active }: { profile: Profile; active: 'inspect' | 'admin' }) {
  return (
    <header className="flex items-center justify-between border-b border-steel bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="font-display text-sm font-medium text-graphite">VisionInspect</span>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/visioninspect"
            className={active === 'inspect' ? 'font-medium text-graphite' : 'text-graphite-soft hover:text-graphite'}
          >
            Inspect
          </Link>
          {profile.role === 'admin' && (
            <Link
              href="/admin"
              className={active === 'admin' ? 'font-medium text-graphite' : 'text-graphite-soft hover:text-graphite'}
            >
              Admin dashboard
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3 text-sm text-graphite-soft">
        <span>
          {profile.email} · <span className="uppercase tracking-wide">{profile.role}</span>
        </span>
        <form action="/logout" method="POST">
          <button
            type="submit"
            className="rounded-tag border border-steel px-3 py-1 text-graphite transition hover:border-steel-dark"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
