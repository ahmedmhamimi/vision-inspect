/**
 * (marketing)/layout.tsx
 * Wraps the public-facing pages (home, features, pricing, faq, about) with a shared
 * nav + footer. Deliberately kept separate from /visioninspect, which stays a focused,
 * chrome-free tool screen — but account state (signed in / signed out, email, role) is
 * now read here too, so the marketing site itself reflects who's logged in rather than
 * only showing that once someone has clicked into the app. getCurrentProfile() is safe
 * to call even when nobody is signed in (resolves to null) and even when Supabase env
 * vars aren't configured yet (createSupabaseServerClient/getCurrentUser handle that),
 * so this never blocks marketing pages from rendering.
 */
import { getCurrentProfile } from '@/lib/auth/session';
import { Nav } from '@/components/marketing/Nav';
import { Footer } from '@/components/marketing/Footer';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen flex-col animate-fade-in">
      <Nav profile={profile} />
      <main className="flex-1 animate-fade-in-up">{children}</main>
      <Footer />
    </div>
  );
}
