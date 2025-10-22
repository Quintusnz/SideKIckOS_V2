# SkillsFlow AI - Visual & Reference Architecture

**Purpose:** Quick visual reference for system design  
**Target Audience:** Developers, architects, team members

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SKILLSFLOW AI MVP                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                    USER BROWSER                            │   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  Chat Interface (@ai-sdk/react)                    │ │   │
│  │  │  ├─ Message input                                  │ │   │
│  │  │  ├─ Real-time message stream                       │ │   │
│  │  │  └─ Tool invocation display                        │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                         │                                 │   │
│  │  ┌─────────────────────┴──────────────────────────────┐  │   │
│  │  │                   │                                 │  │   │
│  │  ▼                   ▼                                 ▼  │   │
│  │ ┌─────────┐  ┌──────────────┐  ┌──────────────────┐    │   │
│  │ │Sidebar  │  │Chat Renderer │  │Execution Timeline │   │   │
│  │ │- Skills │  │(Markdown UI) │  │- Step progress   │    │   │
│  │ │- History│  │- Rich output │  │- Timing info     │    │   │
│  │ └─────────┘  └──────────────┘  └──────────────────┘    │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         ▲                                        │
│                         │                                        │
│                    HTTP/WebSocket                               │
│                    Server-Sent Events (SSE)                     │
│                         │                                        │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │                  VERCEL EDGE RUNTIME                    │   │
│  │  (serverless Node.js environment)                       │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │         API ROUTE HANDLERS                       │  │   │
│  │  │                                                  │  │   │
│  │  │  POST /api/agent                                │  │   │
│  │  │  ├─ Input: user message + chat history         │  │   │
│  │  │  ├─ Output: SSE stream with chunks             │  │   │
│  │  │  └─ Powers: Chat orchestration                 │  │   │
│  │  │                                                  │  │   │
│  │  │  GET /api/skills                                │  │   │
│  │  │  ├─ Output: Skill metadata JSON                │  │   │
│  │  │  └─ Powers: Sidebar + AI context               │  │   │
│  │  │                                                  │  │   │
│  │  │  GET /api/workflows                             │  │   │
│  │  │  ├─ Output: Available workflows JSON            │  │   │
│  │  │  └─ Powers: Workflow picker                     │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │    ORCHESTRATOR (Core AI Logic)                  │  │   │
│  │  │                                                  │  │   │
│  │  │  ┌─────────────────────────────────────────┐   │  │   │
│  │  │  │ 1. Skill Discovery                      │   │  │   │
│  │  │  │    Load metadata from registry          │   │  │   │
│  │  │  │    Build tool definitions               │   │  │   │
│  │  │  └─────────────────────────────────────────┘   │  │   │
│  │  │                   │                             │  │   │
│  │  │                   ▼                             │  │   │
│  │  │  ┌─────────────────────────────────────────┐   │  │   │
│  │  │  │ 2. GPT-5 Analysis                       │   │  │   │
│  │  │  │    - Process user query                │   │  │   │
│  │  │  │    - Match to skills/workflows         │   │  │   │
│  │  │  │    - Generate execution plan           │   │  │   │
│  │  │  │    - Return reasoning + tool calls     │   │  │   │
│  │  │  └─────────────────────────────────────────┘   │  │   │
│  │  │                   │                             │  │   │
│  │  │                   ▼                             │  │   │
│  │  │  ┌─────────────────────────────────────────┐   │  │   │
│  │  │  │ 3. Execution Router                     │   │  │   │
│  │  │  │    ├─ Single Skill?                     │   │  │   │
│  │  │  │    │  └─ Invoke skill directly          │   │  │   │
│  │  │  │    ├─ Workflow?                         │   │  │   │
│  │  │  │    │  └─ Execute via Workflow Engine    │   │  │   │
│  │  │  │    └─ Multi-tool loop?                  │   │  │   │
│  │  │  │       └─ Iterative tool calling         │   │  │   │
│  │  │  └─────────────────────────────────────────┘   │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │    SKILL REGISTRY & LOADER                       │  │   │
│  │  │                                                  │  │   │
│  │  │  /skills/                                        │  │   │
│  │  │  ├─ research/                                    │  │   │
│  │  │  │  ├─ SKILL.md (metadata + instructions)       │  │   │
│  │  │  │  └─ logic.js (optional implementation)       │  │   │
│  │  │  ├─ summarizer/                                 │  │   │
│  │  │  │  └─ SKILL.md                                 │  │   │
│  │  │  └─ report_writer/                              │  │   │
│  │  │     └─ SKILL.md                                 │  │   │
│  │  │                                                  │  │   │
│  │  │  SkillRegistry:                                 │  │   │
│  │  │  ├─ initialize() → Scan & preload metadata      │  │   │
│  │  │  ├─ getSkillMetadata() → Return all metadata    │  │   │
│  │  │  ├─ invokeSkill() → Lazy-load & execute        │  │   │
│  │  │  └─ buildTools() → Create tool definitions      │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │    WORKFLOW ENGINE                              │  │   │
│  │  │                                                  │  │   │
│  │  │  /workflows/                                     │  │   │
│  │  │  ├─ deep_research.yaml                           │  │   │
│  │  │  └─ content_generation.yaml                      │  │   │
│  │  │                                                  │  │   │
│  │  │  WorkflowExecutor:                              │  │   │
│  │  │  ├─ loadWorkflow() → Parse YAML                 │  │   │
│  │  │  ├─ validateSteps() → Check dependencies        │  │   │
│  │  │  ├─ executeStep() → Invoke skill                │  │   │
│  │  │  ├─ templateReplace() → Inject context          │  │   │
│  │  │  └─ streamExecution() → Real-time updates       │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │           EXTERNAL SERVICES                             │    │
│  │                                                          │    │
│  │  OpenAI API (GPT-5)                                      │    │
│  │  └─ Model: gpt-5 or configurable                         │    │
│  │                                                          │    │
│  │  Skill APIs (Whitelisted)                                │    │
│  │  ├─ Web Search API                                       │    │
│  │  ├─ GitHub API                                           │    │
│  │  └─ Other whitelisted services                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Message Flow Diagram

