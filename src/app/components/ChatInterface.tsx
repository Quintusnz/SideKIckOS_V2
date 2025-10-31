'use client';

import React, {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import ThinkingBar from '@/app/components/ThinkingBar';
import ThinkingDetails from '@/app/components/ThinkingDetails';
import { useActivityStore } from '@/app/components/useActivityStore';
import type { ToolInvocation } from '@/types';
import {
  isActivityDoneMessage,
  isActivityMessage,
  isActivityUpdateMessage,
} from '@/types';
import { cn } from '@/lib/utils';

type SideKickMessage = UIMessage & {
  role: 'user' | 'assistant' | 'system';
  toolInvocations?: ToolInvocation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type LegacyStage = 'tool.call' | 'tool.result' | 'tool.error';

function makeLegacyStageKey(activityId: string, stage: LegacyStage, identifier: string): string {
  return `${activityId}:${stage}:${identifier}`;
}

function normalizeLegacyIdentifier(identifier: string | undefined, fallback: string): string {
  const source = identifier && identifier.trim().length > 0 ? identifier.trim() : fallback;
  return source.toLowerCase();
}

function extractMessageText(parts: SideKickMessage['parts']): string {
  return parts
    .map((part) => {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          return part.text;
        case 'dynamic-tool':
          return `[Dynamic tool: ${part.toolName}]`;
        case 'source-url':
          return `[Source: ${part.title ?? part.url}]`;
        case 'source-document':
          return `[Document: ${part.title}]`;
        case 'file':
          return `[File: ${part.filename ?? part.mediaType}]`;
        case 'step-start':
          return '';
        default: {
          const type = typeof part.type === 'string' ? part.type : '';
          if (type.startsWith('data-')) {
            return '[Data]';
          }
          if (type.startsWith('tool-') && isRecord(part)) {
            const recordPart = part as Record<string, unknown>;
            const toolName = type.slice('tool-'.length) || 'tool';
            const rawState = typeof recordPart.state === 'string' ? (recordPart.state as string) : 'pending';
            if (rawState === 'output-error') {
              const errorText = typeof recordPart.errorText === 'string' ? ` – ${recordPart.errorText}` : '';
              return `[Tool ${toolName}: error${errorText}]`;
            }
            return '';
          }
          return '';
        }
      }
    })
    .filter((segment) => segment.length > 0)
    .join('\n');
}

function truncateSummary(summary: string, maxLength = 140): string {
  if (summary.length <= maxLength) {
    return summary;
  }
  return `${summary.slice(0, maxLength - 1)}…`;
}

function deriveInvocationSummary(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return truncateSummary(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const firstText = value.find((item) => typeof item === 'string') as string | undefined;
    if (firstText) {
      return truncateSummary(firstText);
    }
    return undefined;
  }

  if (typeof value === 'object') {
    const candidate = value as {
      summary?: unknown;
      text?: unknown;
      content?: unknown;
      message?: unknown;
    };

    if (typeof candidate.summary === 'string') {
      return truncateSummary(candidate.summary);
    }
    if (typeof candidate.text === 'string') {
      return truncateSummary(candidate.text);
    }
    if (typeof candidate.content === 'string') {
      return truncateSummary(candidate.content);
    }
    if (typeof candidate.message === 'string') {
      return truncateSummary(candidate.message);
    }
  }

  return undefined;
}

type ChatInterfaceProps = {
  className?: string;
};

export default function ChatInterface(props?: ChatInterfaceProps) {
  const className = props?.className;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'canvas'>('chat');

  const transport = useMemo(
    () => new DefaultChatTransport<SideKickMessage>({ api: '/api/agent' }),
    [],
  );
  const { messages, sendMessage, status, stop } = useChat<SideKickMessage>({
    transport,
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const ingestActivityMessage = useActivityStore((state) => state.ingestActivityMessage);
  const ingestActivityUpdate = useActivityStore((state) => state.ingestActivityUpdate);
  const ingestActivityDone = useActivityStore((state) => state.ingestActivityDone);
  const markError = useActivityStore((state) => state.markError);
  const resetActivityState = useActivityStore((state) => state.reset);
  const markBlockedStatus = useActivityStore((state) => state.markBlocked);
  const currentActivityId = useActivityStore((state) => state.currentActivityId);
  const activityStatus = useActivityStore((state) => state.status);
  const processedActivityMessagesRef = useRef(new Set<string>());
  const processedUserMessagesRef = useRef(new Set<string>());
  const processedLegacyEventsRef = useRef(new Set<string>());
  const processedLegacyStagesRef = useRef(new Set<string>());
  const legacyStageEventIdRef = useRef(new Map<string, string>());
  const syntheticActivityIdRef = useRef<string | null>(null);
  const syntheticActivityStartRef = useRef<number | null>(null);
  const lastUserMessageIdRef = useRef<string | null>(null);
  const hasNativeActivityRef = useRef(false);
  const completionActivityRef = useRef<string | null>(null);
  const lastUserPromptRef = useRef<string | null>(null);
  const syntheticStepsRef = useRef({ planning: false, searching: false, summarizing: false });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ensureSyntheticActivity = (sourceId: string): string => {
      let activityId = syntheticActivityIdRef.current;
      if (!activityId) {
        activityId = `synthetic-${sourceId}`;
        syntheticActivityIdRef.current = activityId;
        syntheticActivityStartRef.current = Date.now();
        ingestActivityMessage({
          role: 'assistant',
          id: activityId,
          type: 'activity',
          activity: {
            title: 'Agent Run',
            status: 'thinking',
            label: 'Thinking…',
            startedAt: new Date().toISOString(),
          },
        });
      }
      return activityId;
    };

    const processLegacyToolInvocation = (activityId: string, invocation: ToolInvocation) => {
      const baseKey = `${activityId}:${invocation.id}:${invocation.state}`;
      if (processedLegacyEventsRef.current.has(baseKey)) {
        return;
      }
      processedLegacyEventsRef.current.add(baseKey);

      const stage: LegacyStage = invocation.state === 'input-available' ? 'tool.call' : 'tool.result';
      const identifier = normalizeLegacyIdentifier(invocation.id, invocation.toolName);
      const stageKey = makeLegacyStageKey(activityId, stage, identifier);
      const stageAlreadyProcessed = processedLegacyStagesRef.current.has(stageKey);
      let eventId = legacyStageEventIdRef.current.get(stageKey);
      if (!eventId) {
        const suffix = stage === 'tool.call' ? 'call' : 'result';
        eventId = `${baseKey}:${suffix}`;
        legacyStageEventIdRef.current.set(stageKey, eventId);
      }

      if (stage === 'tool.call') {
        if (stageAlreadyProcessed) {
          return;
        }

        processedLegacyStagesRef.current.add(stageKey);
        ingestActivityUpdate({
          role: 'assistant',
          id: eventId,
          type: 'activity.update',
          activityId,
          update: {
            kind: 'tool.call',
            name: invocation.toolName,
            args: invocation.args,
          },
        });
        return;
      }

      const derivedSummary = deriveInvocationSummary(invocation.result);
      if (stageAlreadyProcessed && !derivedSummary) {
        return;
      }

      processedLegacyStagesRef.current.add(stageKey);
      ingestActivityUpdate({
        role: 'assistant',
        id: eventId,
        type: 'activity.update',
        activityId,
        update: {
          kind: 'tool.result',
          name: invocation.toolName,
          summary: derivedSummary,
        },
      });
    };

    const processLegacyToolPart = (
      activityId: string,
      messageId: string,
      part: Record<string, unknown>,
      index: number,
    ) => {
      const typeValue = typeof part.type === 'string' ? (part.type as string) : '';
      if (!typeValue.startsWith('tool-')) {
        return;
      }

      const rawState = typeof part.state === 'string' ? (part.state as string) : '';
      const toolName = typeValue.slice('tool-'.length) || 'tool';
      const eventKey = `${activityId}:${messageId}:${index}:${rawState}`;
      if (processedLegacyEventsRef.current.has(eventKey)) {
        return;
      }
      processedLegacyEventsRef.current.add(eventKey);

      let stage: LegacyStage | undefined;
      if (rawState === 'input-available') {
        stage = 'tool.call';
      } else if (rawState === 'output-available') {
        stage = 'tool.result';
      } else if (rawState === 'output-error') {
        stage = 'tool.error';
      }

      if (!stage) {
        return;
      }

      const toolCallId = typeof part.toolCallId === 'string' ? (part.toolCallId as string) : undefined;
      const identifier = normalizeLegacyIdentifier(toolCallId, toolName);
      const stageKey = makeLegacyStageKey(activityId, stage, identifier);
      const stageAlreadyProcessed = processedLegacyStagesRef.current.has(stageKey);

      let eventId = legacyStageEventIdRef.current.get(stageKey);
      if (!eventId) {
        const suffix = stage === 'tool.call' ? 'call' : stage === 'tool.result' ? 'result' : 'error';
        eventId = `${eventKey}:${suffix}`;
        legacyStageEventIdRef.current.set(stageKey, eventId);
      }

      if (stage === 'tool.call') {
        if (stageAlreadyProcessed) {
          return;
        }

        processedLegacyStagesRef.current.add(stageKey);
        ingestActivityUpdate({
          role: 'assistant',
          id: eventId,
          type: 'activity.update',
          activityId,
          update: {
            kind: 'tool.call',
            name: toolName,
          },
        });
        return;
      }

      if (stage === 'tool.result') {
        const summary = typeof part.summary === 'string' ? truncateSummary(part.summary as string) : undefined;
        if (stageAlreadyProcessed && !summary) {
          return;
        }

        processedLegacyStagesRef.current.add(stageKey);
        ingestActivityUpdate({
          role: 'assistant',
          id: eventId,
          type: 'activity.update',
          activityId,
          update: {
            kind: 'tool.result',
            name: toolName,
            summary,
          },
        });
        return;
      }

      const errorText = typeof part.errorText === 'string' ? (part.errorText as string) : undefined;
      if (stageAlreadyProcessed && !errorText) {
        return;
      }

      processedLegacyStagesRef.current.add(stageKey);
      ingestActivityUpdate({
        role: 'assistant',
        id: eventId,
        type: 'activity.update',
        activityId,
        update: {
          kind: 'error',
          text: errorText ?? `Tool ${toolName} failed`,
        },
      });
    };

    for (const message of messages) {
      if (message.role === 'user') {
        if (!processedUserMessagesRef.current.has(message.id)) {
          processedUserMessagesRef.current.add(message.id);
          lastUserPromptRef.current = extractMessageText(message.parts);
          processedActivityMessagesRef.current.clear();
          processedLegacyEventsRef.current.clear();
          processedLegacyStagesRef.current.clear();
          legacyStageEventIdRef.current.clear();
          syntheticActivityIdRef.current = null;
          syntheticActivityStartRef.current = null;
          lastUserMessageIdRef.current = message.id;
          hasNativeActivityRef.current = false;
          completionActivityRef.current = null;
          syntheticStepsRef.current = { planning: false, searching: false, summarizing: false };
          resetActivityState();
        }
        continue;
      }

      if (isActivityMessage(message)) {
        processedActivityMessagesRef.current.add(message.id);
        hasNativeActivityRef.current = true;
        processedLegacyEventsRef.current.clear();
        processedLegacyStagesRef.current.clear();
        legacyStageEventIdRef.current.clear();
        syntheticActivityIdRef.current = message.id;
        syntheticActivityStartRef.current = Date.parse(message.activity.startedAt) || Date.now();
        completionActivityRef.current = null;
        resetActivityState();
        ingestActivityMessage(message);
        continue;
      }

      if (isActivityUpdateMessage(message)) {
        processedActivityMessagesRef.current.add(message.id);
        ingestActivityUpdate(message);
        continue;
      }

      if (isActivityDoneMessage(message)) {
        processedActivityMessagesRef.current.add(message.id);
        completionActivityRef.current = message.activityId;
        ingestActivityDone(message);
        continue;
      }

      if (message.role !== 'assistant' || hasNativeActivityRef.current) {
        continue;
      }

      const activityId = ensureSyntheticActivity(lastUserMessageIdRef.current ?? message.id);

      if (Array.isArray(message.toolInvocations)) {
        for (const invocation of message.toolInvocations) {
          processLegacyToolInvocation(activityId, invocation);
        }
      }

      if (Array.isArray(message.parts)) {
        message.parts.forEach((part, index) => {
          if (isRecord(part)) {
            processLegacyToolPart(activityId, message.id, part, index);
          }
          if (
            (part.type === "text" || part.type === "reasoning") &&
            typeof part.text === "string" &&
            part.text.trim().length > 0
          ) {
            startSummarizingStep(activityId, "Drafting response…");
          }
        });
      }
    }
  }, [
    ingestActivityDone,
    ingestActivityMessage,
    ingestActivityUpdate,
    messages,
    resetActivityState,
  ]);

  useEffect(() => {
    if (status === 'error') {
      markError('Something went wrong');
    }
  }, [markError, status]);

  useEffect(() => {
    if (!isLoading && status !== 'error' && currentActivityId) {
      if (
        activityStatus !== 'done' &&
        activityStatus !== 'error' &&
        activityStatus !== 'blocked' &&
        completionActivityRef.current !== currentActivityId
      ) {
        const durationMs =
          syntheticActivityStartRef.current !== null
            ? Math.max(0, Date.now() - syntheticActivityStartRef.current)
            : undefined;

        ingestActivityDone({
          role: 'assistant',
          id: `synthetic-done-${currentActivityId}-${Date.now()}`,
          type: 'activity.done',
          activityId: currentActivityId,
          durationMs,
        });

        syntheticActivityStartRef.current = null;
        completionActivityRef.current = currentActivityId;
      }
    }

    if (status === 'streaming' || status === 'submitted') {
      completionActivityRef.current = null;
    }
  }, [activityStatus, currentActivityId, ingestActivityDone, isLoading, status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['input', 'textarea'].includes(target.tagName.toLowerCase())) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      if (event.key === '1') {
        setActiveView('chat');
      } else if (event.key === '2') {
        setActiveView('canvas');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) {
      return;
    }

    lastUserPromptRef.current = trimmedInput;
    await sendMessage({ text: trimmedInput });
    setInputValue('');
  };

  const handleStop = () => {
    markBlockedStatus('Stopped');
    void stop();
  };

  const handleRetry = () => {
    resetActivityState();
    processedActivityMessagesRef.current.clear();
    processedLegacyEventsRef.current.clear();
    processedLegacyStagesRef.current.clear();
    legacyStageEventIdRef.current.clear();
    syntheticActivityIdRef.current = null;
    syntheticActivityStartRef.current = null;
    completionActivityRef.current = null;
    hasNativeActivityRef.current = false;
    const retryPrompt = lastUserPromptRef.current?.trim();
    if (retryPrompt) {
      void sendMessage({ text: retryPrompt });
    }
  };

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !isActivityMessage(message) &&
          !isActivityUpdateMessage(message) &&
          !isActivityDoneMessage(message),
      ),
    [messages],
  );

  return (
    <div
      className={cn(
        'flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg',
        className,
      )}
    >
      <div className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 rounded-full bg-slate-800 p-1 text-sm text-slate-300">
            <button
              type="button"
              onClick={() => setActiveView('chat')}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-1 transition-colors',
                activeView === 'chat'
                  ? 'bg-blue-600 text-white shadow'
                  : 'hover:bg-slate-700/80',
              )}
            >
              <span>Chat</span>
              <span className="hidden text-xs font-medium opacity-80 sm:inline">⌘1</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('canvas')}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-1 transition-colors',
                activeView === 'canvas'
                  ? 'bg-blue-600 text-white shadow'
                  : 'hover:bg-slate-700/80',
              )}
            >
              <span>Canvas</span>
              <span className="hidden text-xs font-medium opacity-80 sm:inline">⌘2</span>
            </button>
          </div>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          {activeView === 'chat' ? (
            visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="text-5xl mb-4">🚀</div>
                <h2 className="text-3xl font-bold text-white mb-2">Welcome to SideKick</h2>
                <p className="text-lg text-slate-300 max-w-md">
                  Chat with me about any topic. I&apos;ll use specialized skills to help you.
                </p>
              </div>
            ) : (
              <>
                {visibleMessages.map((message) => {
                  const textContent = extractMessageText(message.parts);
                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-2xl px-4 py-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-white rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {textContent}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 px-4 py-3 rounded-lg rounded-bl-none">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )
          ) : (
            <div className="flex h-96 items-center justify-center gap-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 text-center text-slate-300">
              <div>
                <h3 className="text-2xl font-semibold text-white">Canvas Workspace</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Orchestrator outputs will appear here. Switch back to Chat with the toggle or ⌘1.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      <div className="px-6 pb-4">
        <ThinkingBar onStop={handleStop} onRetry={handleRetry} />
      </div>
      <footer className="border-t border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 border border-slate-600 bg-slate-800 text-white rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </footer>
      <ThinkingDetails />
    </div>
  );
}
