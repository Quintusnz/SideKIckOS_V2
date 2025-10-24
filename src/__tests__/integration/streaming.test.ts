/**
 * Integration Tests for Streaming
 * Tests real-time message streaming, SSE events, and connection handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

type EventListener = (payload: unknown) => void;

interface StreamEventSequenceItem {
  event: string;
  data: unknown;
  delayMs?: number;
}

interface ToolCallEventPayload {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ToolInvocationState {
  id: string;
  toolName: string;
  state: 'input-available' | 'output-available';
}

type StreamEventRecord =
  | {
      type: 'text-delta';
      data: string;
      timestamp: Date;
    }
  | {
      type: 'tool-call-start';
      data: { toolName: string; input: Record<string, unknown>; id: string };
      timestamp: Date;
    }
  | {
      type: 'tool-result';
      data: { toolId: string; result: unknown };
      timestamp: Date;
    }
  | {
      type: 'stream-end';
      data: { finalMessage: string };
      timestamp: Date;
    }
  | {
      type: 'error';
      data: { error: string };
      timestamp: Date;
    };

function isToolCallEventPayload(value: unknown): value is ToolCallEventPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ToolCallEventPayload> & Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.toolName === 'string' &&
    typeof candidate.args === 'object' &&
    candidate.args !== null &&
    !Array.isArray(candidate.args)
  );
}

/**
 * Mock StreamResponse for testing SSE streaming
 */
class MockStreamResponse {
  private listeners: Map<string, EventListener[]> = new Map();
  private isStreamingActive = false;

  on(event: string, handler: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  emit(event: string, data: unknown): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  async startStreaming(eventSequence: StreamEventSequenceItem[]): Promise<void> {
    this.isStreamingActive = true;

    for (const { event, data, delayMs = 0 } of eventSequence) {
      if (!this.isStreamingActive) break;

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      this.emit(event, data);
    }

    this.isStreamingActive = false;
    this.emit('end', undefined);
  }

  stopStreaming(): void {
    this.isStreamingActive = false;
  }
}

/**
 * Mock useChat hook for testing frontend streaming
 */
class MockUseChat {
  messages: ChatMessage[] = [];
  input = '';
  isLoading = false;
  private messageId = 0;

  handleInputChange(value: string): void {
    this.input = value;
  }

  async handleSubmit(): Promise<void> {
    if (!this.input.trim()) return;

    // Add user message
    this.messages.push({
      id: String(this.messageId++),
      role: 'user',
      content: this.input,
    });

    this.isLoading = true;
    this.input = '';

    // Simulate streaming response
    const assistantMessage: ChatMessage = {
      id: String(this.messageId++),
      role: 'assistant',
      content: '',
    };

    this.messages.push(assistantMessage);

    // Stream chunks
  const chunks: string[] = ['Hello', ' ', 'there', '!'];
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      assistantMessage.content += chunk;
    }

    this.isLoading = false;
  }

  stop(): void {
    this.isLoading = false;
  }

  reload(): void {
    if (this.messages.length > 0) {
      this.messages.pop(); // Remove last assistant message
      this.isLoading = false;
    }
  }
}

/**
 * Streaming event handlers
 */
class StreamEventHandler {
  private events: StreamEventRecord[] = [];
  private messageBuffer = '';
  private toolInvocations: ToolInvocationState[] = [];

  handleTextDelta(delta: string): void {
    this.messageBuffer += delta;
    this.events.push({
      type: 'text-delta',
      data: delta,
      timestamp: new Date(),
    });
  }

  handleToolCall(toolName: string, input: Record<string, unknown>, id: string): void {
    this.toolInvocations.push({
      id,
      toolName,
      state: 'input-available',
    });

    this.events.push({
      type: 'tool-call-start',
      data: { toolName, input, id },
      timestamp: new Date(),
    });
  }

  handleToolResult(toolId: string, result: unknown): void {
    const invocation = this.toolInvocations.find((t) => t.id === toolId);
    if (invocation) {
      invocation.state = 'output-available';
    }

    this.events.push({
      type: 'tool-result',
      data: { toolId, result },
      timestamp: new Date(),
    });
  }

