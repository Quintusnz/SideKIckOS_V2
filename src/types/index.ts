/**
 * SkillsFlow AI - Core Type Definitions
 * Central place for all TypeScript interfaces and types
 */

/**
 * Skill Metadata - Extracted from SKILL.md frontmatter
 */
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  category: string;
  tools: string[];
  input_schema: Record<string, any>;
  output_format: string;
  estimated_tokens?: number;
  author?: string;
  tags?: string[];
}

/**
 * Skill - Complete skill with metadata and optional logic
 */
export interface Skill {
  metadata: SkillMetadata;
  markdown: string;
  logic?: (input: any) => Promise<any>;
}

/**
 * Workflow Step - Individual step in a workflow
 */
export interface WorkflowStep {
  id: string;
  name?: string;
  skill: string;
  input: Record<string, any>;
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
  args: Record<string, any>;
  state: 'input-available' | 'output-available';
  result?: any;
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
    result: any;
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
  input?: Record<string, any>;
  output?: any;
  error?: string;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * API Response - Standard API response format
 */
export interface ApiResponse<T = any> {
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
