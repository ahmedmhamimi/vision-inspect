/**
 * features/page.tsx
 * Static feature grid. Describes existing behavior of the tool from a few different
 * angles — no new functionality, just organized presentation of it.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — VisionInspect',
};

const FEATURES = [
  {
    title: 'AI defect hypothesis',
    body: 'Upload an inspection image and the model proposes what it sees — a candidate defect, not a verdict.',
  },
  {
    title: 'Evidence-backed confidence',
    body: 'Every hypothesis is paired with the specific visual evidence and a confidence score, so a reviewer knows what the model is reacting to.',
  },
  {
    title: 'Mandatory human confirmation',
    body: 'Nothing becomes a final inspection status until a person confirms or corrects it. The gate is not optional and cannot be skipped.',
  },
  {
    title: 'Severity-aware routing',
    body: 'Findings are classified low, medium, or high severity, with distinct visual treatment for each, so urgent issues stand out immediately.',
  },
  {
    title: 'Inspection history',
    body: 'Past inspections — AI proposal and human decision together — stay available for later review, not just the final status.',
  },
  {
    title: 'Rate-limited, deterministic routing',
    body: 'Requests are rate-limited and routed deterministically between providers, so behavior stays predictable under load.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20 animate-fade-in-up">
      <div className="text-center sm:text-left">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-blue-600">Platform Capabilities</span>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-graphite sm:text-4xl">
          Everything is built around one split: the model proposes, a person decides.
        </h1>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            className={`evidence-tag relative p-6 glass-card transition-all duration-300 animate-fade-in-up stagger-${(i % 4) + 1}`}
          >
            <span className="tag-punch-hole -right-1.5 -top-1.5" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-graphite">{feature.title}</h2>
            <div className="tag-perforation my-4" />
            <p className="text-sm leading-relaxed text-graphite-soft">{feature.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