```
USER INPUT
   │
   ▼
┌─────────────────────────────┐
│ useChat Hook (Frontend)     │
│ - Capture user message      │
│ - Maintain chat history     │
│ - Handle streaming response │
└──────────┬──────────────────┘
           │
    POST /api/agent
           │
           ▼
┌─────────────────────────────┐
│ Backend API Handler         │
│ (next.js route handler)     │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 1. Skill Registry Init      │
│    - Load all skill metadata│
│    - Cache in memory        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ 2. Build Tool Definitions   │
│    - Create tool objects    │
│    - Attach descriptions    │
│    - Set input schemas      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 3. Call OpenAI API                      │
│    generateText() with:                 │
│    - Chat history                       │
│    - Tools array                        │
│    - System prompt                      │
│    - max_steps: 10                      │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 4. AI Reasoning & Tool Selection        │
│    OpenAI returns:                      │
│    - Reasoning for choice               │
│    - Tool call: skill_name + params     │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 5. Execute Selected Tool/Skill          │
│    - Load SKILL.md (if not cached)      │
│    - Lazy-load logic.js (if exists)     │
│    - Execute with params                │
│    - Capture result + duration          │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ 6. Stream Execution Update              │
│    Send SSE event:                      │
│    "skill_executed"                     │
│    {skill, result, duration_ms}         │
└──────────┬────────────────────────────────┘
           │
           ▼
       (Loop back to step 3 if needed)
           │
           ▼
┌─────────────────────────────────────────┐
│ 7. Return Final Response                │
│    - All tool results aggregated        │
│    - Final markdown output              │
│    - Send SSE: "done"                   │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Frontend Receives Stream    │
│ - Parse chunks              │
│ - Update message display    │
│ - Render markdown           │
│ - Show tool invocations     │
└──────────┬──────────────────┘
           │
           ▼
      DISPLAY TO USER
```

---

## 📦 Component Hierarchy

