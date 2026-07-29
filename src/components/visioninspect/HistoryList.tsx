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
import type { ChatMessage, InspectionRecord } from '@/lib/visioninspect/schema';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { SeverityBadge } from './EvidencePanel';
import { InfoModal } from './InfoModal';
import { ChatModal } from './ChatModal';

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
  const [infoImageId, setInfoImageId] = useState<string | null>(null);
  const [chatImageId, setChatImageId] = useState<string | null>(null);
  // Keyed by image_id, one transcript per inspection. Lives only in this component's
  // state for the life of the page — never sent anywhere except one turn at a time to
  // /api/visioninspect/chat, and never persisted. Reopening the chat for the same image
  // within this session picks the conversation back up; a page refresh clears it.
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

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

  function handleChat(imageId: string) {
    setChatImageId(imageId);
  }

  function handleChatMessagesChange(imageId: string, msgs: ChatMessage[]) {
    setChatHistories((prev) => ({ ...prev, [imageId]: msgs }));
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
    <>
      <ul className="space-y-3">
      {records.map((record) => (
        <li
          key={record.image_id}
          className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-steel/80 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-teal/40 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center gap-3">
            <SeverityBadge severity={record.severity} />
            <span className="font-body text-sm font-semibold capitalize text-graphite">
              {record.defect_type.replace(/-/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-porcelain-dim px-2.5 py-1 font-body text-xs font-medium text-graphite-soft border border-steel/50">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  record.human_decision === 'pending'
                    ? 'bg-amber-500 animate-pulse'
                    : record.human_decision === 'confirmed'
                    ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`}
              />
              {decisionLabel(record)}
            </span>
            <span className="font-mono text-xs text-graphite-soft/80">
              {new Date(record.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => setInfoImageId(record.image_id)}
              className="ml-1 rounded-lg border border-steel/60 px-2.5 py-1 font-body text-xs font-medium text-graphite transition-colors hover:bg-porcelain-dim"
            >
              Info
            </button>
            <button
              onClick={() => handleChat(record.image_id)}
              className="rounded-lg border border-teal/50 px-2.5 py-1 font-body text-xs font-medium text-teal-dark transition-colors hover:bg-teal/10"
            >
              Chat
            </button>
            <button
              onClick={() => handleDelete(record.image_id)}
              disabled={deletingId === record.image_id}
              className="rounded-lg px-2.5 py-1 font-body text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            >
              {deletingId === record.image_id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </li>
      ))}
    </ul>
      {infoImageId && (
        <InfoModal imageId={infoImageId} onClose={() => setInfoImageId(null)} />
      )}
      {chatImageId && (
        <ChatModal
          imageId={chatImageId}
          messages={chatHistories[chatImageId] ?? []}
          onMessagesChange={handleChatMessagesChange}
          onClose={() => setChatImageId(null)}
        />
      )}
    </>
  );
}
