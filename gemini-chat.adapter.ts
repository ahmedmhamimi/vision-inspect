/**
 * gemini-chat.adapter.ts
 * Handles text conversations with Gemini for the Inspection Assistant.
 * Unlike gemini-vision.adapter.ts, this adapter does NOT analyse images.
 * It answers questions using the inspection report as context.
 */

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '@/lib/ai/providers';

const SYSTEM_INSTRUCTION = `
You are VisionInspect's Inspection Assistant.

You answer questions ONLY about a completed smartphone inspection.

Your responsibilities include:
- Explaining the detected defect.
- Explaining the severity.
- Explaining the evidence.
- Giving repair recommendations.
- Giving approximate repair cost ranges.
- Giving safety advice.
- Summarising the inspection.

Never invent defects that are not in the inspection report.

If the user asks something unrelated to the inspection, politely explain that you can only answer questions about the current inspection.

Always make it clear that repair costs are estimates only.
`;

export class GeminiChatAdapter {
  private readonly client: GoogleGenAI;

  constructor(private readonly model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({
      apiKey: getGeminiApiKey(),
    });
  }

  async ask(question: string, reportContext: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `
Inspection Report:

${reportContext}

--------------------------------

User Question:

${question}
              `,
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    return response.text ?? 'Sorry, I could not generate a response.';
  }
}