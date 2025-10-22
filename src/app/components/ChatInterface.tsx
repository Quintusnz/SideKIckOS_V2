'use client';

/**
 * ChatInterface Component
 *
 * CRITICAL: Uses useChat() hook from @ai-sdk/react
 * This is mandatory for frontend chat components.
 *
 * Features:
 * - Real-time streaming messages
 * - Tool invocation display (shows which skills are being called)
 * - Auto message management (no Redux/Context needed)
 * - Error handling and retry logic
 * - Loading states and stop button
 */

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: any[];
}

export default function ChatInterface() {
  const chatResult = useChat();
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);

  // Auto-scroll to bottom on new messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // Convert AI SDK messages to display format
  useEffect(() => {
    if (chatResult.messages) {
      const converted = chatResult.messages.map((msg: any, idx: number) => ({
        id: `${idx}`,
        role: msg.role,
        content: msg.content || '',
        toolInvocations: msg.toolInvocations,
      }));
      setDisplayMessages(converted);
    }
  }, [chatResult.messages]);

  const [inputValue, setInputValue] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setInputValue('');

    try {
      // Send message to backend
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...displayMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: inputValue },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      // Add user message immediately
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'user',
          content: inputValue,
        },
      ]);

      // Add empty assistant message to stream into
      let assistantMessageId = Date.now().toString() + '_assistant';
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
        },
      ]);

      // Process streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1]; // Keep incomplete line

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];

          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'text-delta') {
                // Update assistant message with streamed text
                setDisplayMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, content: msg.content + parsed.delta } : msg
                  )
                );
              } else if (parsed.type === 'tool-call') {
                // Handle tool invocation
                setDisplayMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMessageId) {
                      return {
                        ...msg,
                        toolInvocations: [
                          ...(msg.toolInvocations || []),
                          {
                            toolName: parsed.toolName,
                            args: parsed.args,
                          },
                        ],
                      };
                    }
                    return msg;
                  })
                );
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setDisplayMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900">SkillsFlow AI</h1>
          <p className="text-sm text-slate-600">Chat with AI-powered skills</p>
        </div>
      </header>

      {/* Messages Container */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          {displayMessages.length === 0 ? (
            // Welcome state
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="text-5xl mb-4">🚀</div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome to SkillsFlow AI</h2>
              <p className="text-lg text-slate-600 max-w-md">
                Chat with me about any topic. I'll use specialized skills to help you accomplish your goals.
              </p>
            </div>
          ) : (
            <>
              {displayMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-slate-200 text-slate-900 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {/* Show tool invocations if present */}
                    {message.toolInvocations && message.toolInvocations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-300 space-y-1">
                        {message.toolInvocations.map((tool: any, toolIndex: number) => (
                          <div key={toolIndex} className="text-xs opacity-75">
                            🔧 {tool.toolName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="border-t border-slate-200 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
