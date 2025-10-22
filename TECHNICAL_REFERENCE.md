# SkillsFlow AI - Technical Reference Guide

**Purpose:** Provide detailed technical implementation references for developers  
**Last Updated:** October 22, 2025

---

## 📚 Table of Contents

1. [Vercel AI SDK v5 Fundamentals](#vercel-ai-sdk-v5-fundamentals)
2. [Next.js 15 Architecture](#nextjs-15-architecture)
3. [Tool Calling & Agents](#tool-calling--agents)
4. [Streaming Implementation](#streaming-implementation)
5. [Common Patterns & Solutions](#common-patterns--solutions)

---

## ⭐ Vercel AI SDK v5 Fundamentals

### ⚠️ CRITICAL: TWO PARTS TO THE AI SDK

The **Vercel AI SDK** has TWO distinct parts you need to understand:

1. **AI SDK Core** (`ai` package)
   - Low-level functions: `generateText()`, `streamText()`, `tool()`
   - Used in BACKEND (server-side)
   - Direct model interaction

2. **AI SDK UI** (`@ai-sdk/react` package) ⭐⭐⭐
   - High-level React hooks: `useChat()`, `useCompletion()`, `useObject()`
   - Used in FRONTEND (client-side)
   - **THIS IS REQUIRED FOR SKILLSFLOW AI FRONTEND**

### What is the AI SDK?

The **Vercel AI SDK** is a TypeScript toolkit that abstracts AI model provider differences (OpenAI, Anthropic, Google, etc.) behind a unified API. It handles:
- Text generation
- Structured object generation
- Tool calling (function calling)
- Agent orchestration
- Streaming responses
- **Chat UI hooks (via @ai-sdk/react)** ⭐

### Key Modules

#### 1. Core: `generateText()`

Use when you need simple text responses without tool calling.

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-5'),
  prompt: 'What is the capital of France?',
});

console.log(text); // "The capital of France is Paris."
```

#### 2. Core: `tool()` - Define Tools

Tools are functions that the AI can call. Define them before passing to the model.

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const getWeather = tool({
  description: 'Get weather for a city',
  parameters: z.object({
    location: z.string().describe('City name'),
    unit: z.enum(['C', 'F']).default('C'),
  }),
  execute: async ({ location, unit }) => {
    // Call weather API
    const weather = await fetchWeatherAPI(location);
    return `${location}: ${weather.temp}°${unit}`;
  },
});
```

#### 3. Core: `generateText()` with Tools (Tool Calling Loop)

The model can request to call tools, and we execute them and loop back.

```typescript
import { generateText } from 'ai';
import { tool } from 'ai';

let response = await generateText({
  model: openai('gpt-5'),
  tools: {
    getWeather,
  },
  messages: [
    { role: 'user', content: 'What is the weather in NYC?' },
  ],
});

// response.text contains the final answer
// AI SDK automatically handled tool calling internally
```

#### 4. Core: `streamText()` - Streaming Responses

Returns an async generator for real-time output.

```typescript
import { streamText } from 'ai';

const stream = await streamText({
  model: openai('gpt-5'),
  prompt: 'Write a poem about coding',
});

for await (const chunk of stream.textStream) {
  console.log(chunk); // Print chunks as they arrive
}
```

#### 5. UI Hook: `useChat()` - React Hook for Chat ⭐ CRITICAL FOR FRONTEND

**This is the CORE of the SkillsFlow AI frontend. You MUST use this hook.**

Manages chat state, sending messages, streaming responses, and tool invocations automatically.

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export function ChatComponent() {
  const {
    messages,              // Array of Message objects
    input,                 // Current input text
    handleInputChange,     // Handler for input changes
    handleSubmit,          // Handler for form submission
    isLoading,             // Is AI generating?
    stop,                  // Stop generation
    reload,                // Retry last message
    append,                // Append message manually
    setMessages,           // Set messages manually
  } = useChat({
    api: '/api/agent',     // Your API endpoint (must stream SSE)
    maxSteps: 10,          // Max tool calls before stopping
    onResponse: (response) => {
      // Optional: Monitor streaming
      console.log('Response:', response);
    },
    onError: (error) => {
      // Optional: Handle errors
      console.error('Error:', error);
    },
    onFinish: (message) => {
      // Optional: Called when generation completes
      console.log('Done:', message);
    },
  });

  return (
    <div>
      {/* Display all messages */}
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong>
          <p>{m.content}</p>

          {/* Display tool invocations if any */}
          {m.toolInvocations?.map((tool) => (
            <div key={tool.id}>
              Tool: {tool.toolName}
              State: {tool.state}
            </div>
          ))}
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && <p>AI is thinking...</p>}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
        {isLoading && <button type="button" onClick={() => stop()}>Stop</button>}
      </form>
    </div>
  );
}
```

**Key Properties of Messages:**
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocation[]; // Populated when AI calls tools
  toolResults?: ToolResult[];          // Results from tool calls
}

interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, any>;
  state: 'input-available' | 'output-available';
  result?: any;
}
```

**Why `useChat()` is Critical:**
✅ Automatic streaming handling (SSE)
✅ Message state management
✅ Tool invocation tracking
✅ Loading/error states
✅ Automatic retry logic
✅ Seamless UI updates

---

## Next.js 15 Architecture

### App Router (Not Pages Router)

Next.js 15 uses the **App Router** (in `/app` directory):
- File-based routing
- Server Components by default
- Built-in data fetching
- Streaming support

### File Structure

```
app/
├── layout.tsx          # Root layout (rendered on every page)
├── page.tsx            # Home page (/)
├── api/
│   └── chat/
│       └── route.ts    # POST /api/chat endpoint
└── components/
    └── ChatUI.tsx      # Client component
```

### Server vs. Client Components

```typescript
// Server Component (default) - has access to secrets, databases
export default async function Page() {
  const data = await fetch('private-api'); // OK on server
  return <div>{data}</div>;
}

// Client Component - runs in browser, can use hooks
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### API Routes (Route Handlers)

Create endpoints under `app/api/`:

```typescript
// app/api/agent/route.ts
export async function POST(request: Request) {
  const { messages } = await request.json();

  // Process and respond
  const response = await generateText({ /* ... */ });

  return Response.json({ text: response });
}

export async function GET() {
  return Response.json({ message: 'Hello' });
}
```

### Streaming Responses

Return Server-Sent Events (SSE) for real-time updates:

```typescript
// app/api/stream/route.ts
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue('data: {"message":"First"}\n\n');
      await new Promise(r => setTimeout(r, 1000));
      controller.enqueue('data: {"message":"Second"}\n\n');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### Environment Variables

```env.local
# Automatically available on server and client (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Server-only (not exposed to client)
OPENAI_API_KEY=sk_...
DATABASE_URL=postgres://...
```

Access in code:
```typescript
// Server-side
const apiKey = process.env.OPENAI_API_KEY;

// Client-side (must use NEXT_PUBLIC_ prefix)
const url = process.env.NEXT_PUBLIC_API_URL;
```

---

## Tool Calling & Agents

### What is Tool Calling?

Tool calling (aka "function calling") allows AI models to request execution of predefined functions.

**Flow:**
1. User: "What's the weather?"
2. AI: "I'll use the `getWeather` tool"
3. AI returns: `{ tool: "getWeather", args: { location: "NYC" } }`
4. App: Executes tool, returns result to AI
5. AI: Processes result and generates final response

### Simple Tool Example

```typescript
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const calculatePrice = tool({
  description: 'Calculate total price including tax',
  parameters: z.object({
    subtotal: z.number().describe('Price before tax'),
    taxRate: z.number().describe('Tax rate (e.g., 0.08 for 8%)'),
  }),
  execute: async ({ subtotal, taxRate }) => {
    const tax = subtotal * taxRate;
    return { subtotal, tax, total: subtotal + tax };
  },
});

const response = await generateText({
  model: openai('gpt-5'),
  tools: {
    calculatePrice,
  },
  messages: [
    { role: 'user', content: 'Calculate total for $100 with 8% tax' },
  ],
  maxSteps: 5, // Allow up to 5 tool calls
});
```

### Multi-Tool Orchestration

```typescript
const tools = {
  webSearch: tool({
    description: 'Search the web',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      return await searchWeb(query);
    },
  }),

  summarize: tool({
    description: 'Summarize text',
    parameters: z.object({ text: z.string() }),
    execute: async ({ text }) => {
      return await summarizeText(text);
    },
  }),

  generateReport: tool({
    description: 'Generate a report',
    parameters: z.object({ data: z.array(z.string()) }),
    execute: async ({ data }) => {
      return generateReport(data);
    },
  }),
};

const result = await generateText({
  model: openai('gpt-5'),
  tools,
  prompt: 'Research AI trends and generate a report',
  maxSteps: 10,
});
```

### Agent Pattern (for SkillsFlow)

```typescript
class SkillAgent {
  async orchestrate(userMessage: string) {
    const skillTools = this.buildToolsFromSkills();

    const response = await generateText({
      model: openai('gpt-5'),
      system: `
You are an intelligent agent with access to various skills.
Available skills: ${this.skills.map(s => s.name).join(', ')}
Choose the most appropriate skill or combination of skills for the user's request.
      `,
      tools: skillTools,
      messages: [
        { role: 'user', content: userMessage },
      ],
      maxSteps: 20,
    });

    return response.text;
  }

  private buildToolsFromSkills() {
    const tools = {};

    for (const skill of this.skills) {
      tools[skill.name] = tool({
        description: skill.description,
        parameters: skill.inputSchema,
        execute: async (params) => {
          return await skill.execute(params);
        },
      });
    }

    return tools;
  }
}
```

---

## Streaming Implementation

### Why Streaming Matters

For SkillsFlow AI, users expect **real-time feedback**:
- See when skills are being invoked
- Watch progress of multi-step workflows
- Receive output chunks as they're ready

### Server-Sent Events (SSE) for Streaming

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = streamText({
    model: openai('gpt-5'),
    messages,
    system: 'You are a helpful assistant.',
  });

  // Return SSE response
  return stream.toTextStreamResponse();
}
```

### Client-Side Streaming (React)

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatUI() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} className={m.role === 'user' ? 'user' : 'assistant'}>
          {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Custom Event Streaming

For more complex data (like workflow progress), emit custom events:

```typescript
// Server
const encoder = new TextEncoder();

const stream = new ReadableStream({
  async start(controller) {
    // Event 1: Workflow started
    controller.enqueue(
      encoder.encode('event: workflow_started\ndata: {"id":"wf-123"}\n\n')
    );

    // Event 2: Step executed
    controller.enqueue(
      encoder.encode('event: step_completed\ndata: {"step":"research","duration":2.5}\n\n')
    );

    // Event 3: Final result
    controller.enqueue(
      encoder.encode('event: done\ndata: {"result":"...report..."}\n\n')
    );

    controller.close();
  },
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' },
});
```

### Client Event Listener

```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/workflow-execute');

  eventSource.addEventListener('step_completed', (event) => {
    const data = JSON.parse(event.data);
    console.log(`Step ${data.step} completed in ${data.duration}s`);
    setTimeline(prev => [...prev, data]);
  });

  eventSource.addEventListener('done', () => {
    eventSource.close();
  });

  return () => eventSource.close();
}, []);
```

---

## Common Patterns & Solutions

### Pattern 1: Dynamic Tool Registration

```typescript
// lib/toolRegistry.ts
export class ToolRegistry {
  private tools = new Map();

