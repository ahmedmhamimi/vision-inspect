import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { askInspectionAssistant } from '@/lib/visioninspect/chat-service';
import { InspectionReportSchema } from '@/lib/visioninspect/schema';

const ChatRequestSchema = z.object({
  question: z.string().min(1),
  report: InspectionReportSchema,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    const { question, report } = ChatRequestSchema.parse(body);

    const answer = await askInspectionAssistant(report, question);

    return NextResponse.json(
      {
        answer,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[visioninspect:chat]', error);

    return NextResponse.json(
      {
        error: 'Unable to answer your question.',
      },
      { status: 500 },
    );
  }
}