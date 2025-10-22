# ⭐ Vercel AI SDK UI - Critical Frontend Guide

**Status:** REQUIRED FOR ALL FRONTEND DEVELOPMENT  
**Importance:** CRITICAL - DO NOT SKIP  
**Updated:** October 22, 2025

---

## 🚨 MUST READ

**Your frontend MUST use Vercel's AI SDK UI (`@ai-sdk/react`)**

This is not a suggestion. This is a requirement for SkillsFlow AI because:
- ✅ Automatic streaming support
- ✅ Built-in message management
- ✅ Tool invocation handling
- ✅ Loading states
- ✅ Error handling
- ✅ Seamless real-time updates

**DO NOT implement chat manually. DO NOT use WebSockets directly. DO NOT build custom streaming logic.**

---

## 📦 Installation

```bash
# Install the package
npm install @ai-sdk/react

# It will be installed alongside 'ai' package
```

---

## 🎯 Core Concept: useChat Hook

The `useChat` hook is the entire foundation of your chat interface.

### What It Does

```
User Types Message
        ↓
  handleInputChange updates input state
        ↓
  User submits form
        ↓
  handleSubmit sends to /api/agent
        ↓
  Backend streams response via SSE
        ↓
  useChat automatically receives stream
        ↓
  messages array updates in real-time
        ↓
  Component re-renders with new message
```

### Basic Usage

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    api: '/api/agent', // Your backend endpoint
  });

  return (
    <div>
      {/* Display messages */}
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
```

### All Available Properties

```typescript
const {
  // State
  messages,           // Array of Message objects
  input,              // Current input text
  isLoading,          // Is AI thinking?

  // Handlers
  handleInputChange,  // Update input value
  handleSubmit,       // Submit form
  stop,               // Stop generation
  reload,             // Retry last message

  // Manual control
  append,             // Manually add message
  setMessages,        // Replace all messages
} = useChat({
  api: '/api/agent',  // Required: Your backend endpoint
  maxSteps: 10,       // Optional: Max tool calls
  onResponse,         // Optional: Callback when response starts
  onError,            // Optional: Error handler
  onFinish,           // Optional: Callback when done
});
```

---

## 📨 Message Structure

Each message in the `messages` array has this structure:

```typescript
interface Message {
  id: string;                    // Unique ID
  role: 'user' | 'assistant' | 'system';
  content: string;               // Text content
  toolInvocations?: Array<{      // Tools the AI called
    id: string;
    toolName: string;            // e.g., "web_search"
    args: Record<string, any>;   // Parameters passed
    state: 'input-available' | 'output-available'; // Status
    result?: any;                // Tool output (when state = output-available)
  }>;
  toolResults?: Array<{          // Results from tools
    toolCallId: string;
    result: any;
  }>;
}
```

### Rendering Messages

```typescript
{messages.map(message => (
  <div key={message.id}>
    {/* User message */}
    {message.role === 'user' && (
      <div className="user-message">
        {message.content}
      </div>
    )}

    {/* Assistant message */}
    {message.role === 'assistant' && (
      <>
        {/* Text content */}
        {message.content && (
          <div className="assistant-message">
            <Markdown>{message.content}</Markdown>
          </div>
        )}

        {/* Tool invocations */}
        {message.toolInvocations?.map(tool => (
          <div key={tool.id} className="tool-invocation">
            <p>Called: {tool.toolName}</p>
            <p>Status: {tool.state}</p>
            {tool.state === 'output-available' && (
              <pre>{JSON.stringify(tool.result, null, 2)}</pre>
            )}
          </div>
        ))}
      </>
    )}
  </div>
))}
```

---

## 📝 Form Handling

### Simple Form

```typescript
const { input, handleInputChange, handleSubmit } = useChat({
  api: '/api/agent',
});

return (
  <form onSubmit={handleSubmit}>
    <input
      value={input}
      onChange={handleInputChange}
      placeholder="Type message..."
    />
    <button type="submit">Send</button>
  </form>
);
```

### Advanced Form with Send Button Control

```typescript
const { input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
  api: '/api/agent',
});

return (
  <form onSubmit={handleSubmit}>
    <input
      value={input}
      onChange={handleInputChange}
      disabled={isLoading}
      placeholder="Type message..."
    />
    {!isLoading && <button type="submit">Send</button>}
    {isLoading && <button type="button" onClick={() => stop()}>Stop</button>}
  </form>
);
```

---

## 🔄 Streaming Response

The magic happens automatically. Your backend endpoint (`/api/agent`) must:

1. **Accept POST request with messages**
   ```json
   {
     "messages": [
       { "role": "user", "content": "Do research..." }
     ]
   }
   ```

2. **Return Server-Sent Events (SSE) stream**
   ```
   0:"Tool called: web_search"
   0:"Research complete: Found 10 results"
   0:"Summarizing findings..."
   d:[...]
   ```

3. **useChat automatically parses and updates**
   - As chunks arrive, `messages` updates
   - UI re-renders in real-time
   - No manual handling needed

---

## 🛠️ Backend Endpoint Requirements

Your `/api/agent` endpoint **MUST** return a streaming response.

### Correct Backend Implementation

```typescript
// app/api/agent/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Create streaming response
  const stream = await streamText({
    model: openai('gpt-5'),
    messages,
    system: 'You are a helpful AI assistant...',
    tools: {
      // Your tools here
    },
  });

  // CRITICAL: Return as text stream response
  return stream.toTextStreamResponse();
}
```

### What NOT to Do

```typescript
// ❌ WRONG: Returning JSON
return Response.json({ text: result });

// ❌ WRONG: Not streaming
const { text } = await generateText({ /* ... */ });
return Response.json({ text });