  register(name: string, tool: Tool) {
    this.tools.set(name, tool);
  }

  getTools() {
    return Object.fromEntries(this.tools);
  }

  buildForAI() {
    const tools = {};
    for (const [name, tool] of this.tools) {
      tools[name] = tool;
    }
    return tools;
  }
}

// Usage
const registry = new ToolRegistry();
registry.register('getWeather', weatherTool);
registry.register('search', searchTool);

const response = await generateText({
  model: openai('gpt-5'),
  tools: registry.buildForAI(),
  // ...
});
```

### Pattern 2: Error Handling & Retries

```typescript
async function executeToolWithRetry(
  tool: Tool,
  params: any,
  maxRetries = 3
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await tool.execute(params);
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed. Retrying...`);

      // Exponential backoff
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError;
}
```

### Pattern 3: Context Templating

```typescript
// Replace {{ variables }} in workflow steps
function templateReplace(template: string, context: Record<string, any>) {
  return template.replace(/\{\{\s*(\w+\.[\w.]+)\s*\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], context);
    return value ?? match;
  });
}

// Usage
const context = {
  step_1: { output: { data: 'research results' } },
  step_2: { output: { summary: 'summary text' } },
};

const template = 'Based on {{ step_1.output.data }}, we found {{ step_2.output.summary }}';
const result = templateReplace(template, context);
// Output: "Based on research results, we found summary text"
```

### Pattern 4: Token Budget Management

```typescript
import { openai } from '@ai-sdk/openai';

async function countTokens(messages: any[], prompt: string) {
  const model = openai('gpt-5');

  const count = await model.countTokens({
    messages,
    prompt,
  });

  return count.input_tokens;
}

// Usage
const tokenCount = await countTokens(chatHistory, userMessage);
const maxTokens = 128000; // GPT-5 context window

if (tokenCount > maxTokens * 0.9) {
  // Truncate history or reject message
  console.warn('Approaching token limit');
}
```

### Pattern 5: Message History Management

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class ChatHistory {
  private messages: Message[] = [];

  add(role: string, content: string) {
    this.messages.push({
      id: crypto.randomUUID(),
      role: role as 'user' | 'assistant',
      content,
      timestamp: new Date(),
    });
  }

  getForAI() {
    // Convert to format AI SDK expects
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  getLastN(n: number) {
    return this.messages.slice(-n);
  }

  truncateToTokenLimit(limit: number) {
    // Keep most recent messages until approaching token limit
    // Implementation depends on token counting
  }
}
```

### Pattern 6: Tool Output Formatting

```typescript
interface ToolResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

function formatToolResult(
  name: string,
  result: any,
  duration: number
): ToolResult {
  return {
    toolName: name,
    success: true,
    result,
    duration,
    timestamp: new Date(),
  };
}

function formatToolError(
  name: string,
  error: Error,
  duration: number
): ToolResult {
  return {
    toolName: name,
    success: false,
    error: error.message,
    duration,
    timestamp: new Date(),
  };
}
```

---

## Performance Optimization Tips

### 1. **Lazy Load Skills**
```typescript
// Only load skill when needed, not on startup
async function invokeSkill(skillName: string, input: any) {
  const skill = await dynamicImport(`./skills/${skillName}`);
  return await skill.execute(input);
}
```

### 2. **Cache Skill Metadata**
```typescript
const skillMetadataCache = new Map();

async function getSkillMetadata(skillName: string) {
  if (!skillMetadataCache.has(skillName)) {
    const metadata = await loadSkillMetadata(skillName);
    skillMetadataCache.set(skillName, metadata);
  }
  return skillMetadataCache.get(skillName);
}
```

### 3. **Batch Tool Calls**
```typescript
// Execute multiple independent tools in parallel
const results = await Promise.all([
  tool1.execute(params1),
  tool2.execute(params2),
  tool3.execute(params3),
]);
```

### 4. **Stream Instead of Wait**
```typescript
// Bad: Wait for entire response
const { text } = await generateText({ /* ... */ });

// Good: Stream and display immediately
const stream = await streamText({ /* ... */ });
for await (const chunk of stream.textStream) {
  updateUI(chunk); // Show to user immediately
}
```

---

## Debugging Tips

### 1. **Log AI Model Calls**
```typescript
const stream = await streamText({
  model: openai('gpt-5'),
  messages,
  // ... add logging
  onChunk: (chunk) => console.log('Chunk:', chunk),
});
```

### 2. **Inspect Tool Invocations**
```typescript
const tool = tool({
  // ...
  execute: async (params) => {
    console.log('Tool called with:', params);
    const result = await executeLogic(params);
    console.log('Tool result:', result);
    return result;
  },
});
```

### 3. **Monitor Token Usage**
```typescript
const response = await generateText({
  /* ... */
});

console.log('Tokens used:', {
  input: response.usage?.input_tokens,
  output: response.usage?.output_tokens,
  total: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
});
```

---

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Tools not called | Ensure `maxSteps` > 1 and tool descriptions are clear |
| Streaming stops early | Don't await the stream, iterate with `for await` |
| React hydration errors | Use `'use client'` directive correctly |
| Token limit exceeded | Implement message history truncation |
| Slow first API call | Warm up model with dummy request, implement caching |
| Tool parameters mismatch | Validate Zod schema matches actual parameters |

---

## Resources

- **Vercel AI SDK Docs:** https://sdk.vercel.ai/docs
- **Anthropic Tool Use:** https://docs.anthropic.com/claude/docs/tool-use
- **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
- **Next.js Streaming:** https://nextjs.org/docs/app/building-your-application/data-fetching/streaming-and-suspense

