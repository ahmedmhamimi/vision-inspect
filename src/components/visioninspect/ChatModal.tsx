/**
 * ChatModal.tsx
 * The chat popup behind each history row's "Chat" button. Lets a reviewer ask
 * follow-up questions about one specific inspection — grounded in that image and its
 * recorded AI hypothesis / routing / human decision — without leaving the history view.
 *
 * Ephemeral by design: the transcript lives only in the `messages` state HistoryList
 * hands down (see HistoryList.tsx), which itself lives only in the browser tab's memory
 * for this session. Nothing here is ever written to the server beyond the single
 * request/reply round trip needed to answer the latest question — POST
 * /api/visioninspect/chat takes the whole transcript and returns one reply; it does not
 * store either. Closing the modal, refreshing the page, or navigating away loses the
 * conversation, on purpose.
 *
 * - ChatModal: the component. Fetches the record once (for the header + grounding
 *   context shown to the reviewer); message state itself is owned by the parent so it
 *   survives closing and reopening the modal within the same session.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, InspectionRecord } from '@/lib/visioninspect/schema';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { SeverityBadge } from './EvidencePanel';

interface ChatModalProps {
  imageId: string;
  messages: ChatMessage[];
  onMessagesChange: (imageId: string, messages: ChatMessage[]) => void;
  onClose: () => void;
}

export function ChatModal({ imageId, messages, onMessagesChange, onClose }: ChatModalProps) {
  const [record, setRecord] = useState<InspectionRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setLoadError(null);

    fetch(`/api/visioninspect?image_id=${imageId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Could not load this inspection.');
        return body.record as InspectionRecord;
      })
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load this inspection.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSendError(null);
    const priorMessages = messages;
    const withUserTurn: ChatMessage[] = [...priorMessages, { role: 'user', content: text }];
    onMessagesChange(imageId, withUserTurn);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/visioninspect/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId, message: text, history: priorMessages }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'The chat assistant could not respond.');

      onMessagesChange(imageId, [
        ...withUserTurn,
        { role: 'assistant', content: body.reply as string },
      ]);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'The chat assistant could not respond. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chat about this inspection"
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-graphite/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in-up flex h-[85vh] w-full max-w-lg flex-col rounded-t-card bg-white/95 hover:-translate-y-0 hover:shadow-tag sm:h-[32rem] sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-steel/60 p-4 sm:p-5">
          <div className="min-w-0">
            <h3 className="font-display text-fluid-lg font-medium tracking-tight text-graphite">
              Chat about this inspection
            </h3>
            {record ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <SeverityBadge severity={record.severity} />
                <span className="truncate font-body text-xs font-medium capitalize text-graphite-soft">
                  {record.defect_type.replace(/-/g, ' ')}
                </span>
              </div>
            ) : (
              <p className="mt-1 font-mono text-xs text-graphite-soft/80">{imageId}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-steel/80 px-3 py-1 font-body text-sm font-medium text-graphite-soft transition-colors hover:bg-porcelain-dim"
          >
            Close
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {loadError && <ErrorState message={loadError} />}

          {!record && !loadError && <LoadingState label="Loading inspection context…" />}

          {record && messages.length === 0 && (
            <div className="rounded-tag border border-dashed border-steel-dark bg-porcelain-dim p-4 text-center">
              <p className="font-body text-sm text-graphite-soft">
                Ask about the recorded evidence, why it was routed this way, or what the
                reviewer decided. This assistant works from the recorded findings, not
                live image vision.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 font-body text-sm ${
                  msg.role === 'user'
                    ? 'bg-teal text-white'
                    : 'border border-steel/70 bg-white text-graphite'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-steel/70 bg-white px-3.5 py-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {sendError && <ErrorState message={sendError} />}
        </div>

        <div className="border-t border-steel/60 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDownInput}
              disabled={!record || sending}
              placeholder="Ask about this inspection…"
              className="touch-target flex-1 rounded-tag border border-steel bg-white px-3 py-2 font-body text-sm text-graphite placeholder:text-graphite-soft/70 focus:border-teal focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!record || sending || !input.trim()}
              className="touch-target shrink-0 rounded-tag bg-teal px-4 py-2 font-body text-sm font-medium text-white transition-colors hover:bg-teal-dark disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-2 font-body text-xs text-graphite-soft/80">
            This conversation isn&apos;t saved — it disappears once you close this chat or
            leave the page.
          </p>
        </div>
      </div>
    </div>
  );
}