```
App Root
│
├── layout.tsx
│   └── Metadata + Global Styles
│
└── page.tsx (Main Page)
    │
    ├── ChatContainer
    │   │
    │   ├── SkillSidebar
    │   │   ├── SkillList
    │   │   │   └─ SkillCard (×N)
    │   │   │       ├─ SkillIcon
    │   │   │       ├─ SkillName
    │   │   │       └─ SkillDescription
    │   │   │
    │   │   └── WorkflowList
    │   │       └─ WorkflowCard (×N)
    │   │
    │   ├── ChatPanel
    │   │   │
    │   │   ├── MessagesContainer
    │   │   │   └─ Message (×N)
    │   │   │       ├─ MessageAvatar
    │   │   │       ├─ MessageContent
    │   │   │       │   └─ OutputRenderer (Markdown)
    │   │   │       └─ MessageTimestamp
    │   │   │
    │   │   ├── ToolInvocationCard
    │   │   │   ├─ ToolIcon
    │   │   │   ├─ ToolName
    │   │   │   ├─ InputParameters
    │   │   │   ├─ ExecutionStatus
    │   │   │   └─ OutputPreview
    │   │   │
    │   │   └── InputForm
    │   │       ├─ TextInput
    │   │       ├─ SendButton
    │   │       └─ StopButton
    │   │
    │   └── ExecutionTimeline
    │       ├─ TimelineHeader
    │       ├─ TimelineItem (×N)
    │       │   ├─ StepNumber
    │       │   ├─ StepName
    │       │   ├─ StatusBadge
    │       │   ├─ DurationInfo
    │       │   └─ ToggleDetails
    │       └─ TimelineFooter
    │
    └── API Routes (backend)
        ├── /api/agent/route.ts
        ├── /api/skills/route.ts
        └── /api/workflows/route.ts
```

---

## 🔄 Skill Execution Lifecycle

```
┌──────────────────┐
│  Skill Discovery │  User calls skill by name or AI selects it
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  Check Registry Cache        │  Is skill metadata cached?
└────────┬──────────────────┬──┘
         │ YES              │ NO
         │                  ▼
         │        ┌──────────────────────┐
         │        │  Load SKILL.md       │
         │        │ - Read file          │
         │        │ - Parse YAML header  │
         │        │ - Extract metadata   │
         │        │ - Cache metadata     │
         │        └──────────┬───────────┘
         │                   │
         └──────────────┬────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │ Check for logic.js           │  Does skill have code?
         └────────┬──────────────────┬──┘
                  │ YES              │ NO
                  │                  ▼
                  │        ┌────────────────────┐
                  │        │ Markdown-Only Mode │
                  │        │ AI interprets      │
                  │        │ instructions       │
                  │        └────────┬───────────┘
                  │                 │
                  ▼                 │
         ┌──────────────────────┐   │
         │ Dynamic Import       │   │
         │ logic.js             │   │
         └────────┬─────────────┘   │
                  │                 │
                  ▼                 │
         ┌──────────────────────┐   │
         │ Validate Params      │   │
         │ Against Schema       │   │
         └────────┬─────────────┘   │
                  │                 │
                  ▼                 │
         ┌──────────────────────┐   │
         │ Execute Skill Code   │   │
         │ with Input Params    │   │
         └────────┬─────────────┘   │
                  │                 │
         ┌────────┴─────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Capture Result │
    │ + Duration     │
    │ + Metadata     │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐
    │ Format Output  │
    │ (Markdown)     │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐
    │ Return to AI   │
    │ or Display     │
    │ to User        │
    └────────────────┘
```

---

## 🎯 Data Models

### Skill Model
```typescript
interface Skill {
  name: string;              // "web_research"
  version: string;           // "1.0.0"
  description: string;       // "Search the web..."
  category: string;          // "research"
  tools: string[];           // ["web_search"]
  input_schema: {
    type: "object";
    properties: {
      query: { type: "string" };
      depth: { enum: ["shallow", "deep"] };
    };
    required: ["query"];
  };
  output_format: string;     // "markdown"
  estimated_tokens: number;  // 2000
  tags: string[];            // ["research", "web"]
  markdown: string;          // Full SKILL.md content
  logic?: Function;          // Optional code
}
```

### Workflow Model
```typescript
interface Workflow {
  name: string;              // "Deep Research"
  version: string;
  description: string;
  steps: WorkflowStep[];
  output: string;            // Template string
}

interface WorkflowStep {
  id: string;                // "step_1"
  name: string;              // "Research Planning"
  skill: string;             // "research_planner"
  input: Record<string, any>;
  depends_on?: string[];     // ["step_0"]
  timeout: number;           // 30 (seconds)
  retries: number;           // 2
  fallback?: string;         // Alternative skill
  on_failure?: string;       // "stop" | "continue" | "retry"
}
```

