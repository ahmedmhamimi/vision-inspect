/**
 * page.tsx (/signup)
 * Public self-service sign-up for VisionInspect. Anyone who reaches this URL can create
 * their own reviewer account — no admin provisioning step required. New accounts land
 * with role 'reviewer' by default; the single exception is the well-known default admin
 * address (admin@visioninspect.com), which the database trigger promotes to 'admin'
 * automatically the moment that specific account is created — see
 * migrations/003_self_service_signup_and_default_admin.sql.
 *
 * A plain server component posting to signUpAction (see actions.ts) via a native form,
 * matching login/page.tsx's pattern exactly: no client-side Supabase client, no
 * NEXT_PUBLIC_-prefixed env vars.
 */
import Link from 'next/link';
import { signUpAction } from './actions';

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; email?: string };
}) {
  const next = searchParams.next ?? '/visioninspect';

  return (
    <main className="flex min-h-screen items-center justify-center bg-porcelain px-4">
      <div className="w-full max-w-sm rounded-card border border-steel bg-white p-8 shadow-card">
        <h1 className="font-display text-fluid-lg font-medium text-graphite">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-graphite-soft">
          Sign up to start submitting and reviewing inspections.
        </p>

        <form action={signUpAction} className="mt-6 flex flex-col gap-4">
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
              defaultValue={searchParams.email ?? ''}
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
              minLength={6}
              autoComplete="new-password"
              className="rounded-tag border border-steel bg-porcelain-dim px-3 py-2 text-graphite outline-none focus:border-teal-dark"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-graphite">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="rounded-tag border border-steel bg-porcelain-dim px-3 py-2 text-graphite outline-none focus:border-teal-dark"
            />
          </div>

          {searchParams.error && (
            <p role="alert" className="text-sm text-severity-high">
              {searchParams.error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 rounded-tag bg-teal px-4 py-2 font-medium text-graphite shadow-tag transition hover:bg-teal-dark"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-xs text-graphite-soft">
          Already have an account?{' '}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-teal-dark hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
