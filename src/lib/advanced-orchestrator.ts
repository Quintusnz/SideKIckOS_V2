/**
 * Advanced Skills Orchestrator
 * Provides retry logic, caching, parallel execution, and metrics tracking
 */

import { z } from 'zod';
import type {
  JsonValue,
  Skill,
  SkillInvocationInput,
  SkillInvocationResult,
} from '@/types';

/**
 * Execution metrics for a skill
 */
export interface ExecutionMetrics {
  skillName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecutedAt: Date | null;
  cacheHits: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Parallel execution result
 */
export interface ParallelExecutionResult {
  success: boolean;
  results: Record<string, SkillInvocationResult>;
  errors: Record<string, Error>;
  executionDuration: number;
}

/**
 * Cached result with TTL
 */
interface CachedResult {
  value: SkillInvocationResult;
  timestamp: number;
  ttl: number;
}

/**
 * AdvancedOrchestrator - Extends basic orchestration with advanced features
 */
export class AdvancedOrchestrator {
  private skills: Map<string, Skill> = new Map();
  private cache: Map<string, CachedResult> = new Map();
  private metrics: Map<string, ExecutionMetrics> = new Map();
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  };

  /**
   * Register skills
   */
  registerSkills(skillsData: Array<{ name: string; skill: Skill }>): void {
    skillsData.forEach(({ name, skill }) => {
      this.skills.set(name, skill);
      this.metrics.set(name, {
        skillName: name,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastExecutedAt: null,
        cacheHits: 0,
      });
    });
  }

