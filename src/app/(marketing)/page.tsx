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
      <section className="mx-auto max-w-5xl px-5 pb-20 pt-16 sm:pt-24 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur-sm animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span>Visual Quality Inspection ✦ AI-Powered</span>
        </div>
        <h1 className="mt-5 max-w-3xl font-display text-fluid-hero font-bold leading-tight tracking-tight text-slate-900">
          AI proposes a defect hypothesis. <span className="text-accent-gradient">A human always signs off.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-fluid-lg text-graphite-soft animate-fade-in-up stagger-1 leading-relaxed">
          VisionInspect pairs a fast, evidence-backed AI read on an inspection image with a
          mandatory human confirmation step — so the model can move quickly without ever
          being the one making the final call.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center sm:justify-start gap-4 animate-fade-in-up stagger-2">
          <Link
            href="/visioninspect"
            className="touch-target inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/35 hover:scale-105"
          >
            <span>Launch VisionInspect</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
          <Link
            href="/features"
            className="touch-target inline-flex items-center rounded-full border border-steel-dark/80 bg-white/90 px-6 py-3.5 text-sm font-semibold text-graphite shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-porcelain-dim hover:border-steel-dark hover:scale-105"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="border-y border-steel/70 bg-porcelain-dim/60 py-20 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-5">
          <div className="text-center sm:text-left">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">Workflow</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-graphite sm:text-3xl">How an inspection runs</h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.n} className={`evidence-tag relative p-6 glass-card animate-fade-in-up stagger-${(i % 4) + 1}`}>
                <span
                  className="tag-punch-hole -right-1.5 -top-1.5"
                  aria-hidden="true"
                />
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 font-mono text-xs font-bold text-blue-600 border border-blue-100">{step.n}</span>
                <h3 className="mt-4 font-display text-lg font-bold text-graphite">{step.title}</h3>
                <div className="tag-perforation my-4" />
                <p className="text-sm leading-relaxed text-graphite-soft">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <div className="text-center sm:text-left">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">Core Principles</span>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-graphite sm:text-3xl">
            Built around one rule
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite-soft">
            The model proposes. It never decides. Every screen in the product reinforces that
            split.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {HIGHLIGHTS.map((item, i) => (
            <div key={item.title} className={`rounded-card border border-steel/80 bg-white/90 p-6 shadow-tag backdrop-blur-md transition-all duration-300 hover:border-blue-400/50 hover:shadow-card hover:-translate-y-1 animate-fade-in-up stagger-${(i % 4) + 1}`}>
              <h3 className="font-display text-base font-bold text-graphite">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-graphite-soft">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center sm:text-left">
          <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            <span>See the full feature list</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      <section className="border-t border-steel/70 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 py-16 text-white shadow-xl">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Try it on your own inspection image
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-300">
            No setup beyond an upload. The AI&apos;s hypothesis is waiting for your sign-off, not
            the other way around.
          </p>
          <Link
            href="/visioninspect"
            className="touch-target mt-8 inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40"
          >
            Launch VisionInspect
          </Link>
        </div>
      </section>
    </div>
  );
}
