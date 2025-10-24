/**
 * Integration Tests for Workflow Execution
 * Tests multi-step workflows, skill chaining, context propagation, and error scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { JsonValue, Workflow } from '@/types';

type SkillInput = Record<string, unknown>;
type SkillOutput = Record<string, unknown>;

interface RegisteredSkill {
  logic?: (input: SkillInput) => Promise<SkillOutput> | SkillOutput;
}

interface SkillRegistration {
  name: string;
  skill: RegisteredSkill;
}

interface ExecutionLogEntry {
  stepId: string;
  skillName: string;
  input: SkillInput;
  output: SkillOutput;
  duration: number;
  timestamp: Date;
}

type WorkflowResults = Record<string, SkillOutput>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStepResult(results: WorkflowResults, stepId: string): SkillOutput | undefined {
  return results[stepId];
}

function getStringField(record: SkillOutput | undefined, key: string): string {
  if (!record) {
    return '';
  }
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function getStringInput(input: SkillInput, key: string): string {
  const value = input[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Workflow Execution Engine for testing
 */
class WorkflowExecutionEngine {
  private skills: Map<string, RegisteredSkill> = new Map();
  private executionLog: ExecutionLogEntry[] = [];

  registerSkills(skillsData: SkillRegistration[]): void {
    skillsData.forEach(({ name, skill }) => {
      this.skills.set(name, skill);
    });
  }

  /**
   * Execute a workflow end-to-end
   */
  async executeWorkflow(
    workflow: Workflow,
    options: {
      globalTimeout?: number;
      stepTimeout?: number;
      onStepStart?: (stepId: string) => void;
      onStepComplete?: (stepId: string, result: SkillOutput) => void;
      onStepFail?: (stepId: string, error: Error) => void;
    } = {}
  ): Promise<{
    success: boolean;
    results: WorkflowResults;
    errors: Record<string, string>;
    duration: number;
    stepsExecuted: number;
    executionLog: ExecutionLogEntry[];
  }> {
    const {
      globalTimeout = 30000,
      stepTimeout = 10000,
      onStepStart,
      onStepComplete,
      onStepFail,
    } = options;

    const startTime = Date.now();
  const results: WorkflowResults = {};
    const errors: Record<string, string> = {};
    const executedSteps = new Set<string>();
    const failedSteps = new Set<string>();

    // Execute steps respecting dependencies
    let stepIndex = 0;
    while (stepIndex < workflow.steps.length) {
      const unexecutedSteps = workflow.steps.filter(
        (s) => !executedSteps.has(s.id) && !failedSteps.has(s.id)
      );

      if (unexecutedSteps.length === 0) break;

      // Find steps ready to execute (dependencies satisfied)
      const readySteps = unexecutedSteps.filter((step) => {
        if (!step.depends_on || step.depends_on.length === 0) {
          return true;
        }
        return step.depends_on.every((dep) => executedSteps.has(dep));
      });

      if (readySteps.length === 0) {
        throw new Error('Deadlock: no ready steps but workflow not complete');
      }

      // Execute ready steps
      const stepPromises = readySteps.map(async (step) => {
        onStepStart?.(step.id);

        try {
          // Check global timeout
          if (Date.now() - startTime > globalTimeout) {
            throw new Error('Global workflow timeout exceeded');
          }

          // Replace variables in input
          const replacedInput = this.replaceVariables(step.input, { steps: results });
          const input = isPlainObject(replacedInput) ? (replacedInput as SkillInput) : {};

          // Execute skill with timeout
          const result = await this.runWithTimeout(
            () => this.executeSkill(step.skill, input),
            stepTimeout,
            step.id,
          );

          results[step.id] = result;
          executedSteps.add(step.id);
          onStepComplete?.(step.id, result);

          return { stepId: step.id, success: true };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors[step.id] = errorMsg;

          if (step.on_failure === 'stop') {
            throw new Error(`Workflow stopped at step ${step.id}: ${errorMsg}`);
          }

          failedSteps.add(step.id);
          const failureError = error instanceof Error ? error : new Error(errorMsg);
          onStepFail?.(step.id, failureError);

          return { stepId: step.id, success: false };
        }
      });

      await Promise.all(stepPromises);
      stepIndex++;
    }

    const duration = Date.now() - startTime;

    return {
      success: failedSteps.size === 0,
      results,
      errors,
      duration,
      stepsExecuted: executedSteps.size,
      executionLog: this.executionLog,
    };
  }