### Execution Metadata
```typescript
interface ExecutionMetadata {
  id: string;                // UUID
  timestamp: Date;
  skill_name: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  success: boolean;
  error?: string;
  cost_usd?: number;
}
```

---

## 🎨 UI Color Palette

```
Primary Colors (Brand):
├─ Brand Red: #D90429 (Call-to-action, alerts)
├─ Dark Gray: #2B2D42 (Headers, backgrounds)
├─ Light Gray: #EDF2F4 (Backgrounds, borders)
└─ Accent: #8D99AE (Secondary text, muted elements)

Semantic Colors:
├─ Success: #10B981 (Green)
├─ Warning: #F59E0B (Orange)
├─ Error: #EF4444 (Red)
├─ Info: #3B82F6 (Blue)
└─ Neutral: #6B7280 (Gray)

Component Examples:
├─ User Message: Dark gray background, white text
├─ Assistant Message: Light gray background, dark text
├─ Tool Invocation: Red accent border, subtle highlight
├─ Button (Primary): Red (#D90429) with white text
└─ Button (Secondary): Light gray with dark text
```

---

## 📈 Performance Targets

```
Metric                          | Target    | Rationale
─────────────────────────────────────────────────────────
First Contentful Paint          | < 1s      | SPA, minimal initial load
Chat Input Response             | < 500ms   | Perceived responsiveness
Skill Execution Average         | < 30s     | Tool timeout limit
Streaming Chunk Latency         | < 100ms   | SSE event transmission
Token Counting                  | < 1s      | On-demand calculation
API to AI Model Latency         | < 2s      | OpenAI API average
Full Workflow (3 steps)         | < 90s     | 30s × 3 steps
Memory per Skill (Metadata)     | < 10KB    | Lightweight registry
Total Skill Registry Size       | < 1MB     | All metadata cached
```

---

## 🔐 Security Boundaries

```
┌─ BROWSER (Untrusted) ─────────┐
│  - User input                 │
│  - Can be manipulated         │
│  - Must validate server-side  │
└─────────────────────────────────┘
         │ HTTPS Boundary
         ▼
┌─ EDGE RUNTIME (Trusted) ──────┐
│  - API Key access             │
│  - Skill execution            │
│  - Tool validation            │
│                               │
│ Sandboxing Rules:             │
│ - No file system access       │
│ - Only whitelisted APIs       │
│ - Max 30s execution time      │
│ - Memory limits enforced       │
│ - Network restricted          │
└──────────────────────────────┘
         │ Secure Routes
         ▼
┌─ EXTERNAL SERVICES ────────────┐
│  - OpenAI API (over HTTPS)    │
│  - Whitelisted 3rd party APIs │
│  - Verified endpoints         │
└──────────────────────────────┘
```

---

## 📚 Dependency Tree

```
skillsflow-ai/
├── next@15.0+
│   ├── react@19
│   └── react-dom@19
├── ai@5.0+
│   └── @ai-sdk/openai
│       └── openai SDK
├── zustand (state management)
├── framer-motion (animations)
├── tailwindcss@3.4+
├── shadcn/ui (components)
├── lucide-react (icons)
├── react-markdown (Markdown parsing)
├── rehype-highlight (code highlighting)
├── yaml (Workflow parsing)
└── typescript@5.6+
```

---

## ⚡ Streaming Protocol

```
Client Requests: POST /api/agent

Server Responds with:

event: start
data: {"id":"msg-123","timestamp":"..."}

event: skill_selected
data: {"skill":"web_research","reason":"..."}

event: skill_executing
data: {"skill":"web_research","params":{...}}

event: skill_completed
data: {"skill":"web_research","result":{"..."},"duration_ms":2500}

event: content_chunk
data: {"type":"text","content":"The latest trends..."}

event: content_chunk
data: {"type":"text","content":" show renewable"}

event: done
data: {"success":true,"total_duration_ms":5000}
```

---

This visual reference should help the team quickly understand system design without reading through detailed documentation. Print this and post it in your development workspace! 🎨

