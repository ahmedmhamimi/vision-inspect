'use client';

import { useState } from 'react';
import type { InspectionReport } from '@/lib/visioninspect/schema';

interface InspectionChatProps {
  report: InspectionReport;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
}

export function InspectionChat({ report }: InspectionChatProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Hello! I am your Inspection Assistant. Ask me anything about this inspection.',
    },
  ]);

  async function sendQuestion() {
    if (!question.trim() || loading) return;

    const userQuestion = question;

    setMessages((previous) => [
      ...previous,
      {
        sender: 'user',
        text: userQuestion,
      },
    ]);

    setQuestion('');
    setLoading(true);

    try {
      const response = await fetch('/api/visioninspect/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          report,
        }),
      });

      const data = await response.json();

      setMessages((previous) => [
        ...previous,
        {
          sender: 'assistant',
          text:
            data.answer ??
            'Sorry, I could not answer your question.',
        },
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          sender: 'assistant',
          text: 'Something went wrong while contacting the assistant.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-tag border border-teal bg-white p-5 sm:p-6">
      <h3 className="font-display text-lg font-medium text-graphite">
        🤖 Inspection Assistant
      </h3>

      <p className="mt-2 text-sm text-graphite-soft">
        Ask questions about this inspection.
      </p>

      <div className="mt-5 space-y-3 max-h-80 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.sender === 'user'
                ? 'text-right'
                : 'text-left'
            }
          >
            <div
              className={
                message.sender === 'user'
                  ? 'inline-block rounded-lg bg-teal px-3 py-2 text-white'
                  : 'inline-block rounded-lg bg-gray-100 px-3 py-2 text-graphite'
              }
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this inspection..."
          className="flex-1 rounded-md border px-3 py-2"
        />

        <button
          onClick={sendQuestion}
          disabled={loading}
          className="rounded-md bg-teal px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}