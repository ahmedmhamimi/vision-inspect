/**
 * Footer.tsx
 * Shared footer for the marketing route group.
 */
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-steel bg-porcelain-dim">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-display text-base font-medium text-graphite">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-tag border-2 border-teal text-[10px] font-semibold text-teal">
              VI
            </span>
            VisionInspect
          </div>
          <p className="mt-2 max-w-xs text-sm text-graphite-soft">
            AI proposes a defect hypothesis. A human always signs off before it counts.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm sm:flex sm:gap-12">
          <div className="flex flex-col gap-2">
            <span className="font-display text-xs font-medium uppercase tracking-wide text-graphite-soft">
              Product
            </span>
            <Link href="/features" className="text-graphite-soft hover:text-graphite">
              Features
            </Link>
            <Link href="/pricing" className="text-graphite-soft hover:text-graphite">
              Pricing
            </Link>
            <Link href="/visioninspect" className="text-graphite-soft hover:text-graphite">
              Launch app
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-display text-xs font-medium uppercase tracking-wide text-graphite-soft">
              Company
            </span>
            <Link href="/about" className="text-graphite-soft hover:text-graphite">
              About
            </Link>
            <Link href="/faq" className="text-graphite-soft hover:text-graphite">
              FAQ
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-steel px-5 py-4 text-center text-xs text-graphite-soft">
        © {new Date().getFullYear()} VisionInspect. Built for review, not for autopilot.
      </div>
    </footer>
  );
}
