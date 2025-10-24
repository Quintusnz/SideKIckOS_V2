/**
 * SideKick - Core Type Definitions
 * Central place for all TypeScript interfaces and types
 */

/**
 * Lightweight JSON-compatible value types used for skill IO definitions.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Skill Metadata - Extracted from SKILL.md frontmatter
 */
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  category: string;
  tools: string[];
  input_schema: Record<string, JsonValue>;
  output_format: string;
  estimated_tokens?: number;
  author?: string;
  tags?: string[];
}

/**
 * Skill - Complete skill with metadata and optional logic
 */
export type SkillInvocationInput = Record<string, JsonValue>;

export type SkillInvocationResult =
  | JsonValue
  | {
      type: 'markdown_skill';
      metadata: SkillMetadata;
      markdown: string;
      input: SkillInvocationInput;
    }
  | {
      type: 'metadata_only';
      status: 'completed' | 'pending';
      skill: string;
      metadata: SkillMetadata;
      note: string;
      input?: SkillInvocationInput;
    };

export interface Skill {
  metadata: SkillMetadata;
  markdown: string;
  logic?: (
    input: SkillInvocationInput,
    executionContext?: Record<string, unknown>,
  ) => Promise<JsonValue>;
}

/**
 * Workflow Step - Individual step in a workflow
 */
export interface WorkflowStep {
  id: string;
  name?: string;
  skill: string;
  input: Record<string, JsonValue>;
  timeout?: number;
  retries?: number;
  fallback?: string;
  on_failure?: 'stop' | 'continue' | 'retry';
  depends_on?: string[];
}

/**
 * Workflow - Complete workflow definition
 */
export interface Workflow {
  name: string;
  version: string;
  description: string;
  trigger?: string;
  steps: WorkflowStep[];
}

/**
 * Tool Invocation - When AI calls a tool/skill
 */
export interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, JsonValue>;
  state: 'input-available' | 'output-available';
  result?: JsonValue;
}

/**
 * Message - Chat message from either user or assistant
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolInvocation[];
  toolResults?: Array<{
    toolCallId: string;
    result: JsonValue;
  }>;
  createdAt?: Date;
}

/**
 * Workflow Execution - Current state of workflow execution
 */
export interface WorkflowExecution {
  id: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowStepExecution[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Workflow Step Execution - Execution of a single step
 */
export interface WorkflowStepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, JsonValue>;
  output?: JsonValue;
  error?: string;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * API Response - Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/**
 * Skill Registry Configuration
 */
export interface SkillRegistryConfig {
  skillsDir: string;
  workflowsDir: string;
  cacheMetadata: boolean;
  lazyLoadLogic: boolean;
}
