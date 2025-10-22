# SkillsFlow AI - Copilot Instructions for AI Coding Agents

**Last Updated:** October 22, 2025  
**Status:** Production-Grade MVP  
**Architecture:** Next.js 15 + Vercel AI SDK v5 + GPT-5

---

## 🎯 The Big Picture: What SkillsFlow AI Does

SkillsFlow AI is a **chat-based AI orchestrator** that demonstrates:

1. **Dynamic Skill Discovery & Execution**: The AI can invoke predefined "skills" (capabilities) based on user requests
2. **Real-time Streaming Chat**: Messages stream to users as they're generated (not batch responses)
3. **Multi-Step Workflows**: Users can chain multiple skills into workflows (research → summarize → report)
4. **Extensible Architecture**: New skills can be added without code changes (just SKILL.md files)

**Core Flow:**
```
User Message → Chat Hook (useChat) → Backend /api/agent → GPT-5 with Tools
   ↓
GPT-5 Decides Which Skill(s) to Use → Executes Skills → Streams Response
   ↓
Frontend Displays Streaming Message + Tool Invocations
```

---

## 🏗️ Architecture: Three Core Systems

### 1. **Skill Registry** (Skills Discovery & Lazy-Loading)
- **Location:** `src/lib/skills.ts` (to be created)
- **Purpose:** Scan `/skills` directory at startup, parse SKILL.md metadata, lazy-load logic.js on demand
- **Key Pattern:** Each skill is a folder with:
  - `SKILL.md` (YAML frontmatter + markdown instructions)
  - `logic.js` (optional, executable implementation)
- **Why This Design:** Skills are discoverable without loading code upfront (performance optimization)

**Example Skill Structure:**
```
/skills/web_research/
├── SKILL.md          ← Metadata + instructions for GPT-5
├── logic.js          ← Optional implementation (lazy-loaded)
```

**SKILL.md Format (YAML frontmatter required):**
```yaml
---
name: Web Research
version: 1.0.0
description: Performs web research on any topic
category: research
tools:
  - web_search
  - summarization
input_schema:
  query: string
  depth: "shallow|deep"
output_format: markdown
---
# Markdown instructions for GPT-5...
```

### 2. **Skills Orchestrator** (AI Decision-Making)
- **Location:** `src/lib/orchestrator.ts` (to be created)
- **Purpose:** Register skills as tools with GPT-5, handle tool calling loop, manage streaming
- **Key Pattern:** Convert skill metadata → Vercel AI SDK `tool()` definitions at runtime
- **Why This Design:** Allows dynamic tool registration without hardcoding (enables new skills without code changes)

**Pseudo-code Flow:**
```typescript
// 1. Load all skill metadata
const skills = await registry.getSkillMetadata();

// 2. Convert each skill to a tool definition
const tools = skills.map(skill => tool({
  description: skill.description,
  parameters: skill.input_schema,
  execute: async (input) => await registry.invokeSkill(skill.name, input),
}));

// 3. Pass tools to streamText()
const response = await streamText({
  model: openai('gpt-5'),
  tools: { ...tools },
  system: buildSystemPrompt(skills),
  messages: [{ role: 'user', content: userMessage }],
});
```

### 3. **Workflow Engine** (Multi-Step Execution)
- **Location:** `src/lib/workflows.ts` (Phase 3, to be created)
- **Purpose:** Parse YAML workflow definitions, sequence steps, handle dependencies
- **Key Pattern:** DAG (Directed Acyclic Graph) execution with max 5 steps per workflow
- **Why This Design:** Allows users to chain multiple skills without writing code

**Workflow YAML Format:**
```yaml
name: Deep Research & Report
version: 1.0.0
steps:
  - id: research
    skill: web_research
    input:
      query: "{{ user_query }}"
      depth: deep
  - id: summarize
    depends_on: [research]
    skill: summarizer
    input:
      content: "{{ steps.research.output }}"
```

---

## 🔌 Critical Frontend Requirement: @ai-sdk/react MUST BE USED

### The Rule
**Frontend MUST use `useChat()` hook from `@ai-sdk/react`. Do NOT implement custom chat logic.**

### Why This Matters
- Automatic streaming support (Server-Sent Events)
- Built-in message management (no Redux/Context needed for basic chat)
- Tool invocation tracking (displays what skills the AI called)
- Error handling and retry logic
- Loading states and cancellation

### The Pattern (All Frontend Chat Components Must Follow This)
```typescript
'use client';

import { useChat } from '@ai-sdk/react';

export default function ChatInterface() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
  } = useChat({
    api: '/api/agent',           // Your streaming endpoint
    maxSteps: 10,                // Max tool calls before stopping
    onError: (error) => {
      console.error('Chat error:', error);
      // Handle error gracefully
    },
  });

  return (
    // Render messages + input
    // messages[].toolInvocations shows which skills were called
  );
}
```

### What NOT to Do
- ❌ Manual `fetch()` calls to `/api/agent`
- ❌ WebSocket connections
- ❌ Custom event listeners for streaming
- ❌ Manual message state management
- ❌ Custom error boundaries for chat