  hasSkill(skillName: string): boolean {
    return this.skills.has(skillName);
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Execute skill with exponential backoff retry
   */
  async executeSkillWithRetry(
    skillName: string,
    input: SkillInvocationInput,
    maxAttempts?: number,
  ): Promise<SkillInvocationResult> {
    const attempts = maxAttempts || this.retryConfig.maxAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await this.executeSkill(skillName, input);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < attempts) {
          // Calculate backoff delay
          const delay = Math.min(
            this.retryConfig.initialDelayMs *
              Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelayMs,
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Skill execution failed');
  }

  /**
   * Execute skill with caching
   */
  async executeSkillCached(
    skillName: string,
    input: SkillInvocationInput,
    ttlMs: number = 60000,
  ): Promise<SkillInvocationResult> {
    const cacheKey = this.getCacheKey(skillName, input);
    const cached = this.cache.get(cacheKey);

    // Check cache validity
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      const metrics = this.metrics.get(skillName);
      if (metrics) {
        metrics.cacheHits++;
      }
      return cached.value;
    }

    // Cache miss - execute skill
    const result = await this.executeSkill(skillName, input);

    // Store in cache
    this.cache.set(cacheKey, {
      value: result,
      timestamp: Date.now(),
      ttl: ttlMs,
    });

    return result;
  }

  /**
   * Execute multiple skills in parallel
   */
  async executeSkillsParallel(
    executions: Array<{ skillName: string; input: SkillInvocationInput }>,
  ): Promise<ParallelExecutionResult> {
    const startTime = performance.now();
    const results: Record<string, SkillInvocationResult> = {};
    const errors: Record<string, Error> = {};

    const promises = executions.map(async ({ skillName, input }, index) => {
      try {
        const result = await this.executeSkill(skillName, input);
        results[`${skillName}_${index}`] = result;
      } catch (error) {
        errors[`${skillName}_${index}`] =
          error instanceof Error ? error : new Error(String(error));
      }
    });

    await Promise.all(promises);

    const executionDuration = performance.now() - startTime;

    return {
      success: Object.keys(errors).length === 0,
      results,
      errors,
      executionDuration,
    };
  }

  /**
   * Create Zod schema from input schema
   */
  createZodSchema(
    inputSchema: Record<string, JsonValue>,
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const fields: Record<string, z.ZodTypeAny> = {};

    Object.entries(inputSchema).forEach(([key, definition]) => {
      const schema = this.resolveSchemaDefinition(definition);
      const isRequired = this.isFieldRequired(definition);

      let enrichedSchema = schema;

      if (!isRequired) {
        enrichedSchema = enrichedSchema.optional();
      }

      const defaultValue = this.getDefaultValue(definition);
      if (defaultValue !== undefined && 'default' in enrichedSchema) {
        enrichedSchema = (enrichedSchema as z.ZodTypeAny).default(defaultValue);
      }

      const description = this.getDescription(definition);
      if (description) {
        enrichedSchema = enrichedSchema.describe(description);
      }

      fields[key] = enrichedSchema;
    });

    return z.object(fields);
  }

  /**
   * Generate schema from a skill's input_schema
   */
  generateSchemaForSkill(
    skillName: string,
  ): z.ZodObject<Record<string, z.ZodTypeAny>> | null {
    const skill = this.skills.get(skillName);
    if (!skill || !skill.metadata || !skill.metadata.input_schema) {
      return null;
    }

    return this.createZodSchema(skill.metadata.input_schema);
  }

  /**
   * Get execution metrics for a skill
   */
  getExecutionMetrics(skillName?: string): ExecutionMetrics | ExecutionMetrics[] {
    if (skillName) {
      return this.metrics.get(skillName) || {
        skillName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        lastExecutedAt: null,
        cacheHits: 0,
      };
    }

    return Array.from(this.metrics.values());
  }

  /**
   * Clear cache
   */
  clearCache(skillName?: string): void {
    if (skillName) {
      // Clear cache entries for specific skill
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.startsWith(skillName)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(skillName?: string): void {
    if (skillName) {
      const metrics = this.metrics.get(skillName);
      if (metrics) {
        metrics.totalExecutions = 0;
        metrics.successfulExecutions = 0;
        metrics.failedExecutions = 0;
        metrics.averageDuration = 0;
        metrics.minDuration = Infinity;
        metrics.maxDuration = 0;
        metrics.lastExecutedAt = null;
        metrics.cacheHits = 0;
      }
    } else {
      this.metrics.forEach((metrics) => {
        metrics.totalExecutions = 0;
        metrics.successfulExecutions = 0;
        metrics.failedExecutions = 0;
        metrics.averageDuration = 0;
        metrics.minDuration = Infinity;
        metrics.maxDuration = 0;
        metrics.lastExecutedAt = null;
        metrics.cacheHits = 0;
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Simulate tool calling with error handling
   */
  simulateToolCalling(
    toolName: string,
    shouldFail: boolean = false,
  ): {
    toolName: string;
    executed: boolean;
    error?: string;
  } {
    // Normalize tool name for matching (handle underscores/spaces)
    const normalizedToolName = toolName.toLowerCase().replace(/_/g, ' ');

    if (shouldFail || normalizedToolName.includes('fail')) {
      return {
        toolName,
        executed: false,
        error: `Tool ${toolName} execution failed`,
      };
    }

    return {
      toolName,
      executed: true,
    };
  }

  /**
   * Execute skill (public for workflow execution engine)
   */
  async executeSkill(
    skillName: string,
    input: SkillInvocationInput,
  ): Promise<SkillInvocationResult> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const startTime = performance.now();
    const metrics = this.metrics.get(skillName);

    try {
      const result: SkillInvocationResult = skill.logic
        ? await skill.logic(input)
        : {
            status: 'completed',
            skill: skillName,
          };

      // Update metrics on success
      if (metrics) {
        const duration = performance.now() - startTime;
        metrics.totalExecutions++;
        metrics.successfulExecutions++;
        metrics.lastExecutedAt = new Date();
        metrics.minDuration = Math.min(metrics.minDuration, duration);
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        metrics.averageDuration =
          (metrics.averageDuration * (metrics.successfulExecutions - 1) + duration) /
          metrics.successfulExecutions;
      }

      return result;
    } catch (error) {
      // Update metrics on failure
      if (metrics) {
        metrics.totalExecutions++;
        metrics.failedExecutions++;
        metrics.lastExecutedAt = new Date();
      }

      throw error;
    }
  }

  /**
   * Private: Generate cache key from skill name and input
   */
  private getCacheKey(
    skillName: string,
    input: SkillInvocationInput,
  ): string {
    return `${skillName}:${JSON.stringify(input)}`;
  }

  private resolveSchemaDefinition(definition: JsonValue): z.ZodTypeAny {
    if (definition == null) {
      return z.any();
    }

    if (typeof definition === 'string') {
      return this.schemaFromPrimitive(definition);
    }

    if (Array.isArray(definition)) {
      const [first] = definition;
      return z.array(this.resolveSchemaDefinition(first ?? {}));
    }

    if (!this.isRecord(definition)) {
      return z.any();
    }

    if (
      Array.isArray(definition.enum) &&
      definition.enum.length > 0 &&
      definition.enum.every((value) => typeof value === 'string')
    ) {
      return z.enum(definition.enum as [string, ...string[]]);
    }

    const type =
      (definition.type as string | undefined) ??
      (definition.dataType as string | undefined);

    if (type === 'array') {
      const itemDefinition =
        (definition.items as JsonValue | undefined) ??
        (definition.element as JsonValue | undefined) ??
        {};
      return z.array(this.resolveSchemaDefinition(itemDefinition));
    }

    if (type === 'object') {
      const properties =
        (definition.properties as Record<string, JsonValue> | undefined) ??
        (definition.fields as Record<string, JsonValue> | undefined) ??
        {};
      return this.createZodSchema(properties);
    }

    if (type) {
      return this.schemaFromPrimitive(type);
    }

    return z.any();
  }

  private schemaFromPrimitive(type: string): z.ZodTypeAny {
    switch (type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.any());
      case 'object':
        return z.object({}).catchall(z.any());
      default:
        return z.any();
    }
  }

  private isFieldRequired(definition: JsonValue): boolean {
    if (definition == null) return true;
    if (typeof definition === 'string') return true;
    if (!this.isRecord(definition)) return true;

    if (definition.required === false) return false;
    if (definition.optional === true) return false;
    if (definition.default !== undefined) return false;

    return true;
  }

  private getDefaultValue(definition: JsonValue): JsonValue | undefined {
    if (this.isRecord(definition) && 'default' in definition) {
      return definition.default as JsonValue | undefined;
    }
    return undefined;
  }

  private getDescription(definition: JsonValue): string | undefined {
    if (!this.isRecord(definition)) {
      return undefined;
    }

    if (typeof definition.description === 'string') {
      return definition.description;
    }

    if (typeof definition.summary === 'string') {
      return definition.summary;
    }

    return undefined;
  }

  private isRecord(value: JsonValue): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

// Export singleton instance
let advancedOrchestratorInstance: AdvancedOrchestrator | null = null;

export function getAdvancedOrchestrator(): AdvancedOrchestrator {
  if (!advancedOrchestratorInstance) {
    advancedOrchestratorInstance = new AdvancedOrchestrator();
  }
  return advancedOrchestratorInstance;
}

export function resetAdvancedOrchestrator(): void {
  advancedOrchestratorInstance = null;
}
