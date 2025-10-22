# SkillsFlow AI - Clarification Q&A

**Purpose:** Address ambiguities in the PRD and provide decision points  
**Status:** Awaiting your input

---

## 🤔 Strategic Questions

### Q1: Should we use GPT-5 (thinking model) or GPT-5?

**Context:** The PRD mentions "GPT-5 (thinking model)" but OpenAI's current model lineup is:
- `gpt-5` (latest reasoning model - if available)
- `gpt-4.0-turbo`
- `gpt-4-turbo`

**Options:**
- **A)** Use the latest available OpenAI model (current recommended)
- **B)** Wait for official GPT-5 release and hardcode model selection
- **C)** Make model selection configurable via environment variables

**Recommendation:** **Option C** (configurable) - allows quick pivot if models change

**Implementation:**
```typescript
const model = openai(process.env.AI_MODEL || 'gpt-4-turbo');
```

---

### Q2: Should skills be JavaScript/TypeScript executable or Markdown-only?

**Context:** PRD shows both `SKILL.md` (instructions) and `logic.js` (optional code).

**Options:**
- **A)** Both supported (AI-interpreted markdown OR executable code)
- **B)** Markdown-only (safer, AI decides execution)
- **C)** Code-only (faster, but requires sandboxing)
- **D)** Hybrid: Simple skills are Markdown, complex ones have executable code

**Recommendation:** **Option D** (Hybrid)
- Markdown for pure AI-reasoning tasks (research, analysis)
- Code for deterministic tasks (calculations, formatting)

**Example:**
```
/skills/
├── research/          # Markdown-only (AI driven)
├── calculator/        # Code-only (deterministic)
└── report_writer/     # Hybrid (has both)
```

---

### Q3: How should workflows handle failures?

**Context:** What happens when Step 2 fails?

**Options:**
- **A)** Stop entire workflow, return error
- **B)** Skip to next independent step, mark as failed
- **C)** Implement retry logic with backoff
- **D)** Call fallback skill if primary fails

**Recommendation:** **Option C + D** combined

**Workflow YAML:**
```yaml
steps:
  - id: step_1
    skill: web_search
    timeout: 30
    retries: 2
    fallback: cached_search
    on_failure: continue  # or 'stop' or 'retry'
```

---

### Q4: Should users be able to create custom skills at runtime?

**Context:** MVP has hardcoded skill registry. Future extensibility?

**Options:**
- **A)** No - skills only added by developers
- **B)** Yes - users can upload Markdown files
- **C)** Yes - users can write inline logic in the UI
- **D)** Yes - users can import from GitHub/npm

**Recommendation for MVP:** **Option A** (hardcoded)

**Future (Phase 2):** Support Option B + D

---

### Q5: What about authentication and multi-user support?

**Context:** PRD doesn't mention auth, but production apps need it.

**Options:**
- **A)** MVP: No auth (local development only)
- **B)** MVP: Simple API key auth
- **C)** MVP: OAuth (GitHub, Google)
- **D)** Implement user accounts with Supabase/Firebase

**Recommendation for MVP:** **Option A** (no auth for now)

**Future:** Add with NextAuth.js when needed

---

### Q6: Should workflow results be persisted?

**Context:** Do we save execution history?

**Options:**
- **A)** No persistence (ephemeral, in-memory)
- **B)** Browser local storage only
- **C)** Database (Supabase, MongoDB)
- **D)** Cloud storage (AWS S3)

**Recommendation for MVP:** **Option A** (in-memory)

**Future:** Add Option B when history is needed

---

## 🎨 UI/UX Questions

### Q7: How should skill invocations be displayed in the chat?

**Context:** Users should see which skill was called and why.

**Options:**
- **A)** Simple text: "Using skill: web_search"
- **B)** Card UI with skill icon, name, parameters
- **C)** Expandable timeline showing all tool calls
- **D)** Toggle between chat view and detailed execution view

**Recommendation:** **Option B + C** combined