  handleStreamEnd(): void {
    this.events.push({
      type: 'stream-end',
      data: { finalMessage: this.messageBuffer },
      timestamp: new Date(),
    });
  }

  handleError(error: Error): void {
    this.events.push({
      type: 'error',
      data: { error: error.message },
      timestamp: new Date(),
    });
  }

  getEvents(): StreamEventRecord[] {
    return this.events;
  }

  getMessageBuffer(): string {
    return this.messageBuffer;
  }

  getToolInvocations(): ToolInvocationState[] {
    return this.toolInvocations;
  }

  clearBuffer(): void {
    this.messageBuffer = '';
  }
}

describe('Streaming Integration Tests', () => {
  describe('Stream Response', () => {
    it('should emit text-delta events', async () => {
      const stream = new MockStreamResponse();
  const handler = vi.fn<EventListener>();

      stream.on('text-delta', handler);

      await stream.startStreaming([
        { event: 'text-delta', data: 'Hello' },
        { event: 'text-delta', data: ' world' },
      ]);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith('Hello');
      expect(handler).toHaveBeenCalledWith(' world');
    });

    it('should emit tool-call events', async () => {
      const stream = new MockStreamResponse();
  const toolHandler = vi.fn<EventListener>();
  const endHandler = vi.fn<EventListener>();

      stream.on('tool-call', toolHandler);
      stream.on('end', endHandler);

      await stream.startStreaming([
        {
          event: 'tool-call',
          data: {
            id: 'tool-1',
            toolName: 'research',
            args: { query: 'test' },
          },
        },
      ]);

      expect(toolHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
    });

    it('should emit events in correct order', async () => {
      const stream = new MockStreamResponse();
      const eventLog: string[] = [];

      stream.on('text-delta', () => eventLog.push('delta'));
      stream.on('tool-call', () => eventLog.push('tool'));
      stream.on('end', () => eventLog.push('end'));

      await stream.startStreaming([
        { event: 'text-delta', data: 'Start' },
        { event: 'tool-call', data: {} },
        { event: 'text-delta', data: 'End' },
      ]);

      expect(eventLog).toEqual(['delta', 'tool', 'delta', 'end']);
    });

    it('should handle streaming delays', async () => {
      const stream = new MockStreamResponse();
      const startTime = Date.now();

      await stream.startStreaming([
        { event: 'text-delta', data: 'A', delayMs: 100 },
        { event: 'text-delta', data: 'B', delayMs: 100 },
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(150);
    });

    it('should stop streaming on command', async () => {
      const stream = new MockStreamResponse();
  const handler = vi.fn<EventListener>();
  const endHandler = vi.fn<EventListener>();

      stream.on('text-delta', handler);
      stream.on('end', endHandler);

      const streamPromise = stream.startStreaming([
        { event: 'text-delta', data: 'A' },
        { event: 'text-delta', data: 'B', delayMs: 100 },
        { event: 'text-delta', data: 'C', delayMs: 100 },
      ]);

      setTimeout(() => stream.stopStreaming(), 50);
      await streamPromise;

      // Should have stopped before all events
      expect(handler.mock.calls.length).toBeLessThan(3);
    });
  });

  describe('useChat Hook', () => {
    it('should initialize with empty messages', () => {
      const chat = new MockUseChat();

      expect(chat.messages).toEqual([]);
      expect(chat.input).toBe('');
      expect(chat.isLoading).toBe(false);
    });

    it('should handle input change', () => {
      const chat = new MockUseChat();

      chat.handleInputChange('Test message');

      expect(chat.input).toBe('Test message');
    });

    it('should add user message and stream response', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('Hello');
      await chat.handleSubmit();

      expect(chat.messages).toHaveLength(2);
      expect(chat.messages[0].role).toBe('user');
      expect(chat.messages[0].content).toBe('Hello');
      expect(chat.messages[1].role).toBe('assistant');
      expect(chat.messages[1].content).toBe('Hello there!');
    });

    it('should clear input after submission', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('Test');
      await chat.handleSubmit();

      expect(chat.input).toBe('');
    });

    it('should set loading state during streaming', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('Test');
      const submitPromise = chat.handleSubmit();

      expect(chat.isLoading).toBe(true);

      await submitPromise;

      expect(chat.isLoading).toBe(false);
    });

    it('should handle multiple messages', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('First');
      await chat.handleSubmit();

      chat.handleInputChange('Second');
      await chat.handleSubmit();

      expect(chat.messages).toHaveLength(4);
      expect(chat.messages[0].content).toBe('First');
      expect(chat.messages[2].content).toBe('Second');
    });

    it('should stop streaming', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('Test');
      chat.handleSubmit(); // Don't await

      chat.stop();

      expect(chat.isLoading).toBe(false);
    });

    it('should reload last message', async () => {
      const chat = new MockUseChat();

      chat.handleInputChange('First');
      await chat.handleSubmit();

      const messagesBefore = chat.messages.length;
      chat.reload();
      const messagesAfter = chat.messages.length;

      expect(messagesAfter).toBe(messagesBefore - 1);
    });
  });

  describe('Stream Event Handling', () => {
    let handler: StreamEventHandler;

    beforeEach(() => {
      handler = new StreamEventHandler();
    });

    it('should accumulate text deltas', () => {
      handler.handleTextDelta('Hello');
      handler.handleTextDelta(' ');
      handler.handleTextDelta('world');

      expect(handler.getMessageBuffer()).toBe('Hello world');
    });

    it('should track tool invocations', () => {
      handler.handleToolCall('research', { query: 'test' }, 'tool-1');
      handler.handleToolCall('summarize', { content: 'data' }, 'tool-2');

      const invocations = handler.getToolInvocations();
      expect(invocations).toHaveLength(2);
      expect(invocations[0].toolName).toBe('research');
      expect(invocations[1].toolName).toBe('summarize');
    });

    it('should update tool state on result', () => {
      handler.handleToolCall('research', { query: 'test' }, 'tool-1');
      handler.handleToolResult('tool-1', { findings: 'result' });

      const invocations = handler.getToolInvocations();
      expect(invocations[0].state).toBe('output-available');
    });

    it('should record stream events with timestamps', () => {
      handler.handleTextDelta('Hello');
      handler.handleToolCall('research', {}, 'tool-1');
      handler.handleStreamEnd();

      const events = handler.getEvents();
      expect(events).toHaveLength(3);
      events.forEach((event) => {
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should record error events', () => {
      const error = new Error('Stream error');
      handler.handleError(error);

      const events = handler.getEvents();
      const firstEvent = events[0];
      expect(firstEvent?.type).toBe('error');
      if (firstEvent?.type === 'error') {
        expect(firstEvent.data.error).toBe('Stream error');
      }
    });

    it('should clear message buffer', () => {
      handler.handleTextDelta('Message 1');
      handler.clearBuffer();
      handler.handleTextDelta('Message 2');

      expect(handler.getMessageBuffer()).toBe('Message 2');
    });

    it('should handle complex streaming sequence', () => {
      handler.handleTextDelta('Research found: ');
      handler.handleToolCall('research', { query: 'renewable energy' }, 'tool-1');
      handler.handleToolResult('tool-1', { findings: 'Solar is growing' });
      handler.handleTextDelta('Solar energy is growing rapidly. ');
      handler.handleToolCall('summarize', { content: 'Solar is growing' }, 'tool-2');
      handler.handleToolResult('tool-2', { summary: 'Solar growth' });
      handler.handleTextDelta('Summary: Solar growth');
      handler.handleStreamEnd();

      const events = handler.getEvents();
      expect(events).toHaveLength(8);

      const toolCalls = handler.getToolInvocations();
      expect(toolCalls).toHaveLength(2);
      toolCalls.forEach((call) => {
        expect(call.state).toBe('output-available');
      });

      expect(handler.getMessageBuffer()).toContain('Solar energy is growing');
    });
  });

  describe('Error Handling in Streams', () => {
    it('should handle stream errors gracefully', async () => {
      const stream = new MockStreamResponse();
      const errorHandler = vi.fn();
      const endHandler = vi.fn();

      stream.on('error', errorHandler);
      stream.on('end', endHandler);

      await stream.startStreaming([
        { event: 'text-delta', data: 'Hello' },
        { event: 'error', data: { message: 'Connection lost' } },
      ]);

      expect(errorHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
    });

    it('should recover from partial message', async () => {
      const handler = new StreamEventHandler();

      handler.handleTextDelta('Part 1');
      handler.handleError(new Error('Interrupted'));
      handler.handleTextDelta('Part 2');

      expect(handler.getMessageBuffer()).toBe('Part 1Part 2');
      const events = handler.getEvents();
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });

    it('should handle tool execution errors', () => {
      const handler = new StreamEventHandler();

      handler.handleToolCall('research', {}, 'tool-1');
      handler.handleError(new Error('Skill failed'));

      const events = handler.getEvents();
      expect(events.some((e) => e.type === 'error')).toBe(true);
    });
  });

  describe('Real-time Updates', () => {
    it('should update UI as events arrive', async () => {
      const handler = new StreamEventHandler();
      const uiUpdates: string[] = [];

      const stream = new MockStreamResponse();

      stream.on('text-delta', (delta) => {
        if (typeof delta === 'string') {
          handler.handleTextDelta(delta);
          uiUpdates.push(`display: ${handler.getMessageBuffer()}`);
        }
      });

      stream.on('tool-call', (data) => {
        if (isToolCallEventPayload(data)) {
          handler.handleToolCall(data.toolName, data.args, data.id);
          uiUpdates.push(`show-tool: ${data.toolName}`);
        }
      });

      await stream.startStreaming([
        { event: 'text-delta', data: 'Hello' },
        { event: 'tool-call', data: { toolName: 'research', args: {}, id: '1' } },
        { event: 'text-delta', data: ' world' },
      ]);

      expect(uiUpdates).toHaveLength(3);
      expect(uiUpdates[0]).toContain('Hello');
      expect(uiUpdates[1]).toContain('research');
      expect(uiUpdates[2]).toContain('Hello world');
    });

    it('should maintain message order during concurrent updates', async () => {
      const handler = new StreamEventHandler();
      const deltas: string[] = [];

      handler.handleTextDelta('A');
      handler.handleTextDelta('B');
      handler.handleTextDelta('C');

      const events = handler.getEvents();
      events.forEach((e) => {
        if (e.type === 'text-delta') {
          deltas.push(e.data);
        }
      });

      expect(deltas).toEqual(['A', 'B', 'C']);
    });
  });

  describe('Connection Management', () => {
    it('should detect connection loss', async () => {
      const stream = new MockStreamResponse();
      const errorHandler = vi.fn();

      stream.on('error', errorHandler);

      const streamPromise = stream.startStreaming([
        { event: 'text-delta', data: 'Hello' },
        { event: 'error', data: { message: 'Connection lost' } },
      ]);

      await streamPromise;

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Connection lost' })
      );
    });

    it('should allow reconnection after error', async () => {
      const stream = new MockStreamResponse();
      const handlers: string[] = [];

      stream.on('text-delta', (data) => {
        if (typeof data === 'string') {
          handlers.push(data);
        }
      });

      // First attempt with error
      await stream.startStreaming([
        { event: 'text-delta', data: 'First' },
        { event: 'error', data: {} },
      ]);

      // Reconnect
      const newStream = new MockStreamResponse();
      newStream.on('text-delta', (data) => {
        if (typeof data === 'string') {
          handlers.push(data);
        }
      });

      await newStream.startStreaming([{ event: 'text-delta', data: 'Second' }]);

      expect(handlers).toEqual(['First', 'Second']);
    });

    it('should timeout on idle connection', async () => {
      const stream = new MockStreamResponse();
      const timeoutMs = 1000;

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          stream.stopStreaming();
          resolve('timeout');
        }, timeoutMs);
      });

      const streamPromise = stream.startStreaming([
        { event: 'text-delta', data: 'Hello', delayMs: 2000 },
      ]);

      const result = await Promise.race([streamPromise, timeoutPromise]);

      expect(result).toBe('timeout');
    });
  });
});
