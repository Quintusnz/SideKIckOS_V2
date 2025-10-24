/**
 * SideKick Agent Endpoint
 * ---------------------------------------
 * - Receives chat messages from the AI SDK UI useChat hook
 * - Registers available skills as dynamic tools
 * - Streams responses using Vercel AI SDK v5 `streamText`
 * - Returns a UI Message stream response compatible with `@ai-sdk/react`
 */

import { NextRequest } from 'next/server';
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { getSkillRegistry } from '@/lib/skills';
import { getSkillsOrchestrator } from '@/lib/orchestrator';

export const maxDuration = 30;

const DEFAULT_MODEL = 'gpt-5';

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const registry = await getSkillRegistry();
    const orchestrator = getSkillsOrchestrator();
    orchestrator.attachSkillRegistry(registry);

    const skillEntries = registry.getSkillEntries();
    orchestrator.registerSkills(skillEntries);

    const tools = orchestrator.buildToolSet();
    const systemPrompt = orchestrator.buildSystemPrompt();

    const modelId = process.env.AI_MODEL ?? DEFAULT_MODEL;

    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages: convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(10),
      onError: ({ error }) => {
        console.error('Agent stream error:', error);
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (error) => {
        if (error == null) {
          return 'Unknown error occurred.';
        }
        if (typeof error === 'string') {
          return error;
        }
        if (error instanceof Error) {
          return error.message ?? 'An unexpected error occurred.';
        }
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    console.error('Error in POST /api/agent:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
