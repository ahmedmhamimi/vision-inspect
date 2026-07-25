/**
 * HistoryList.tsx
 * Fetches and displays recent inspections. Handles its own loading, empty, and error
 * states independently of the main analyze workflow, since a reviewer may open the
 * history panel at any point regardless of whether an analysis is in progress.
 *
 * - HistoryList: the component. Calls GET /api/visioninspect (no image_id) internally.
 */
'use client';

import { useEffect, useState } from 'react';
import type { InspectionRecord } from '@/lib/visioninspect/schema';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { SeverityBadge } from './EvidencePanel';

function decisionLabel(record: InspectionRecord): string {
  if (record.human_decision === 'pending') return 'Awaiting review';
  if (record.human_decision === 'confirmed') return 'Confirmed';
  return 'Corrected';
}

export function HistoryList() {
  const [records, setRecords] = useState<InspectionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    fetch('/api/visioninspect')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not load inspection history.');
        return body.records as InspectionRecord[];
      })
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load inspection history.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleDelete(imageId: string) {
    if (!confirm('Are you sure you want to delete this inspection?')) return;
    setDeletingId(imageId);
    try {
      const res = await fetch(`/api/visioninspect?image_id=${imageId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to delete record.');
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  if (records === null) {
    return <LoadingState label="Loading inspection history…" />;
  }

  if (records.length === 0) {
    return (
      <div className="rounded-tag border border-dashed border-steel-dark bg-porcelain-dim p-6 text-center">
        <p className="font-body text-sm text-graphite-soft">
          No inspections yet. Upload an image above to run your first one.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {records.map((record) => (
        <li
          key={record.image_id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-tag border border-steel bg-white px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <SeverityBadge severity={record.severity} />
            <span className="font-body text-sm capitalize text-graphite">
              {record.defect_type.replace(/-/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-body text-xs text-graphite-soft">{decisionLabel(record)}</span>
            <span className="font-mono text-xs text-graphite-soft">
              {new Date(record.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => handleDelete(record.image_id)}
              disabled={deletingId === record.image_id}
              className="ml-2 font-body text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {deletingId === record.image_id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
