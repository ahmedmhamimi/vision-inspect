/**
 * layout.tsx (/admin)
 * Gate for the entire admin section: requireAdmin() redirects to /login if signed out,
 * or to /visioninspect if signed in but not an admin. Every page under app/admin/**
 * inherits this check for free just by existing in this route segment — no individual
 * admin page needs to re-check role itself.
 */
import { requireAdmin } from '@/lib/auth/session';
import { AuthBar } from '@/components/common/AuthBar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-porcelain">
      <AuthBar profile={profile} active="admin" />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
