/**
 * chat-service.ts
 * Business logic for the VisionInspect Inspection Assistant.
 * Receives the completed inspection report and the user's question,
 * builds the inspection context, then asks Gemini for an answer.
 */

import type { InspectionReport } from './schema';
import { GeminiChatAdapter } from './adapters/gemini-chat.adapter';

const adapter = new GeminiChatAdapter();

export async function askInspectionAssistant(
  report: InspectionReport,
  question: string,
): Promise<string> {
  const reportContext = `
You are answering questions about this completed smartphone inspection.

Inspection Report

Summary:
${report.summary}

Report ID:
${report.report_id}

Generated:
${new Date(report.generated_at).toLocaleString()}

Important Instructions:

- Answer ONLY using the information from this inspection.
- Explain the inspection in clear, simple language.
- If asked why the defect received its severity, explain using the inspection findings.
- If asked whether the phone is safe to use, answer based only on the inspection.
- If asked about repair recommendations, provide practical advice.
- If asked about repair costs, provide only an approximate cost range and clearly state that prices vary depending on the phone model and repair provider.
- If you cannot determine something from the inspection, say that you cannot determine it instead of guessing.
- Never invent defects that are not present in the inspection report.
- Politely refuse unrelated questions.

`;

  return adapter.ask(question, reportContext);
}