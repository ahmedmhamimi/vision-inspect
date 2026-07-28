/**
 * pricing/page.tsx
 * Static pricing tiers. No billing integration — "Contact us" simply opens an email
 * draft. Intentionally simple: this is a page to look at, not a checkout flow.
 */
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — VisionInspect',
};

const TIERS = [
  {
    name: 'Pilot',
    price: 'Free',
    tagline: 'For trying VisionInspect on a real inspection queue.',
    features: ['Single reviewer', 'Standard defect taxonomy', 'Inspection history (30 days)'],
    cta: { label: 'Launch VisionInspect', href: '/visioninspect' },
    highlighted: false,
  },
  {
    name: 'Team',
    price: 'Contact us',
    tagline: 'For a team running inspections as part of daily QA.',
    features: [
      'Multiple reviewers',
      'Custom severity routing',
      'Full inspection history',
      'Priority support',
    ],
    cta: { label: 'Get in touch', href: 'mailto:hello@visioninspect.app' },
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Contact us',
    tagline: 'For larger deployments with specific taxonomy or workflow needs.',
    features: ['Custom taxonomy', 'Dedicated onboarding', 'SSO', 'Custom retention policy'],
    cta: { label: 'Get in touch', href: 'mailto:hello@visioninspect.app' },
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20 animate-fade-in-up">
      <div className="text-center sm:text-left">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">Pricing Tiers</span>
        <h1 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-graphite sm:text-4xl">
          Start on the pilot tier. Talk to us when you need more.
        </h1>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {TIERS.map((tier, i) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-card p-7 transition-all duration-300 animate-fade-in-up stagger-${(i % 3) + 1} ${
              tier.highlighted
                ? 'border-2 border-blue-500 bg-white shadow-xl shadow-blue-500/10 scale-[1.03] z-10'
                : 'border border-steel/80 bg-white/90 shadow-tag hover:border-blue-400/40 hover:shadow-card'
            }`}
          >
            {tier.highlighted && (
              <span className="mb-4 inline-flex items-center gap-1 self-start rounded-full bg-blue-50 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-blue-600 border border-blue-200 shadow-sm">
                ★ Most common
              </span>
            )}
            <h2 className="font-display text-xl font-bold text-graphite">{tier.name}</h2>
            <p className="mt-2 font-display text-3xl font-extrabold text-slate-900 tracking-tight">{tier.price}</p>
            <p className="mt-2 text-sm leading-relaxed text-graphite-soft">{tier.tagline}</p>

            <div className="tag-perforation my-5" />

            <ul className="flex-1 space-y-3 text-sm font-medium text-graphite-soft">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-xs">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={tier.cta.href}
              className={`touch-target mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ${
                tier.highlighted
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-105'
                  : 'border border-steel-dark/80 bg-white text-graphite hover:bg-porcelain-dim hover:border-steel-dark hover:scale-105'
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
