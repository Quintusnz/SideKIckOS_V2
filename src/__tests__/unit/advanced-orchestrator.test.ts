/**
 * Unit Tests for Advanced Orchestrator Features
 * Tests parallel execution, error recovery, caching, and advanced tool calling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { JsonValue, SkillMetadata } from '@/types';
import { z } from 'zod';

type SkillInput = Record<string, unknown>;
type SkillOutput = Record<string, unknown>;

type SkillLogic = (input: SkillInput) => Promise<SkillOutput> | SkillOutput;

interface RegisteredSkill {
  metadata?: SkillMetadata;
  logic?: SkillLogic;
}

interface SkillRegistration {
  name: string;
  skill: RegisteredSkill;
}

interface ExecutionRecord {
  skillName: string;
  input: SkillInput;
  result: SkillOutput;
  duration: number;
  timestamp: Date;
}

interface ParallelSkillCall {
  skillName: string;
  input: SkillInput;
  retries?: number;
}

interface ParallelSkillResult {
  skillName: string;
  result: SkillOutput | null;
  error?: Error;
  duration: number;
}

interface ExecutionMetrics {
  totalExecutions: number;
  averageDuration: number;
  fastestExecution: number;
  slowestExecution: number;
  executionsBySkill: Record<string, { count: number; avgDuration: number }>;
}

type JsonCompatibleDefault = JsonValue;

interface SchemaFieldBase {
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: JsonCompatibleDefault;
}

interface StringSchemaField extends SchemaFieldBase {
  type: 'string';
  enum?: string[];
}

interface NumberSchemaField extends SchemaFieldBase {
  type: 'number';
}

interface BooleanSchemaField extends SchemaFieldBase {
  type: 'boolean';
}

interface ArraySchemaField extends SchemaFieldBase {
  type: 'array';
  itemsType?: SchemaField;
}

type SchemaField = StringSchemaField | NumberSchemaField | BooleanSchemaField | ArraySchemaField;

type SchemaDefinition = Record<string, SchemaField>;

interface ToolDefinition {
  name: string;
  description: string;
  parameters: SchemaDefinition;
}

type ToolCallResult = SkillOutput | { error: string };

interface ToolCallSummary {
  toolCalls: Array<{ toolName: string; input: SkillInput; order: number }>;
  results: Record<string, ToolCallResult>;
}

/**
 * Advanced Orchestrator with caching and retry logic
 */
class AdvancedOrchestrator {
  private skills: Map<string, RegisteredSkill> = new Map();
  private resultCache: Map<string, SkillOutput> = new Map();
  private executionHistory: ExecutionRecord[] = [];

  registerSkills(skillsData: SkillRegistration[]): void {
    skillsData.forEach(({ name, skill }) => {
      this.skills.set(name, skill);
    });
  }

