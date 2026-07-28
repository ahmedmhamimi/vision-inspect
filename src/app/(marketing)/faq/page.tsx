/**
 * faq/page.tsx
 * Static Q&A content rendered through the FaqAccordion client component.
 */
import type { Metadata } from 'next';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ — VisionInspect',
};

const FAQ_ITEMS = [
  {
    question: 'Does the AI ever finalize an inspection on its own?',
    answer:
      'No. The model proposes a defect hypothesis with evidence and a confidence score, but an inspection status is only recorded once a human reviewer confirms or corrects it.',
  },
  {
    question: 'What happens when a reviewer disagrees with the AI?',
    answer:
      'The reviewer corrects the hypothesis. That correction — not the original AI proposal — becomes the recorded outcome, and both are kept for later reference.',
  },
  {
    question: 'How is severity decided?',
    answer:
      'Findings are classified into low, medium, or high severity based on the defect taxonomy, which drives how a finding is visually flagged and routed.',
  },
  {
    question: 'Can I see past inspections?',
    answer:
      'Yes — inspection history keeps both the AI proposal and the human decision side by side, so you can review how a call was made after the fact.',
  },
  {
    question: 'What image types are supported?',
    answer:
      'Standard inspection photo formats work out of the box. If you have a specific format or a large volume workflow, get in touch and we can talk through it.',
  },
  {
    question: 'Is there a free way to try it?',
    answer:
      'Yes — the Pilot tier is free and lets a single reviewer run real inspections against the standard defect taxonomy.',
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-teal">FAQ</p>
      <h1 className="mt-3 font-display text-3xl font-medium text-graphite">
        Common questions
      </h1>
      <p className="mt-2 text-sm text-graphite-soft">
        If something isn&apos;t covered here, reach out and we&apos;ll add it.
      </p>

      <div className="mt-8">
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