**Visual Example:**
```
┌─────────────────────────────────────┐
│ 🔍 Skill: Web Research              │
│ ├─ Query: "renewable energy 2025"   │
│ ├─ Status: In Progress... ⏳        │
│ └─ Results: [10 articles found]     │
└─────────────────────────────────────┘
```

---

### Q8: What output format should we prioritize?

**Context:** Skills can return different formats.

**Options:**
- **A)** Always convert to Markdown
- **B)** Support Markdown + JSON + HTML
- **C)** Let skills define their own format
- **D)** Standardize on JSON, render based on type

**Recommendation:** **Option A** (Markdown-first)

**Reasoning:** 
- Markdown is flexible and can represent most content
- Easy to parse and render
- Fallback for unknown formats

---

## 🔧 Technical Questions

### Q9: How deep can workflows nest?

**Context:** Can workflows call other workflows?

**Options:**
- **A)** No nesting (workflows can only call skills)
- **B)** Shallow nesting (workflows → workflows → skills only)
- **C)** Unlimited nesting
- **D)** Maximum depth of 3 levels

**Recommendation:** **Option D** (max depth 3)

**Reasoning:**
- Prevents infinite loops
- Easier to debug and reason about
- Avoids token budget explosions

---

### Q10: Should skills have state/memory?

**Context:** Should a skill remember previous executions?

**Options:**
- **A)** Stateless - each execution is independent
- **B)** Session state - remember within one chat session
- **C)** Persistent state - remember across sessions
- **D)** User-managed state - skill can save to database

**Recommendation for MVP:** **Option A** (stateless)

**Future:** Add Option B with caching

---

### Q11: How should we handle concurrent skill execution?

**Context:** Can multiple skills run in parallel?

**Options:**
- **A)** All skills run sequentially
- **B)** Independent skills run in parallel (within workflow)
- **C)** User can manually specify parallel execution
- **D)** AI decides when to parallelize

**Recommendation:** **Option B** (based on dependencies)

**Workflow YAML:**
```yaml
steps:
  - id: [step_1a, step_1b]  # Parallel
    skills: [search, summarize]
  - id: step_2              # Sequential (depends on 1a, 1b)
    skill: report_writer
```

---

### Q12: What's the maximum workflow complexity for MVP?

**Context:** Prevent runaway costs and timeouts.

**Options:**
- **A)** Simple: Linear sequence, max 3 steps
- **B)** Moderate: DAG (Directed Acyclic Graph), max 5 steps
- **C)** Complex: Full orchestration, max 10 steps
- **D)** Unlimited (subject to timeouts)

**Recommendation:** **Option B** (DAG, max 5 steps)

**Reasoning:**
- Most workflows fit this pattern
- Manageable complexity for MVP
- Can extend later

---

## 📊 Data & Analytics Questions

### Q13: Should we track token usage per skill?

**Context:** Optimize costs and diagnose slow skills.

**Options:**
- **A)** No tracking (let it be)
- **B)** Track total tokens per session
- **C)** Track per-skill and per-step tokens
- **D)** Display token costs in the UI

**Recommendation:** **Option C + visualization**

**Implementation:**
```typescript
interface ExecutionMetrics {
  skill_name: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_usd: number;
}
```

---

### Q14: Should we implement usage limits?

**Context:** Prevent runaway API costs.

**Options:**
- **A)** No limits (MVP, sandbox environment)
- **B)** Per-session limit (e.g., max 100K tokens/session)
- **C)** Per-user daily limit
- **D)** Per-skill limit (e.g., web_search limited to 10 calls/session)

**Recommendation:** **Option B** for MVP

**Future:** Add Option C + D with user accounts

---

## 🔒 Security & Compliance Questions

### Q15: Which APIs should skills have access to?

**Context:** Security-critical - what can skills call?

**Options:**
- **A)** Any API (no restrictions, sandbox only)
- **B)** Whitelist specific APIs (web search, GitHub, etc.)
- **C)** Sandbox with no external API access
- **D)** Only internal APIs

**Recommendation:** **Option B** (whitelist)

