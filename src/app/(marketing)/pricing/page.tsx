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
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-teal">Pricing</p>
      <h1 className="mt-3 max-w-xl font-display text-3xl font-medium text-graphite">
        Start on the pilot tier. Talk to us when you need more.
      </h1>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col rounded-tag border p-6 shadow-tag ${
              tier.highlighted ? 'border-2 border-teal bg-white' : 'border-steel bg-white'
            }`}
          >
            {tier.highlighted && (
              <span className="mb-3 self-start rounded-tag border border-teal px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-teal">
                Most common
              </span>
            )}
            <h2 className="font-display text-lg font-medium text-graphite">{tier.name}</h2>
            <p className="mt-1 font-display text-2xl font-medium text-graphite">{tier.price}</p>
            <p className="mt-2 text-sm text-graphite-soft">{tier.tagline}</p>

            <div className="tag-perforation my-4" />

            <ul className="flex-1 space-y-2 text-sm text-graphite-soft">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-teal" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={tier.cta.href}
              className={`touch-target mt-6 inline-flex items-center justify-center rounded-tag px-4 py-2.5 text-sm font-medium ${
                tier.highlighted
                  ? 'bg-teal text-porcelain hover:bg-teal-dark'
                  : 'border border-steel-dark text-graphite hover:bg-porcelain-dim'
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