### Backend Requirement
The `/api/agent` endpoint MUST return Server-Sent Events (SSE) using `stream.toTextStreamResponse()` from Vercel AI SDK.

---

## 📝 Key Files to Know

| File/Directory | Purpose | Status |
|---|---|---|
| `/src/lib/skills.ts` | SkillRegistry class | Phase 1 |
| `/src/lib/orchestrator.ts` | GPT-5 tool calling loop | Phase 2 |
| `/src/lib/workflows.ts` | Workflow DAG executor | Phase 3 |
| `/src/app/api/agent/route.ts` | Main streaming endpoint | Phase 1 |
| `/src/app/components/ChatInterface.tsx` | Main chat component (uses useChat) | Phase 1 |
| `/skills/*/SKILL.md` | Skill definitions (YAML + markdown) | Phase 1 |
| `/workflows/*.yaml` | Workflow definitions | Phase 3 |

---

## 🛠️ Development Conventions

### TypeScript & Type Safety
- **All code MUST be TypeScript** (no `.js` files in src/)
- Use `interface` for contract definitions (e.g., `SkillMetadata`)
- Use `type` for unions and advanced types
- Leverage `zod` for runtime schema validation (already used by Vercel AI SDK)

### Folder Structure
```
src/
├── app/
│   ├── api/
│   │   ├── agent/        ← Main orchestrator endpoint
│   │   ├── skills/       ← Skill registry endpoint
│   │   └── workflows/    ← Workflow management endpoint
│   ├── components/       ← React components
│   ├── layout.tsx        ← Root layout
│   └── page.tsx          ← Home page
├── lib/
│   ├── skills.ts         ← SkillRegistry class
│   ├── orchestrator.ts   ← Orchestration logic
│   ├── workflows.ts      ← Workflow execution
│   └── utils.ts          ← Helper functions
└── types/
    └── index.ts          ← Shared TypeScript types

skills/                    ← External: Skill definitions
├── web_research/
│   ├── SKILL.md
│   └── logic.js
├── summarizer/
│   ├── SKILL.md
│   └── logic.ts
└── report_writer/
    └── SKILL.md

workflows/                 ← External: Workflow definitions
├── research_and_report.yaml
└── data_analysis.yaml
```

### Naming Conventions
- **Files:** `camelCase.ts` for utilities, `PascalCase.tsx` for React components
- **Classes:** `PascalCase` (e.g., `SkillRegistry`, `SkillsOrchestrator`)
- **Functions:** `camelCase` (e.g., `invokeSkill`, `parseSkillMetadata`)
- **Types/Interfaces:** `PascalCase` (e.g., `SkillMetadata`, `Message`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `SKILL_DIR`, `MAX_STEPS`)

### Environment Variables
```bash
# .env.local (required)
OPENAI_API_KEY=sk-...

# .env.local (optional)
AI_MODEL=gpt-4-turbo          # Configurable (see Decision Q1)
SKILL_REGISTRY_DIR=./skills   # Skill directory
LOG_LEVEL=debug               # Logging level
```

---

## 🔄 Backend Streaming Pattern: How It Works

### 1. Client Sends Message
```typescript
// Browser, via useChat hook
const response = await fetch('/api/agent', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] }),
});
```

### 2. Backend Processes with streamText()
```typescript
// /api/agent - routes/agent/route.ts
export async function POST(req) {
  const { messages } = await req.json();

  const stream = await streamText({
    model: openai(process.env.AI_MODEL),
    tools: { ...dynamicTools },
    messages,
  });

  return stream.toTextStreamResponse(); // ← Returns SSE stream
}
```

### 3. Frontend Receives Streaming Response
```typescript
// useChat automatically reads the SSE stream
// Updates messages[] as chunks arrive
// Shows loading indicator while streaming
```

### Critical Detail
- Backend MUST call `.toTextStreamResponse()` on the stream object
- Frontend MUST use `useChat` hook (not manual fetch)
- The contract between them is Server-Sent Events (SSE) format
- Tool invocations are included in the stream automatically

---

## 🎯 Common Patterns You'll Implement

### Pattern 1: Parse SKILL.md Files
```typescript
// src/lib/skills.ts
async function parseSkillMetadata(skillPath: string): Promise<SkillMetadata> {
  const content = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
  
  // Extract YAML frontmatter
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) throw new Error('No YAML frontmatter in SKILL.md');
  
  // Parse YAML
  const metadata = yaml.parse(frontmatter[1]);
  return metadata as SkillMetadata;
}
```

### Pattern 2: Lazy-Load Skill Logic
```typescript
// Only load logic.js when invokeSkill() is called
async function invokeSkill(skillName: string, input: any): Promise<any> {
  const skillPath = `./skills/${skillName}`;
  
  // Check if logic.js exists
  if (fs.existsSync(path.join(skillPath, 'logic.js'))) {
    // Dynamically import
    const module = await import(`${skillPath}/logic.js`);
    return await module.default(input);
  }
  
  // Otherwise, return markdown + let GPT-5 decide
  return skillMetadata;
}
```

