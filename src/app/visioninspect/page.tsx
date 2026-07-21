/**
 * page.tsx (/visioninspect)
 * Orchestrates the full workflow: upload → analyze → review evidence → confirm/correct →
 * report → history. Owns all client-side state; talks to the server only through
 * /api/visioninspect (POST to analyze, PATCH to confirm). Never imports a port, adapter,
 * or provider directly — that boundary is the Route Handler's job, not this component's.
 *
 * State machine: idle | analyzing | result (with confirming as a sub-flag) | error.
 * The InputForm stays mounted throughout so a reviewer can always start a new inspection
 * without losing their place, even right after an error.
 */
'use client';

import { useCallback, useState } from 'react';
import type { ConfirmRequest, InspectionRecord, InspectionReport } from '@/lib/visioninspect/schema';
import { InputForm } from '@/components/visioninspect/InputForm';
import { ResultView } from '@/components/visioninspect/ResultView';
import { HistoryList } from '@/components/visioninspect/HistoryList';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';

type WorkflowState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'error'; message: string }
  | { status: 'result'; record: InspectionRecord; report: InspectionReport | null; confirming: boolean };

interface LastSubmission {
  imageBase64: string;
  mimeType: string;
}

async function postJson<T>(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await res.json();
  if (!res.ok) {
    throw new Error(parsed.error ?? 'The request failed. Please try again.');
  }
  return parsed as T;
}

export default function VisionInspectPage() {
  const [workflow, setWorkflow] = useState<WorkflowState>({ status: 'idle' });
  const [lastSubmission, setLastSubmission] = useState<LastSubmission | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const runAnalysis = useCallback(async (imageBase64: string, mimeType: string) => {
    setLastSubmission({ imageBase64, mimeType });
    setWorkflow({ status: 'analyzing' });
    try {
      const { record } = await postJson<{ record: InspectionRecord }>(
        '/api/visioninspect',
        'POST',
        { image_base64: imageBase64, mime_type: mimeType },
      );
      setWorkflow({ status: 'result', record, report: null, confirming: false });
    } catch (err) {
      setWorkflow({
        status: 'error',
        message: err instanceof Error ? err.message : 'Analysis failed. Please try again.',
      });
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastSubmission) {
      void runAnalysis(lastSubmission.imageBase64, lastSubmission.mimeType);
    } else {
      setWorkflow({ status: 'idle' });
    }
  }, [lastSubmission, runAnalysis]);

  const handleConfirm = useCallback(
    async (decision: ConfirmRequest) => {
      if (workflow.status !== 'result') return;
      setWorkflow({ ...workflow, confirming: true });
      try {
        const { record, report } = await postJson<{
          record: InspectionRecord;
          report: InspectionReport;
        }>('/api/visioninspect', 'PATCH', decision);
        setWorkflow({ status: 'result', record, report, confirming: false });
        setHistoryKey((k) => k + 1); // refresh history now that a new decision was recorded
      } catch (err) {
        setWorkflow({
          status: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Could not record your decision. Please try again.',
        });
      }
    },
    [workflow],
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="font-body text-xs uppercase tracking-wide text-graphite-soft">
          VisionInspect
        </p>
        <h1 className="mt-1 font-display text-fluid-hero font-medium text-graphite">
          Visual quality inspection
        </h1>
        <p className="mt-2 max-w-prose font-body text-sm text-graphite-soft">
          Upload an inspection image to get an AI-proposed defect hypothesis with stated
          evidence and confidence. A reviewer must confirm or correct every finding before
          it becomes final.
        </p>
      </header>

      <section aria-label="New inspection" className="space-y-4">
        <InputForm onSubmit={runAnalysis} disabled={workflow.status === 'analyzing'} />

        {workflow.status === 'analyzing' && (
          <LoadingState label="Analyzing image — this can take a few seconds…" />
        )}

        {workflow.status === 'error' && (
          <ErrorState message={workflow.message} onRetry={handleRetry} />
        )}

        {workflow.status === 'result' && (
          <ResultView
            record={workflow.record}
            report={workflow.report}
            onConfirm={handleConfirm}
            confirming={workflow.confirming}
          />
        )}
      </section>

      <section aria-label="Inspection history" className="mt-10">
        <h2 className="font-display text-fluid-lg font-medium text-graphite">
          Recent inspections
        </h2>
        <div className="mt-3">
          <HistoryList key={historyKey} />
        </div>
      </section>
    </main>
  );
}
