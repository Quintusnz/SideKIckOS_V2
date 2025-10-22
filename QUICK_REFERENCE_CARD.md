# ⚡ Vercel AI SDK UI - Quick Reference Card

**Print this. Post on your monitor. Reference constantly.**

---

## 🎯 The ONE Rule

**Frontend MUST use `@ai-sdk/react` `useChat()` hook**

Do NOT:
- ❌ Manual fetch()
- ❌ WebSockets
- ❌ Custom streaming
- ❌ Manual message state

Do USE:
- ✅ `useChat()` hook
- ✅ `handleSubmit`
- ✅ `handleInputChange`
- ✅ `messages` array

---

## 📦 Install

```bash
npm install @ai-sdk/react
```

---

## 🚀 Basic Template

```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/agent',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isLoading} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

---

## 📨 Message Structure

```typescript
// Each message has:
{
  id: string,
  role: 'user' | 'assistant',
  content: string,
  toolInvocations?: [
    {
      toolName: string,
      args: {...},
      state: 'input-available' | 'output-available',
      result: any
    }
  ]
}
```

---

## 🛠️ Properties

```typescript
const {
  messages,           // Array of Message objects ✅
  input,              // Current input string ✅
  handleInputChange,  // (e) => void ✅
  handleSubmit,       // (e) => void ✅
  isLoading,          // boolean ✅
  stop,               // () => void
  reload,             // () => void
} = useChat({ api: '/api/agent' });
```

---

## ✅ Checklist

- [ ] Installed `@ai-sdk/react`
- [ ] Created component with `'use client'`
- [ ] Called `useChat({ api: '/api/agent' })`
- [ ] Form uses `handleSubmit`, input uses `handleInputChange`
- [ ] Messages rendered in a loop
- [ ] Tool invocations displayed
- [ ] Backend endpoint returns streaming response
- [ ] Tested with `npm run dev`

---

## 🔗 Backend Requirement

Your `/api/agent` endpoint MUST:

```typescript
// ✅ CORRECT
const stream = await streamText({ /* ... */ });
return stream.toTextStreamResponse();

// ❌ WRONG
return Response.json({ text: result });
```

---

## 📚 Full Guide

See: `VERCEL_AI_SDK_UI_GUIDE.md`

---

**That's it. Use the hook. Everything else is automatic.** ✨