### Pattern 3: Convert Skills to Tools
```typescript
// Convert SkillMetadata → Vercel AI SDK tool()
const tools = skills.map(skill => ({
  [skill.name]: tool({
    description: skill.description,
    parameters: z.object(skill.input_schema),
    execute: async (input) => {
      return await invokeSkill(skill.name, input);
    },
  }),
}));
```

### Pattern 4: System Prompt Construction
```typescript
// Build context for GPT-5 about available skills
const systemPrompt = `
You are an AI assistant with access to the following skills:

${skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

When the user asks for help, determine which skill(s) to use and invoke them.
`;
```

---

## ⚠️ Critical Edge Cases & Anti-Patterns

### Anti-Pattern 1: Don't Hardcode Skills
```typescript
// ❌ BAD: Hardcoded tools (not extensible)
const tools = {
  webSearch: tool({ /* ... */ }),
  summarizer: tool({ /* ... */ }),
};

// ✅ GOOD: Dynamic from registry
const tools = await registry.getToolDefinitions();
```

### Anti-Pattern 2: Don't Load All Skill Logic at Startup
```typescript
// ❌ BAD: All logic loaded upfront (memory inefficient)
for (const skill of skills) {
  skill.logic = require(`./skills/${skill.name}/logic.js`);
}

// ✅ GOOD: Load on-demand (lazy-load)
// Only load logic.js when invokeSkill() is called
```

### Anti-Pattern 3: Don't Manually Manage Chat State
```typescript
// ❌ BAD: Manual state management
const [messages, setMessages] = useState([]);
const handleSubmit = async (message) => {
  const response = await fetch('/api/agent', { body: message });
  // ... manually handle streaming, parsing, errors ...
};

// ✅ GOOD: Use useChat hook
const { messages, handleSubmit } = useChat({ api: '/api/agent' });
```

### Anti-Pattern 4: Don't Forget Timeouts in Workflows
```typescript
// ❌ BAD: Workflow step runs forever
const result = await invokeSkill(skillName, input);

// ✅ GOOD: Always set timeouts
const result = await Promise.race([
  invokeSkill(skillName, input),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Skill timeout')), 30000)
  ),
]);
```

---

## 📊 Development Phases & Milestones

| Phase | Duration | What You Build | Exit Criteria |
|-------|----------|---|---|
| **Phase 1** | Week 1 | Chat UI + Skill Registry | Chat accepts messages, 3 test skills work |
| **Phase 2** | Week 2 | AI Orchestration | GPT-5 selects correct skills |
| **Phase 3** | Week 3 | Workflow Engine | Workflows with 2+ steps execute correctly |
| **Phase 4** | Week 4 | Polish + Deploy | Deployed to Vercel Edge Runtime |

**Each phase adds documentation (see IMPLEMENTATION_PLAN.md Section 9 for full timeline)**

---

## 🚀 When You're Building Something New: Ask These Questions

1. **Is this part of the Skill Registry?**
   - If yes: Add to `src/lib/skills.ts` or create new skill in `/skills`
   - Follow SkillMetadata interface

2. **Is this a streaming endpoint?**
   - If yes: Use Vercel AI SDK's `streamText()` → `.toTextStreamResponse()`
   - Always use streaming for consistency

3. **Is this a React component that uses chat?**
   - If yes: MUST use `useChat()` hook from `@ai-sdk/react`
   - Never implement custom chat state

4. **Does this need to load external files?**
   - If yes: Load them lazily (on-demand, not at startup)
   - Optimize for performance

5. **Does this involve GPT-5?**
   - If yes: Go through Vercel AI SDK (not direct API calls)
   - Leverage tool calling for extensibility

---

## 📚 Reference Documentation

For complete details, see the documentation in your workspace:

- **IMPLEMENTATION_PLAN.md** - Architecture, folder structure, API design
- **TECHNICAL_REFERENCE.md** - Code examples for every pattern
- **VERCEL_AI_SDK_UI_GUIDE.md** - Complete frontend reference (CRITICAL)
- **QUICK_REFERENCE_CARD.md** - One-page cheat sheet
- **CLARIFICATIONS_AND_DECISIONS.md** - 18 strategic decisions with rationale

---

## ✅ AI Agent Checklist

Before submitting code:

- [ ] TypeScript: All code is type-safe, no `any` without justification
- [ ] Streaming: Backend endpoints return SSE via `.toTextStreamResponse()`
- [ ] Chat Components: Use `useChat()` hook (never manual fetch for chat)
- [ ] Skills: Lazy-loaded, not loaded at startup
- [ ] Tools: Dynamically registered from SkillRegistry
- [ ] Errors: All async operations have error handling
- [ ] Performance: No unnecessary re-renders, no memory leaks
- [ ] Documentation: Comments on complex logic, SKILL.md for new skills

---

**Last updated:** October 22, 2025  
**Status:** Ready for Phase 1 Development