**Example Whitelist:**
```typescript
const ALLOWED_APIS = [
  'api.duckduckgo.com',      // Web search
  'api.github.com',           // GitHub
  'api.coindesk.com',         // Crypto data
  // Others added on demand
];
```

---

### Q16: Should we implement audit logging?

**Context:** Track who ran what and when.

**Options:**
- **A)** No logging (MVP, local only)
- **B)** Console logging only
- **C)** File-based logging
- **D)** Database logging with search UI

**Recommendation:** **Option B** for MVP → **Option C** for production

---

## 📅 Timeline & Scope Questions

### Q17: What's the minimum viable MVP?

**Based on PRD priorities, here's what MUST ship:**

**Tier 1 (Essential):**
- ✅ Chat interface with streaming
- ✅ Skill discovery & invocation (at least 2 skills)
- ✅ Basic workflow execution (2-3 step workflow)
- ✅ Error handling & retry logic

**Tier 2 (Nice to have):**
- ⭐ Execution timeline visualization
- ⭐ Markdown → Rich UI rendering
- ⭐ Multiple workflows (3+)

**Tier 3 (Future):**
- 🚀 Workflow editor (visual)
- 🚀 Skill marketplace
- 🚀 Multi-user support
- 🚀 Persistent execution history

**Recommendation:** Ship Tier 1 in 2 weeks, add Tier 2 in week 3-4.

---

### Q18: How many example skills should we create?

**Context:** Demonstrate the system's capabilities.

**Recommendation:**

**MVP Launch (Minimum):**
- `web_search` - Search the web
- `summarizer` - Summarize content
- `report_writer` - Format into reports

**Phase 2 (Add more):**
- `data_analyzer` - Analyze data
- `code_generator` - Generate code snippets
- `translator` - Translate text

---

## 🎯 Final Decision Matrix

| Question | Recommended Choice | Confidence | Revisit? |
|----------|-------------------|------------|----------|
| Q1: Model selection | C (Configurable) | High | Never |
| Q2: Skill types | D (Hybrid) | Medium | Phase 2 |
| Q3: Failure handling | C + D | High | Never |
| Q4: Custom skills | A (Dev-only) | High | Phase 2 |
| Q5: Auth | A (None for MVP) | High | Phase 2 |
| Q6: Persistence | A (Ephemeral) | High | Phase 2 |
| Q7: UI for skills | B + C | High | Phase 3 |
| Q8: Output format | A (Markdown-first) | High | Never |
| Q9: Workflow depth | D (Max 3) | Medium | Phase 2 |
| Q10: Skill state | A (Stateless) | High | Phase 2 |
| Q11: Concurrency | B (DAG-based) | High | Phase 2 |
| Q12: Max complexity | B (DAG, 5 steps) | Medium | Phase 2 |
| Q13: Token tracking | C (Per-skill) | High | Production |
| Q14: Usage limits | B (Per-session) | Medium | Production |
| Q15: API access | B (Whitelist) | High | Always |
| Q16: Audit logging | B (Console) | High | Production |
| Q17: MVP scope | Tier 1 | High | Never |
| Q18: Example skills | 3 minimum | High | Phase 2 |

---

## ✅ Pre-Development Checklist

Before starting development, confirm:

- [ ] **Model Choice:** OpenAI API key ready?
- [ ] **Skill Types:** Agreed on Markdown + optional code?
- [ ] **Workflows:** DAG-based orchestration confirmed?
- [ ] **Security:** Whitelisted APIs defined?
- [ ] **Scope:** Tier 1 features only for MVP?
- [ ] **Timeline:** 4 weeks for MVP realistic?
- [ ] **Team:** Developers + designer (if UI is priority)?
- [ ] **Environment:** Next.js 15 project ready?

---

## 📧 Next Steps

1. **Review this document** - Do these decisions align with your vision?
2. **Answer any unclear questions** - I'll provide more details
3. **Confirm recommendations** - Let me know if you'd prefer different choices
4. **Ready to build** - Once aligned, implementation can start immediately

---

**Questions? Let me know, and I'll clarify further!**

