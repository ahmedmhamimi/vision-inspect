/**
 * (marketing)/layout.tsx
 * Wraps the public-facing pages (home, features, pricing, faq, about) with a shared
 * nav + footer. Deliberately kept separate from /visioninspect, which stays a focused,
 * chrome-free tool screen.
 */
import { Nav } from '@/components/marketing/Nav';
import { Footer } from '@/components/marketing/Footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col animate-fade-in">
      <Nav />
      <main className="flex-1 animate-fade-in-up">{children}</main>
      <Footer />
    </div>
  );
}
