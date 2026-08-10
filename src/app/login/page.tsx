/**
 * page.tsx (/login)
 * Sign-in for VisionInspect. Accounts are self-service (see app/signup) — anyone can
 * create one, and every fresh account lands as a 'reviewer' except the single
 * well-known default admin address, which a database trigger promotes automatically
 * (see migrations/003_self_service_signup_and_default_admin.sql).
 *
 * A plain server component posting to signInAction (see actions.ts) via a native form —
 * no client-side Supabase client and no NEXT_PUBLIC_-prefixed env vars needed at all,
 * matching this project's existing rule that secrets/config never ship to the browser
 * (see the note at the top of .env.example).
 */
import Link from 'next/link';
import { signInAction } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; notice?: string; next?: string };
}) {
  const next = searchParams.next ?? '/visioninspect';

  return (
    <main className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="w-full max-w-sm rounded-card border border-steel bg-white p-8 shadow-card">
        <h1 className="font-display text-fluid-lg font-medium text-graphite">
          VisionInspect
        </h1>
        <p className="mt-1 text-sm text-graphite-soft">
          Sign in with your reviewer account to continue.
        </p>

        <form action={signInAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-graphite">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-tag border border-steel bg-porcelain-dim px-3 py-2 text-graphite outline-none focus:border-teal-dark"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-graphite">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-tag border border-steel bg-porcelain-dim px-3 py-2 text-graphite outline-none focus:border-teal-dark"
            />
          </div>

          {searchParams.notice && !searchParams.error && (
            <p role="status" className="text-sm text-teal-dark">
              {searchParams.notice}
            </p>
          )}

          {searchParams.error && (
            <p role="alert" className="text-sm text-severity-high">
              {searchParams.error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 rounded-tag bg-teal px-4 py-2 font-medium text-graphite shadow-tag transition hover:bg-teal-dark"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-xs text-graphite-soft">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-medium text-teal-dark hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
