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
import type { ToolInvocation } from '@/types';
import { cn } from '@/lib/utils';

type SideKickMessage = UIMessage & {
  role: 'user' | 'assistant' | 'system';
  toolInvocations?: ToolInvocation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
          return '[Step start]';
        default: {
          const type = typeof part.type === 'string' ? part.type : '';
          if (type.startsWith('data-')) {
            return '[Data]';
          }
          if (type.startsWith('tool-') && isRecord(part)) {
            const recordPart = part as Record<string, unknown>;
            const toolName = type.slice('tool-'.length) || 'tool';
            const rawState = typeof recordPart.state === 'string' ? (recordPart.state as string) : 'pending';
            if (rawState === 'output-available') {
              return `[Tool ${toolName}: completed]`;
            }
            if (rawState === 'output-error') {
              const errorText = typeof recordPart.errorText === 'string' ? ` – ${recordPart.errorText}` : '';
              return `[Tool ${toolName}: error${errorText}]`;
            }
            return `[Tool ${toolName}: ${rawState}]`;
          }
          return '';
        }
      }
    })
    .filter((segment) => segment.length > 0)
    .join('\n');
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    await sendMessage({ text: trimmedInput });
    setInputValue('');
  };

  const handleStop = () => {
    void stop();
  };

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
            messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="text-5xl mb-4">🚀</div>
                <h2 className="text-3xl font-bold text-white mb-2">Welcome to SideKick</h2>
                <p className="text-lg text-slate-300 max-w-md">
                  Chat with me about any topic. I&apos;ll use specialized skills to help you.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => {
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
                        {message.toolInvocations && message.toolInvocations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-600 space-y-1">
                            {message.toolInvocations.map((tool: ToolInvocation) => (
                              <div key={tool.id} className="text-xs opacity-75">
                                🔧 {tool.toolName} {tool.state === 'output-available' ? '✓' : ''}
                              </div>
                            ))}
                          </div>
                        )}
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
            {isLoading && (
              <button
                type="button"
                onClick={handleStop}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Stop
              </button>
            )}
          </form>
        </div>
      </footer>
    </div>
  );
}