  /**
   * Execute a skill
   */
  private async executeSkill(skillName: string, input: SkillInput): Promise<SkillOutput> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const startTime = Date.now();

    try {
      const result: SkillOutput = skill.logic
        ? await skill.logic(input)
        : { status: 'completed' };
      const duration = Date.now() - startTime;

      this.executionLog.push({
        stepId: skillName,
        skillName,
        input,
        output: result,
        duration,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  private async runWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    stepId: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timeout: ${stepId}`));
      }, timeoutMs);

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          clearTimeout(timer);
        });
    });
  }

  /**
   * Replace variables in step input
   */
  private replaceVariables(input: JsonValue, context: Record<string, unknown>): JsonValue {
    if (typeof input === 'string') {
      const regex = /\{\{\s*([^}]+)\s*\}\}/g;
      return input.replace(regex, (match, key) => {
        const keys = key.trim().split('.');
        let value: unknown = context;

        for (const segment of keys) {
          if (isPlainObject(value)) {
            value = value[segment];
          } else if (Array.isArray(value)) {
            const index = Number(segment);
            value = Number.isInteger(index) ? value[index] : undefined;
          } else {
            value = undefined;
          }

          if (value === undefined) {
            break;
          }
        }

        return value !== undefined ? String(value) : match;
      });
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.replaceVariables(item, context));
    }

    if (isPlainObject(input)) {
      const result: Record<string, JsonValue> = {};
      for (const [key, value] of Object.entries(input)) {
        result[key] = this.replaceVariables(value as JsonValue, context);
      }
      return result;
    }

    return input;
  }

  clearLog(): void {
    this.executionLog = [];
  }
}

describe('Workflow Execution Integration Tests', () => {
  let engine: WorkflowExecutionEngine;

  beforeEach(() => {
    engine = new WorkflowExecutionEngine();

    // Register test skills
    engine.registerSkills([
      {
        name: 'research',
        skill: {
          logic: async (input: SkillInput) => ({
            findings: `Researched: ${getStringInput(input, 'query')}`,
            sources: 5,
          }),
        },
      },
      {
        name: 'summarize',
        skill: {
          logic: async (input: SkillInput) => ({
            summary: `Summary of: ${getStringInput(input, 'content')}`,
            wordCount: 100,
          }),
        },
      },
      {
        name: 'report_writer',
        skill: {
          logic: async (input: SkillInput) => ({
            report: `Report: ${getStringInput(input, 'title')}`,
            sections: 5,
          }),
        },
      },
    ]);
  });

  describe('Simple Linear Workflows', () => {
    it('should execute workflow with single step', async () => {
      const workflow: Workflow = {
        name: 'Single Step',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'research',
            skill: 'research',
            input: { query: 'AI trends' },
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
  const researchResult = getStepResult(result.results, 'research');
  expect(researchResult).toBeDefined();
  expect(getStringField(researchResult, 'findings')).toContain('AI trends');
      expect(result.stepsExecuted).toBe(1);
    });

    it('should execute linear workflow (A -> B -> C)', async () => {
      const workflow: Workflow = {
        name: 'Linear Workflow',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'renewable energy' },
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: { content: '{{ steps.step1.findings }}' },
            depends_on: ['step1'],
          },
          {
            id: 'step3',
            skill: 'report_writer',
            input: { title: '{{ steps.step2.summary }}' },
            depends_on: ['step2'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(3);
  const step1Result = getStepResult(result.results, 'step1');
  const step2Result = getStepResult(result.results, 'step2');
  const step3Result = getStepResult(result.results, 'step3');
  expect(step1Result).toBeDefined();
  expect(step2Result).toBeDefined();
  expect(step3Result).toBeDefined();

      // Verify context propagation
  expect(getStringField(step2Result, 'summary')).toContain('Researched');
  expect(getStringField(step3Result, 'report')).toContain('Summary');
    });
  });

  describe('Context and Variable Propagation', () => {
    it('should propagate step results to next step via templates', async () => {
      const workflow: Workflow = {
        name: 'Context Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'solar energy' },
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: { content: '{{ steps.step1.findings }}' },
            depends_on: ['step1'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

  const step2Result = getStepResult(result.results, 'step2');
  expect(getStringField(step2Result, 'summary')).toContain('solar energy');
    });

    it('should handle complex variable replacements', async () => {
      const workflow: Workflow = {
        name: 'Complex Variables',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test query' },
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: {
              content: 'Results: {{ steps.step1.findings }}, Sources: {{ steps.step1.sources }}',
            },
            depends_on: ['step1'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

  const step2Result = getStepResult(result.results, 'step2');
  expect(getStringField(step2Result, 'summary')).toContain('5'); // sources count
    });

    it('should handle nested variable paths', async () => {
      const workflow: Workflow = {
        name: 'Nested Variables',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'nested test' },
          },
          {
            id: 'step2',
            skill: 'summarize',
            input: { content: 'Key finding: {{ steps.step1.findings }}' },
            depends_on: ['step1'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.results.step2).toBeDefined();
    });
  });

  describe('Parallel Execution', () => {
    it('should execute independent steps in parallel', async () => {
      const workflow: Workflow = {
        name: 'Parallel Steps',
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
            skill: 'summarize',
            input: { content: 'Combining results' },
            depends_on: ['research1', 'research2'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.results.research1).toBeDefined();
      expect(result.results.research2).toBeDefined();
      expect(result.results.combine).toBeDefined();
      expect(result.stepsExecuted).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle step failure with continue strategy', async () => {
      engine.registerSkills([
        {
          name: 'failing_skill',
          skill: {
            logic: async (): Promise<SkillOutput> => {
              throw new Error('Skill execution failed');
            },
          },
        },
      ]);

      const workflow: Workflow = {
        name: 'Error Handling',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'failing_skill',
            input: {},
            on_failure: 'continue',
          },
          {
            id: 'step2',
            skill: 'research',
            input: { query: 'backup' },
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(result.errors.step1).toContain('failed');
  expect(getStepResult(result.results, 'step2')).toBeDefined();
    });

    it('should stop workflow on critical failure', async () => {
      engine.registerSkills([
        {
          name: 'failing_skill',
          skill: {
            logic: async (): Promise<SkillOutput> => {
              throw new Error('Critical failure');
            },
          },
        },
      ]);

      const workflow: Workflow = {
        name: 'Critical Failure',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'failing_skill',
            input: {},
            on_failure: 'stop',
          },
          {
            id: 'step2',
            skill: 'research',
            input: { query: 'should not run' },
          },
        ],
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Workflow stopped');
    });

    it('should handle missing skills', async () => {
      const workflow: Workflow = {
        name: 'Missing Skill',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'nonexistent_skill',
            input: {},
            on_failure: 'continue',
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(false);
      expect(result.errors.step1).toContain('not found');
    });
  });

  describe('Timeouts', () => {
    it('should timeout individual steps', async () => {
      engine.registerSkills([
        {
          name: 'slow_skill',
          skill: {
            logic: async (): Promise<SkillOutput> => {
              await new Promise((resolve) => setTimeout(resolve, 200));
              return { result: 'done' };
            },
          },
        },
      ]);

      const workflow: Workflow = {
        name: 'Timeout Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'slow_skill',
            input: {},
            on_failure: 'continue',
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow, {
        stepTimeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.errors.step1).toContain('timeout');
    });

    it('should timeout entire workflow', async () => {
      engine.registerSkills([
        {
          name: 'slow_skill',
          skill: {
            logic: async (): Promise<SkillOutput> => {
              await new Promise((resolve) => setTimeout(resolve, 100));
              return { result: 'done' };
            },
          },
        },
      ]);

      const workflow: Workflow = {
        name: 'Global Timeout',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'slow_skill',
            input: {},
          },
          {
            id: 'step2',
            skill: 'slow_skill',
            input: {},
            depends_on: ['step1'],
            on_failure: 'continue',
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow, {
        globalTimeout: 50,
      });

      expect(result.success).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });
  });

  describe('Execution Tracking', () => {
    it('should track execution with callbacks', async () => {
      const events: string[] = [];

      const workflow: Workflow = {
        name: 'Tracking',
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
            input: { content: 'test' },
            depends_on: ['step1'],
          },
        ],
      };

      await engine.executeWorkflow(workflow, {
        onStepStart: (stepId) => events.push(`start:${stepId}`),
        onStepComplete: (stepId) => events.push(`complete:${stepId}`),
      });

      expect(events).toEqual(['start:step1', 'complete:step1', 'start:step2', 'complete:step2']);
    });

    it('should record execution duration', async () => {
      const workflow: Workflow = {
        name: 'Duration Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test' },
          },
        ],
      };

      const startTime = Date.now();
      const result = await engine.executeWorkflow(workflow);
      const duration = Date.now() - startTime;

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(duration + 100); // Allow some overhead
    });

    it('should maintain execution log', async () => {
      const workflow: Workflow = {
        name: 'Log Test',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'test' },
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.executionLog.length).toBeGreaterThan(0);
      expect(result.executionLog[0]).toHaveProperty('skillName');
      expect(result.executionLog[0]).toHaveProperty('input');
      expect(result.executionLog[0]).toHaveProperty('output');
      expect(result.executionLog[0]).toHaveProperty('duration');
      expect(result.executionLog[0]).toHaveProperty('timestamp');
    });
  });

  describe('Complex Multi-step Workflows', () => {
    it('should execute research -> summarize -> report workflow', async () => {
      const workflow: Workflow = {
        name: 'Research Report Workflow',
        version: '1.0.0',
        description: 'Complete research workflow',
        steps: [
          {
            id: 'research',
            skill: 'research',
            input: { query: 'artificial intelligence trends' },
          },
          {
            id: 'summarize',
            skill: 'summarize',
            input: { content: '{{ steps.research.findings }}' },
            depends_on: ['research'],
          },
          {
            id: 'report',
            skill: 'report_writer',
            input: { title: 'AI Trends Report' },
            depends_on: ['summarize'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(3);

      // Verify data flows through the pipeline
  const summarizeResult = getStepResult(result.results, 'summarize');
  const reportResult = getStepResult(result.results, 'report');
  expect(getStringField(summarizeResult, 'summary')).toContain('artificial intelligence');
  expect(getStringField(reportResult, 'report')).toContain('AI Trends Report');
    });

    it('should handle diamond dependency pattern', async () => {
      const workflow: Workflow = {
        name: 'Diamond Pattern',
        version: '1.0.0',
        description: 'Test',
        steps: [
          {
            id: 'step1',
            skill: 'research',
            input: { query: 'base' },
          },
          {
            id: 'step2',
            skill: 'research',
            input: { query: 'left' },
            depends_on: ['step1'],
          },
          {
            id: 'step3',
            skill: 'research',
            input: { query: 'right' },
            depends_on: ['step1'],
          },
          {
            id: 'step4',
            skill: 'summarize',
            input: { content: 'combine' },
            depends_on: ['step2', 'step3'],
          },
        ],
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(4);
    });
  });
});
