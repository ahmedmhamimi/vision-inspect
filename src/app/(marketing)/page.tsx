/**
 * (marketing)/page.tsx
 * Public landing page at "/". Static marketing content only — the real workflow lives at
 * /visioninspect and is untouched by anything on this page.
 */
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VisionInspect — AI proposes, a human decides',
};

const STEPS = [
  {
    n: '01',
    title: 'Upload',
    body: 'A reviewer submits an inspection image — a component, a surface, a finished part.',
  },
  {
    n: '02',
    title: 'AI hypothesis',
    body: 'The model proposes a defect hypothesis with stated evidence and a confidence score. Nothing is final yet.',
  },
  {
    n: '03',
    title: 'Human sign-off',
    body: 'A reviewer confirms or corrects the hypothesis. Only then is an inspection status recorded.',
  },
];

const HIGHLIGHTS = [
  {
    title: 'Evidence, not guesses',
    body: 'Every hypothesis carries the visual evidence behind it, not just a label.',
  },
  {
    title: 'Severity-aware routing',
    body: 'Findings are routed by severity — low, medium, high — so nothing urgent sits in a queue.',
  },
  {
    title: 'A record you can audit',
    body: 'Every AI proposal and every human decision is kept, side by side, for later review.',
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 sm:pt-24">
        <p className="font-mono text-xs uppercase tracking-widest text-teal">Visual quality inspection</p>
        <h1 className="mt-4 max-w-2xl font-display text-fluid-hero font-medium leading-tight text-graphite">
          AI proposes a defect hypothesis. A human always signs off.
        </h1>
        <p className="mt-5 max-w-xl text-fluid-lg text-graphite-soft">
          VisionInspect pairs a fast, evidence-backed AI read on an inspection image with a
          mandatory human confirmation step — so the model can move quickly without ever
          being the one making the final call.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/visioninspect"
            className="touch-target inline-flex items-center rounded-tag bg-teal px-5 py-3 text-sm font-medium text-porcelain shadow-tag transition-colors hover:bg-teal-dark"
          >
            Launch VisionInspect
          </Link>
          <Link
            href="/features"
            className="touch-target inline-flex items-center rounded-tag border border-steel-dark px-5 py-3 text-sm font-medium text-graphite transition-colors hover:bg-porcelain-dim"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="border-y border-steel bg-porcelain-dim">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-2xl font-medium text-graphite">How an inspection runs</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="evidence-tag relative p-5">
                <span
                  className="tag-punch-hole -right-1.5 -top-1.5"
                  aria-hidden="true"
                />
                <span className="font-mono text-xs text-steel-dark">{step.n}</span>
                <h3 className="mt-2 font-display text-base font-medium text-graphite">{step.title}</h3>
                <div className="tag-perforation my-3" />
                <p className="text-sm text-graphite-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display text-2xl font-medium text-graphite">
          Built around one rule
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-graphite-soft">
          The model proposes. It never decides. Every screen in the product reinforces that
          split.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="rounded-tag border border-steel bg-white p-5 shadow-tag">
              <h3 className="font-display text-base font-medium text-graphite">{item.title}</h3>
              <p className="mt-2 text-sm text-graphite-soft">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/features" className="text-sm font-medium text-teal hover:text-teal-dark">
            See the full feature list →
          </Link>
        </div>
      </section>

      <section className="border-t border-steel bg-graphite">
        <div className="mx-auto max-w-5xl px-5 py-14 text-center">
          <h2 className="font-display text-xl font-medium text-porcelain sm:text-2xl">
            Try it on your own inspection image
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-porcelain/70">
            No setup beyond an upload. The AI's hypothesis is waiting for your sign-off, not
            the other way around.
          </p>
          <Link
            href="/visioninspect"
            className="touch-target mt-6 inline-flex items-center rounded-tag bg-teal px-5 py-3 text-sm font-medium text-porcelain shadow-tag transition-colors hover:bg-teal-light"
          >
            Launch VisionInspect
          </Link>
        </div>
      </section>
    </div>
  );
}
