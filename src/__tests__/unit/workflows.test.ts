/**
 * Unit Tests for Workflow Engine
 * Tests workflow parsing, validation, step resolution, and execution logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JsonValue, Workflow, WorkflowStep } from '@/types';

type TemplateContext = Record<string, JsonValue>;

interface WorkflowDefinition {
  name?: string;
  version?: string;
  description?: string;
  trigger?: string;
  steps?: WorkflowStep[];
}

type JsonObject = Record<string, JsonValue>;

type SkillExecutionResults = Record<string, JsonValue>;
type SkillExecutor = (skillName: string, input: JsonObject) => Promise<JsonValue>;

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Mock Workflow Engine for testing
 */
class MockWorkflowEngine {
  /**
   * Parse workflow from YAML-like object
   */
  parseWorkflow(workflowData: WorkflowDefinition): Workflow {
    if (!workflowData.name || !workflowData.version || !workflowData.steps) {
      throw new Error('Invalid workflow: missing required fields (name, version, steps)');
    }

    if (!Array.isArray(workflowData.steps) || workflowData.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    return {
      name: workflowData.name,
      version: workflowData.version,
      description: workflowData.description || '',
      steps: workflowData.steps,
      trigger: workflowData.trigger,
    };
  }

  /**
   * Validate workflow structure and dependencies
   */
  validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check step IDs are unique
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (!step.id) {
        errors.push('Step missing ID');
      } else if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID: ${step.id}`);
      } else {
        stepIds.add(step.id);
      }

      // Check skill is specified
      if (!step.skill) {
        errors.push(`Step ${step.id} missing skill`);
      }

      // Check dependencies exist
      if (step.depends_on) {
        for (const dep of step.depends_on) {
          if (!stepIds.has(dep)) {
            errors.push(`Step ${step.id} depends on non-existent step ${dep}`);
          }
        }
      }

      // Check timeout is positive
      if (step.timeout !== undefined && step.timeout <= 0) {
        errors.push(`Step ${step.id} has invalid timeout: ${step.timeout}`);
      }

      // Check retries is non-negative
      if (step.retries !== undefined && step.retries < 0) {
        errors.push(`Step ${step.id} has invalid retries: ${step.retries}`);
      }
    }

    // Check for circular dependencies
    const circular = this.detectCircularDependencies(workflow);
    if (circular.length > 0) {
      errors.push(`Circular dependencies detected: ${circular.join(' -> ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect circular dependencies in workflow steps
   */
  private detectCircularDependencies(workflow: Workflow): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find((s) => s.id === stepId);
      if (!step || !step.depends_on) {
        recursionStack.delete(stepId);
        return false;
      }

      for (const dep of step.depends_on) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recursionStack.has(dep)) {
          return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of workflow.steps) {
      if (!visited.has(step.id)) {
        if (dfs(step.id)) {
          return [step.id];
        }
      }
    }

    return [];
  }

  /**
   * Resolve execution order based on dependencies
   */
  resolveExecutionOrder(workflow: Workflow): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (stepId: string) => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected at step ${stepId}`);
      }

      visiting.add(stepId);

      const step = workflow.steps.find((s) => s.id === stepId);
      if (step?.depends_on) {
        for (const dep of step.depends_on) {
          dfs(dep);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      sorted.push(stepId);
    };

    for (const step of workflow.steps) {
      dfs(step.id);
    }

    return sorted;
  }

  /**
   * Template variable replacement
   */
  replaceVariables(template: string, context: TemplateContext): string {
    let result = template;

    // Replace {{ variable }} patterns
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;
    result = result.replace(regex, (match, key) => {
      const keys = key.trim().split('.');
      let current: JsonValue | undefined = context;

      for (const segment of keys) {
        if (isJsonObject(current) && segment in current) {
          current = current[segment];
        } else {
          current = undefined;
          break;
        }
      }

      return current !== undefined ? String(current) : match;
    });

    return result;
  }

  /**
   * Replace variables in step input
   */
  replaceStepVariables(step: WorkflowStep, context: TemplateContext): JsonObject {
    const input: JsonObject = {};

    for (const [key, value] of Object.entries(step.input)) {
      input[key] = this.replaceJsonValue(value, context);
    }

    return input;
  }

  /**
   * Get next steps to execute (respecting dependencies)
   */
  getNextSteps(
    workflow: Workflow,
    executedSteps: Set<string>,
    failedSteps: Set<string>
  ): string[] {
    const nextSteps: string[] = [];

    for (const step of workflow.steps) {
      if (executedSteps.has(step.id)) continue;
      if (failedSteps.has(step.id)) continue;

      // Check if all dependencies are executed
      const allDepsExecuted = !step.depends_on || step.depends_on.every((dep) => executedSteps.has(dep));

      if (allDepsExecuted) {
        nextSteps.push(step.id);
      }
    }

    return nextSteps;
  }

  /**
   * Simulate workflow execution
   */
  async simulateExecution(
    workflow: Workflow,
    mockSkillExecutor: SkillExecutor
  ): Promise<{
    success: boolean;
    results: SkillExecutionResults;
    errors: Record<string, string>;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const results: SkillExecutionResults = {};
    const errors: Record<string, string> = {};
    const executedSteps = new Set<string>();
    const failedSteps = new Set<string>();

    // Validate workflow first
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
    }

    let nextSteps = this.getNextSteps(workflow, executedSteps, failedSteps);

    while (nextSteps.length > 0) {
      // Execute next steps
      const stepPromises = nextSteps.map(async (stepId) => {
        const step = workflow.steps.find((s) => s.id === stepId)!;

        try {
          // Build context from previous steps
          const context: TemplateContext = { steps: results as JsonValue };

          // Replace variables in input
          const input = this.replaceStepVariables(step, context);

          // Execute skill
          const result = await mockSkillExecutor(step.skill, input);
          results[stepId] = result;
          executedSteps.add(stepId);

          return { stepId, success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors[stepId] = errorMsg;
          failedSteps.add(stepId);

          // Handle error strategy
          if (step.on_failure === 'stop') {
            throw new Error(`Workflow stopped at step ${stepId}: ${errorMsg}`);
          }

          return { stepId, success: false };
        }
      });

      await Promise.all(stepPromises);

      // Get next batch
      nextSteps = this.getNextSteps(workflow, executedSteps, failedSteps);
    }

    const executionTime = Date.now() - startTime;

    return {
      success: failedSteps.size === 0,
      results,
      errors,
      executionTime,
    };
  }

    private replaceJsonValue(value: JsonValue, context: TemplateContext): JsonValue {
      if (typeof value === 'string') {
        return this.replaceVariables(value, context);
      }

      if (Array.isArray(value)) {
        return value.map((item) => this.replaceJsonValue(item, context));
      }

      if (isJsonObject(value)) {
        return Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, this.replaceJsonValue(nestedValue, context)]),
        );
      }

      return value;
    }
}

describe('Workflow Engine - Unit Tests', () => {
  let engine: MockWorkflowEngine;

  beforeEach(() => {
    engine = new MockWorkflowEngine();
  });

  describe('Workflow Parsing', () => {
    it('should parse valid workflow', () => {
      const workflowData = {
        name: 'Test Workflow',
        version: '1.0.0',
        description: 'A test workflow',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test' },
          },
        ],
      };

      const workflow = engine.parseWorkflow(workflowData);

      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.steps).toHaveLength(1);
    });

    it('should throw error for missing name', () => {
      const workflowData = {
        version: '1.0.0',
        steps: [],
      };

      expect(() => engine.parseWorkflow(workflowData)).toThrow('missing required fields');
    });

    it('should throw error for missing steps', () => {
      const workflowData = {
        name: 'Test',
        version: '1.0.0',
      };

      expect(() => engine.parseWorkflow(workflowData)).toThrow('missing required fields');
    });

    it('should throw error for empty steps array', () => {
      const workflowData = {
        name: 'Test',
        version: '1.0.0',
        steps: [],
      };

      expect(() => engine.parseWorkflow(workflowData)).toThrow('at least one step');
    });
  });

  describe('Workflow Validation', () => {
    it('should validate correct workflow', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate step IDs', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step1',
            skill: 'summarize',
            input: {},
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect invalid dependencies', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
            depends_on: ['nonexistent'],
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('non-existent'))).toBe(true);
    });

    it('should detect invalid timeout', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
            timeout: -1,
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid timeout'))).toBe(true);
    });

    it('should detect invalid retries', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
            retries: -1,
          },
        ],
      };

      const result = engine.validateWorkflow(workflow);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid retries'))).toBe(true);
    });
  });

  describe('Execution Order Resolution', () => {
    it('should resolve linear workflow', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {},
            depends_on: ['step1'],
          },
          {
            id: 'step3',
            skill: 'report',
            input: {},
            depends_on: ['step2'],
          },
        ],
      };

      const order = engine.resolveExecutionOrder(workflow);

      expect(order).toEqual(['step1', 'step2', 'step3']);
    });

    it('should resolve workflow with multiple dependencies', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step2',
            skill: 'research2',
            input: {},
          },
          {
            id: 'step3',
            skill: 'combine',
            input: {},
            depends_on: ['step1', 'step2'],
          },
        ],
      };

      const order = engine.resolveExecutionOrder(workflow);

      expect(order).toContain('step1');
      expect(order).toContain('step2');
      expect(order.indexOf('step3')).toBeGreaterThan(Math.max(
        order.indexOf('step1'),
        order.indexOf('step2')
      ));
    });

    it('should throw on circular dependencies', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
            depends_on: ['step2'],
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {},
            depends_on: ['step1'],
          },
        ],
      };

      expect(() => engine.resolveExecutionOrder(workflow)).toThrow('Circular dependency');
    });
  });

  describe('Variable Templating', () => {
    it('should replace simple variables', () => {
      const template = 'Research on {{ topic }}';
      const context = { topic: 'solar energy' };

      const result = engine.replaceVariables(template, context);

      expect(result).toBe('Research on solar energy');
    });

    it('should replace nested variables', () => {
      const template = 'Step 1 result: {{ steps.step1.output }}';
      const context = {
        steps: {
          step1: {
            output: 'Research complete',
          },
        },
      };

      const result = engine.replaceVariables(template, context);

      expect(result).toBe('Step 1 result: Research complete');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Result: {{ missing_var }}';
      const context = {};

      const result = engine.replaceVariables(template, context);

      expect(result).toContain('{{ missing_var }}');
    });

    it('should replace variables in step input object', () => {
      const step: WorkflowStep = {
        id: 'step2',
        skill: 'summarize',
        input: {
          content: '{{ steps.step1.output }}',
          format: 'bullet_points',
        },
      };

      const context = {
        steps: {
          step1: {
            output: 'Research findings',
          },
        },
      };

      const result = engine.replaceStepVariables(step, context);

      expect(result.content).toBe('Research findings');
      expect(result.format).toBe('bullet_points');
    });
  });

  describe('Next Steps Calculation', () => {
    it('should identify steps with no dependencies as next', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step2',
            skill: 'research2',
            input: {},
          },
          {
            id: 'step3',
            skill: 'combine',
            input: {},
            depends_on: ['step1', 'step2'],
          },
        ],
      };

      const nextSteps = engine.getNextSteps(workflow, new Set(), new Set());

      expect(nextSteps).toContain('step1');
      expect(nextSteps).toContain('step2');
      expect(nextSteps).not.toContain('step3');
    });

    it('should unlock dependent steps after execution', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {},
            depends_on: ['step1'],
          },
        ],
      };

      let nextSteps = engine.getNextSteps(workflow, new Set(), new Set());
      expect(nextSteps).toEqual(['step1']);

      const executed = new Set(['step1']);
      nextSteps = engine.getNextSteps(workflow, executed, new Set());
      expect(nextSteps).toEqual(['step2']);
    });

    it('should not include failed steps in next steps', () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {},
            depends_on: ['step1'],
          },
        ],
      };

      const executed = new Set<string>();
      const failed = new Set(['step1']);

      const nextSteps = engine.getNextSteps(workflow, executed, failed);

      expect(nextSteps).not.toContain('step1');
      expect(nextSteps).not.toContain('step2');
    });
  });

  describe('Workflow Execution Simulation', () => {
    it('should execute simple linear workflow', async () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test' },
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: { content: '{{ steps.step1 }}' },
          },
        ],
      };

      const mockExecutor = vi.fn<SkillExecutor>(async (skill, input) => {
        return { skill, input, success: true };
      });

      const result = await engine.simulateExecution(workflow, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('step1');
      expect(result.results).toHaveProperty('step2');
      expect(result.errors).toEqual({});
      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });

    it('should handle execution errors', async () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test' },
            on_failure: 'continue',
          },
        ],
      };

      const mockExecutor = vi.fn<SkillExecutor>(async (_skill, _input) => {
        void _skill;
        void _input;
        throw new Error('Skill failed');
      });

      const result = await engine.simulateExecution(workflow, mockExecutor);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveProperty('step1');
      expect(result.errors.step1).toContain('Skill failed');
    });

    it('should measure execution time', async () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
          },
        ],
      };

      const mockExecutor = vi.fn<SkillExecutor>(async (_skill, _input) => {
        void _skill;
        void _input;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true };
      });

      const result = await engine.simulateExecution(workflow, mockExecutor);

      expect(result.executionTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Multi-step Workflows', () => {
    it('should handle parallel steps (independent dependencies)', async () => {
      const workflow: Workflow = {
        name: 'Parallel Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'research1',
            skill: 'research',
            input: { query: 'query1' },
          },
          {
            id: 'research2',
            skill: 'research',
            input: { query: 'query2' },
          },
          {
            id: 'combine',
            skill: 'combine',
            input: {},
            depends_on: ['research1', 'research2'],
          },
        ],
      };

      const executionOrder: string[] = [];
      const mockExecutor = vi.fn<SkillExecutor>(async (skill, input) => {
        const query = isJsonObject(input) && typeof input.query === 'string' ? input.query : undefined;
        executionOrder.push(query ?? skill);
        return { success: true };
      });

      const result = await engine.simulateExecution(workflow, mockExecutor);

  expect(result.success).toBe(true);
  // Both research calls should happen before the combine step completes
  expect(executionOrder.slice(0, 2)).toEqual(expect.arrayContaining(['query1', 'query2']));
  expect(executionOrder.at(-1)).toBe('combine');
    });

    it('should fail workflow if on_failure is stop', async () => {
      const workflow: Workflow = {
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: {},
            on_failure: 'stop',
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {},
          },
        ],
      };

      const mockExecutor = vi.fn<SkillExecutor>(async (skill, _input) => {
        void _input;
        if (skill === 'research') {
          throw new Error('Research failed');
        }
        return { success: true };
      });

      await expect(engine.simulateExecution(workflow, mockExecutor)).rejects.toThrow(
        'Workflow stopped'
      );
    });
  });
});
