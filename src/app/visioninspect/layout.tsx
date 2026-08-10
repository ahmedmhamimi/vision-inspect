/**
 * layout.tsx (/visioninspect)
 * Wraps the existing analyze workflow page with the authenticated header (AuthBar) and,
 * more importantly, the server-side auth gate itself: requireUser() redirects to /login
 * before page.tsx ever renders if nobody is signed in. middleware.ts already redirects
 * unauthenticated requests at the edge — this is the second, defense-in-depth check that
 * runs with full server access, same pattern as app/admin/layout.tsx's requireAdmin().
 *
 * page.tsx itself is untouched: all of its existing state machine and API calls to
 * /api/visioninspect keep working exactly as before.
 */
import { getCurrentProfile, requireUser } from '@/lib/auth/session';
import { AuthBar } from '@/components/common/AuthBar';

export default async function VisionInspectLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-porcelain">
      {profile && <AuthBar profile={profile} active="inspect" />}
      {children}
    </div>
  );
}