// ❌ WRONG: Manual event stream without proper format
return new Response(stream);
```

---

## 📊 Tool Invocation Display

When AI calls a tool, display it properly:

```typescript
{message.toolInvocations?.map(tool => (
  <div key={tool.id} className="border rounded p-4 my-2">
    <div className="font-semibold">🔧 {tool.toolName}</div>
    
    {/* Show input while processing */}
    {tool.state === 'input-available' && (
      <div className="text-gray-500">Running...</div>
    )}
    
    {/* Show output when complete */}
    {tool.state === 'output-available' && (
      <>
        <div className="text-green-600">✓ Complete</div>
        {tool.result && (
          <pre className="bg-gray-100 p-2 mt-2 overflow-auto">
            {JSON.stringify(tool.result, null, 2)}
          </pre>
        )}
      </>
    )}
  </div>
))}
```

---

## 🎨 Full Chat Component Example

Here's a complete, production-ready chat component:

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Markdown } from 'react-markdown';
import { Loader2, Send, Square } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
  } = useChat({
    api: '/api/agent',
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">SkillsFlow AI</h1>
        <p className="text-sm text-slate-400">Chat with intelligent skill orchestration</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Start a conversation...</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'user' ? (
                  {/* User Message */}
                  <Card className="max-w-lg px-4 py-2 bg-red-600 text-white border-0">
                    {message.content}
                  </Card>
                ) : (
                  {/* Assistant Message */}
                  <div className="max-w-2xl space-y-2">
                    {message.content && (
                      <Card className="px-4 py-2 bg-slate-700 text-slate-100 border-0">
                        <Markdown>{message.content}</Markdown>
                      </Card>
                    )}

                    {message.toolInvocations?.map((tool) => (
                      <Card
                        key={tool.id}
                        className="px-4 py-2 border-l-4 border-red-600 bg-slate-800 text-slate-100"
                      >
                        <div className="font-semibold">🔧 {tool.toolName}</div>
                        {tool.state === 'input-available' && (
                          <div className="text-slate-400">Processing...</div>
                        )}
                        {tool.state === 'output-available' && (
                          <pre className="bg-slate-900 p-2 mt-2 text-xs overflow-auto">
                            {JSON.stringify(tool.result, null, 2)}
                          </pre>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <Card className="px-4 py-2 bg-slate-700 text-slate-100 border-0">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 bg-slate-700 border-slate-600 text-white"
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

## ⚙️ Advanced Configuration

### Custom Callbacks

```typescript
const { /* ... */ } = useChat({
  api: '/api/agent',

  // Called when response starts streaming
  onResponse: (response) => {
    console.log('Response started:', response.status);
  },

  // Called if error occurs
  onError: (error) => {
    console.error('Error:', error);
    showErrorNotification('Failed to get response');
  },

  // Called when generation completes
  onFinish: (message) => {
    console.log('Message complete:', message);
    logToAnalytics('conversation_completed');
  },
});
```

### Max Steps Control

```typescript
const { /* ... */ } = useChat({
  api: '/api/agent',
  maxSteps: 10,  // Max tool calls before stopping (prevents infinite loops)
});
```

---

## 🐛 Common Issues & Solutions

### Issue: Messages not updating in real-time

**Problem:** Frontend not showing streaming chunks as they arrive

**Solution:** Ensure backend returns `stream.toTextStreamResponse()`

```typescript
// ✅ CORRECT
return stream.toTextStreamResponse();

// ❌ WRONG
return Response.json(await stream.finalMessage());
```

### Issue: Tool invocations not showing

**Problem:** `message.toolInvocations` is empty or undefined

**Solution:** Ensure backend is properly calling tools and backend is returning correct format

```typescript
// ✅ Backend must enable tool calls
const stream = await streamText({
  model,
  messages,
  tools: { /* your tools */ },
});

// Frontend will automatically populate toolInvocations
```

### Issue: Input not sending

**Problem:** Form submits but nothing happens

**Solution:** Ensure form is calling `handleSubmit` and endpoint is correct

```typescript
// ✅ CORRECT
<form onSubmit={handleSubmit}>
  <input value={input} onChange={handleInputChange} />
  <button type="submit">Send</button>
</form>

// ❌ WRONG: Custom onClick
<button onClick={() => sendMessage(input)}>Send</button>
```

---

## 📚 Reference

### Installation
```bash
npm install @ai-sdk/react
```

### Import
```typescript
import { useChat } from '@ai-sdk/react';
```

### Required Backend Endpoint
- **Path:** `/api/agent`
- **Method:** POST
- **Input:** `{ messages: Message[] }`
- **Output:** SSE stream (via `toTextStreamResponse()`)

### Key Methods
- `handleInputChange(event)` - Update input
- `handleSubmit(event)` - Send message
- `stop()` - Stop generation
- `reload()` - Retry last message
- `append(message)` - Add message manually

---

## ✅ Checklist Before Building

- [ ] Installed `@ai-sdk/react`
- [ ] Created `/api/agent` endpoint that returns streaming response
- [ ] Built chat component using `useChat` hook
- [ ] Message display implemented
- [ ] Tool invocation display implemented
- [ ] Error handling added
- [ ] Loading states working
- [ ] Auto-scroll implemented
- [ ] Tested locally with `npm run dev`

---

## 🎯 Final Reminder

**This is not optional.** ✋

Your frontend must use Vercel's `@ai-sdk/react` package for:
1. Message management
2. Streaming response handling
3. Tool invocation tracking
4. Loading/error states

**Do not attempt to:**
- ❌ Manually handle SSE
- ❌ Build custom streaming logic
- ❌ Use fetch() for chat
- ❌ Implement message state yourself
- ❌ Use WebSockets

**Use the hook. It handles everything.** ✅

---

*This is the most critical frontend requirement for SkillsFlow AI.*