  /**
   * Execute skill with retry logic and caching
   */
  async executeSkillWithRetry(
    skillName: string,
    input: SkillInput,
    options: {
      retries?: number;
      backoffMultiplier?: number;
      initialBackoffMs?: number;
      useCache?: boolean;
      cacheKeyPrefix?: string;
    } = {}
  ): Promise<{ result: SkillOutput; attempts: number; cached: boolean }> {
    const {
      retries = 3,
      backoffMultiplier = 2,
      initialBackoffMs = 100,
      useCache = true,
      cacheKeyPrefix = '',
    } = options;

    // Check cache first
    const cacheKey = `${cacheKeyPrefix}:${skillName}:${JSON.stringify(input)}`;
    if (useCache && this.resultCache.has(cacheKey)) {
      const cachedResult = this.resultCache.get(cacheKey);
      if (cachedResult !== undefined) {
      return {
          result: cachedResult,
        attempts: 0,
        cached: true,
      };
    }
    }

    let lastError: Error | null = null;
    let backoffMs = initialBackoffMs;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        const skill = this.skills.get(skillName);

        if (!skill) {
          throw new Error(`Skill not found: ${skillName}`);
        }

        const result: SkillOutput = skill.logic ? await skill.logic(input) : { status: 'completed' };

        const duration = Date.now() - startTime;

        // Cache result
        if (useCache) {
          this.resultCache.set(cacheKey, result);
        }

        // Record execution
        this.executionHistory.push({
          skillName,
          input,
          result,
          duration,
          timestamp: new Date(),
        });

        return { result, attempts: attempt, cached: false };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs *= backoffMultiplier;
        }
      }
    }

    throw new Error(
      `Skill '${skillName}' failed after ${retries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Execute multiple skills in parallel
   */
  async executeSkillsParallel(
    skillCalls: ParallelSkillCall[],
  ): Promise<ParallelSkillResult[]> {
    const promises = skillCalls.map(async (call): Promise<ParallelSkillResult> => {
      const startTime = Date.now();

      try {
        const { result } = await this.executeSkillWithRetry(
          call.skillName,
          call.input,
          { retries: call.retries }
        );

        return {
          skillName: call.skillName,
          result,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        return {
          skillName: call.skillName,
          result: null,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime,
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Create Zod schema with caching
   */
  private schemaCache: Map<string, z.ZodType<Record<string, unknown>>> = new Map();

  createZodSchema(inputSchema: SchemaDefinition): z.ZodType<Record<string, unknown>> {
    const cacheKey = JSON.stringify(inputSchema);
    if (this.schemaCache.has(cacheKey)) {
      return this.schemaCache.get(cacheKey)!;
    }

    const fields: Record<string, z.ZodTypeAny> = {};

    Object.entries(inputSchema).forEach(([key, def]) => {
      let fieldSchema: z.ZodTypeAny;

      switch (def.type) {
        case 'string':
          if (def.enum && def.enum.length > 0) {
            fieldSchema = z.union(def.enum.map((value) => z.literal(value)));
          } else {
            fieldSchema = z.string();
          }
          break;
        case 'number':
          fieldSchema = z.number();
          break;
        case 'boolean':
          fieldSchema = z.boolean();
          break;
        case 'array':
          fieldSchema = z.array(z.unknown());
          break;
        default:
          fieldSchema = z.unknown();
      }

      if (def.default !== undefined) {
        fieldSchema = fieldSchema.optional().default(def.default as never);
      } else if (!def.required) {
        fieldSchema = fieldSchema.optional();
      }

      fields[key] = fieldSchema;
    });

    const schema = z.object(fields);
    this.schemaCache.set(cacheKey, schema);
    return schema;
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(): ExecutionMetrics {
    if (this.executionHistory.length === 0) {
      return {
        totalExecutions: 0,
        averageDuration: 0,
        fastestExecution: 0,
        slowestExecution: 0,
        executionsBySkill: {},
      };
    }

    const durations = this.executionHistory.map((e) => e.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const executionsBySkill: Record<string, { count: number; avgDuration: number }> = {};

    this.executionHistory.forEach((execution) => {
      if (!executionsBySkill[execution.skillName]) {
        executionsBySkill[execution.skillName] = { count: 0, avgDuration: 0 };
      }
      executionsBySkill[execution.skillName].count += 1;
    });

    Object.entries(executionsBySkill).forEach(([skillName, summary]) => {
      const skillExecutions = this.executionHistory.filter((e) => e.skillName === skillName);
      const skillDurations = skillExecutions.map((e) => e.duration);
      const skillTotal = skillDurations.reduce((a, b) => a + b, 0);
      summary.avgDuration = skillTotal / Math.max(skillDurations.length, 1);
    });

    return {
      totalExecutions: this.executionHistory.length,
      averageDuration: totalDuration / durations.length,
      fastestExecution: Math.min(...durations),
      slowestExecution: Math.max(...durations),
      executionsBySkill,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.resultCache.clear();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Tool calling simulation with state management
   */
  async simulateToolCalling(
    userQuery: string,
    availableTools: ToolDefinition[],
  ): Promise<ToolCallSummary> {
    // Simulate AI decision making for which tools to call
    const toolCalls: Array<{ toolName: string; input: SkillInput; order: number }> = [];

    // Improved heuristic: if query mentions skill name (with underscores and spaces interchangeable)
    for (const tool of availableTools) {
      const toolNameVariant1 = tool.name.toLowerCase();
      const toolNameVariant2 = tool.name.toLowerCase().replace(/_/g, ' ');
      const queryLower = userQuery.toLowerCase();
      
      if (queryLower.includes(toolNameVariant1) || queryLower.includes(toolNameVariant2)) {
        toolCalls.push({
          toolName: tool.name,
          input: { query: userQuery },
          order: toolCalls.length,
        });
      }
    }

    // Execute tools
    const results: Record<string, ToolCallResult> = {};
    for (const call of toolCalls) {
      try {
        const { result } = await this.executeSkillWithRetry(call.toolName, call.input);
        results[call.toolName] = result;
      } catch (error) {
        results[call.toolName] = { error: (error as Error).message };
      }
    }

    return { toolCalls, results };
  }
}

describe('Advanced Orchestrator - Unit Tests', () => {
  let orchestrator: AdvancedOrchestrator;

  beforeEach(() => {
    orchestrator = new AdvancedOrchestrator();

    // Register test skills
    orchestrator.registerSkills([
      {
        name: 'research',
        skill: {
          metadata: {
            name: 'Research',
            description: 'Research skill',
            category: 'research',
            version: '1.0.0',
            tools: [],
            input_schema: { query: { type: 'string' } },
            output_format: 'markdown',
          },
          logic: async (input: SkillInput) => ({
            findings: `Research for ${input.query}`,
          }),
        },
      },
      {
        name: 'summarize',
        skill: {
          metadata: {
            name: 'Summarize',
            description: 'Summarization skill',
            category: 'text',
            version: '1.0.0',
            tools: [],
            input_schema: { content: { type: 'string' } },
            output_format: 'markdown',
          },
          logic: async (input: SkillInput) => ({
            summary: `Summary of ${input.content}`,
          }),
        },
      },
    ]);
  });

  afterEach(() => {
    orchestrator.clearCache();
    orchestrator.clearHistory();
  });

  describe('Skill Execution with Retry', () => {
    it('should execute skill successfully on first try', async () => {
      const result = await orchestrator.executeSkillWithRetry('research', { query: 'test' });

      expect(result.attempts).toBe(1);
      expect(result.cached).toBe(false);
      expect(result.result).toEqual({ findings: 'Research for test' });
    });

    it('should use cache on second execution', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test' });
      const result = await orchestrator.executeSkillWithRetry('research', { query: 'test' });

      expect(result.cached).toBe(true);
      expect(result.attempts).toBe(0);
    });

    it('should not use cache if disabled', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test' }, {
        useCache: true,
      });
      const result = await orchestrator.executeSkillWithRetry('research', { query: 'test' }, {
        useCache: false,
      });

      expect(result.cached).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('should clear cache', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test' });
      orchestrator.clearCache();
      const result = await orchestrator.executeSkillWithRetry('research', { query: 'test' });

      expect(result.cached).toBe(false);
    });

    it('should throw error after max retries', async () => {
      orchestrator.registerSkills([
        {
          name: 'failing_skill',
          skill: {
            metadata: {
              name: 'Failing',
              description: 'Always fails',
              category: 'test',
              version: '1.0.0',
              tools: [],
              input_schema: {},
              output_format: 'json',
            },
            logic: async () => {
              throw new Error('Skill error');
            },
          },
        },
      ]);

      await expect(
        orchestrator.executeSkillWithRetry('failing_skill', {}, { retries: 2 })
      ).rejects.toThrow('failed after 2 attempts');
    });

    it('should throw error for non-existent skill', async () => {
      await expect(
        orchestrator.executeSkillWithRetry('nonexistent', {})
      ).rejects.toThrow('Skill not found');
    });
  });

  describe('Parallel Skill Execution', () => {
    it('should execute multiple skills in parallel', async () => {
      const startTime = Date.now();

      const results = await orchestrator.executeSkillsParallel([
        { skillName: 'research', input: { query: 'query1' } },
        { skillName: 'research', input: { query: 'query2' } },
      ]);

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results[0].result).toEqual({ findings: 'Research for query1' });
      expect(results[1].result).toEqual({ findings: 'Research for query2' });

      // Parallel execution should be faster than sequential
      // Each skill takes minimal time, so total should be < sequential time
      expect(duration).toBeLessThan(100); // Loose check
    });

    it('should handle errors in parallel execution', async () => {
      orchestrator.registerSkills([
        {
          name: 'failing_skill',
          skill: {
            metadata: {
              name: 'Failing',
              description: 'Fails',
              category: 'test',
              version: '1.0.0',
              tools: [],
              input_schema: {},
              output_format: 'json',
            },
            logic: async () => {
              throw new Error('Parallel error');
            },
          },
        },
      ]);

      const results = await orchestrator.executeSkillsParallel([
        { skillName: 'research', input: { query: 'test' } },
        { skillName: 'failing_skill', input: {} },
      ]);

      expect(results[0].result).toBeTruthy();
      expect(results[0].error).toBeUndefined();

      expect(results[1].result).toBeNull();
      expect(results[1].error).toBeDefined();
      expect(results[1].error?.message).toContain('Parallel error');
    });

    it('should measure execution duration for parallel calls', async () => {
      const results = await orchestrator.executeSkillsParallel([
        { skillName: 'research', input: { query: 'test' } },
        { skillName: 'summarize', input: { content: 'test' } },
      ]);

      results.forEach((result) => {
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Schema Generation and Caching', () => {
    it('should generate Zod schema from input schema', () => {
      const inputSchema: SchemaDefinition = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
        active: { type: 'boolean' },
      };

      const schema = orchestrator.createZodSchema(inputSchema);

      const valid = schema.safeParse({ name: 'John', age: 30, active: true });
      expect(valid.success).toBe(true);
    });

    it('should handle enum values in schema', () => {
      const inputSchema: SchemaDefinition = {
        style: { type: 'string', enum: ['bullet', 'paragraph', 'executive'], required: true },
      };

      const schema = orchestrator.createZodSchema(inputSchema);

      const valid = schema.safeParse({ style: 'bullet' });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({ style: 'invalid' });
      expect(invalid.success).toBe(false);
    });

    it('should cache generated schemas', () => {
      const inputSchema: SchemaDefinition = {
        query: { type: 'string', required: true },
      };

      const schema1 = orchestrator.createZodSchema(inputSchema);
      const schema2 = orchestrator.createZodSchema(inputSchema);

      expect(schema1).toBe(schema2); // Same reference due to caching
    });

    it('should handle default values', () => {
      const inputSchema: SchemaDefinition = {
        format: { type: 'string', default: 'json', required: false },
      };

      const schema = orchestrator.createZodSchema(inputSchema);

      const valid = schema.safeParse({});
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.format).toBe('json');
      }
    });

    it('should handle array types', () => {
      const inputSchema: SchemaDefinition = {
        items: { type: 'array', required: true },
      };

      const schema = orchestrator.createZodSchema(inputSchema);

      const valid = schema.safeParse({ items: [1, 2, 3] });
      expect(valid.success).toBe(true);
    });
  });

  describe('Execution Metrics', () => {
    it('should track execution metrics', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test1' });
      await orchestrator.executeSkillWithRetry('research', { query: 'test2' });
      await orchestrator.executeSkillWithRetry('summarize', { content: 'test' });

      const metrics = orchestrator.getExecutionMetrics();

      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.averageDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.fastestExecution).toBeGreaterThanOrEqual(0);
      expect(metrics.slowestExecution).toBeGreaterThanOrEqual(metrics.fastestExecution);
    });

    it('should track metrics by skill', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test' });
      await orchestrator.executeSkillWithRetry('research', { query: 'test2' });
      await orchestrator.executeSkillWithRetry('summarize', { content: 'test' });

      const metrics = orchestrator.getExecutionMetrics();

      expect(metrics.executionsBySkill.research.count).toBe(2);
      expect(metrics.executionsBySkill.summarize.count).toBe(1);
    });

    it('should handle empty execution history', () => {
      const metrics = orchestrator.getExecutionMetrics();

      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.averageDuration).toBe(0);
    });

    it('should clear history', async () => {
      await orchestrator.executeSkillWithRetry('research', { query: 'test' });
      orchestrator.clearHistory();

      const metrics = orchestrator.getExecutionMetrics();
      expect(metrics.totalExecutions).toBe(0);
    });
  });

  describe('Tool Calling Simulation', () => {
    it('should identify and call appropriate tools', async () => {
      const availableTools: ToolDefinition[] = [
        {
          name: 'research',
          description: 'Research skill',
          parameters: { query: { type: 'string', required: true } },
        },
        {
          name: 'summarize',
          description: 'Summarize skill',
          parameters: { content: { type: 'string', required: true } },
        },
      ];

      const result = await orchestrator.simulateToolCalling(
        'I need to research solar energy',
        availableTools
      );

      expect(result.toolCalls.length).toBeGreaterThan(0);
      expect(result.toolCalls[0].toolName).toBe('research');
      expect(result.results).toHaveProperty('research');
    });

    it('should call multiple tools if mentioned', async () => {
      const availableTools: ToolDefinition[] = [
        {
          name: 'research',
          description: 'Research',
          parameters: {},
        },
        {
          name: 'summarize',
          description: 'Summarize',
          parameters: {},
        },
      ];

      const result = await orchestrator.simulateToolCalling(
        'Research and summarize the topic',
        availableTools
      );

      expect(result.toolCalls.length).toBe(2);
    });

    it('should handle tool execution errors in results', async () => {
      orchestrator.registerSkills([
        {
          name: 'failing_tool',
          skill: {
            metadata: {
              name: 'Failing',
              description: 'Fails',
              category: 'test',
              version: '1.0.0',
              tools: [],
              input_schema: {},
              output_format: 'json',
            },
            logic: async () => {
              throw new Error('Tool execution failed');
            },
          },
        },
      ]);

      const availableTools: ToolDefinition[] = [
        {
          name: 'failing_tool',
          description: 'Failing tool',
          parameters: {},
        },
      ];

      const result = await orchestrator.simulateToolCalling(
        'failing tool',
        availableTools
      );

      expect(result.results).toHaveProperty('failing_tool');
      expect(result.results.failing_tool).toHaveProperty('error');
    });
  });

  describe('Error Recovery', () => {
    it('should implement exponential backoff', async () => {
      let attemptCount = 0;
      orchestrator.registerSkills([
        {
          name: 'flaky_skill',
          skill: {
            metadata: {
              name: 'Flaky',
              description: 'Fails twice then succeeds',
              category: 'test',
              version: '1.0.0',
              tools: [],
              input_schema: {},
              output_format: 'json',
            },
            logic: async () => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Not ready yet');
              }
              return { success: true };
            },
          },
        },
      ]);

      const startTime = Date.now();
      const result = await orchestrator.executeSkillWithRetry('flaky_skill', {}, {
        retries: 3,
        initialBackoffMs: 50,
        backoffMultiplier: 2,
      });
      const duration = Date.now() - startTime;

      expect(result.attempts).toBe(3);
      expect(result.result).toEqual({ success: true });
      // Should have delays between attempts: 50ms + 100ms = 150ms minimum
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});
