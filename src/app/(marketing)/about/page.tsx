/**
 * about/page.tsx
 * Static introduction / philosophy page.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — VisionInspect',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-teal">About</p>
      <h1 className="mt-3 font-display text-3xl font-medium text-graphite">
        Why VisionInspect exists
      </h1>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-graphite-soft sm:text-base">
        <p>
          Visual quality inspection has always relied on a person looking closely at a
          part, a surface, or a component and making a judgment call. VisionInspect
          doesn&apos;t try to replace that judgment — it tries to make the first pass
          faster, without ever putting the model in charge of the final answer.
        </p>
        <p>
          A reviewer uploads an image. The model proposes a defect hypothesis and shows
          its evidence: what it saw, and how confident it is. That&apos;s as far as the
          AI ever goes. A human reviewer confirms it, corrects it, or dismisses it — and
          only that human decision becomes the final inspection status.
        </p>
        <p>
          That split — the model proposes, a person decides — isn&apos;t a caveat bolted
          on afterward. It&apos;s the one rule the whole product is built around, from the
          evidence tag on every finding down to the audit trail that keeps the AI&apos;s
          original proposal next to whatever the reviewer ultimately decided.
        </p>
      </div>

      <div className="mt-10 rounded-tag border border-steel bg-white p-6 shadow-tag">
        <h2 className="font-display text-base font-medium text-graphite">In short</h2>
        <div className="tag-perforation my-3" />
        <p className="text-sm text-graphite-soft">
          VisionInspect is a tool for reviewers who want a fast first read on an
          inspection image — and want to stay the one who signs off on it.
        </p>
      </div>
    </div>
  );
}
