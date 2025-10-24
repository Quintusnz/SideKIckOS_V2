/**
 * Workflow Engine
 * Handles YAML-based workflow parsing, DAG validation, dependency resolution, and execution
 */

import { parse as parseYaml } from 'yaml';
import type { JsonValue, SkillInvocationResult } from '@/types';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  skill: string;
  input: Record<string, JsonValue>;
  depends_on?: string[];
  timeout?: number;
  retry?: {
    max_attempts: number;
    backoff?: 'exponential' | 'linear';
  };
}

/**
 * Complete workflow definition
 */
export interface Workflow {
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
}

export interface WorkflowContext {
  steps: Record<string, SkillInvocationResult>;
  variables?: Record<string, JsonValue>;
  [key: string]: unknown;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Execution order for workflow steps
 */
export interface ExecutionOrder {
  stepId: string;
  dependencies: string[];
  canExecuteInParallel: string[];
}

/**
 * WorkflowEngine - Parses and executes workflows with DAG validation
 */
export class WorkflowEngine {
  /**
   * Parse YAML workflow definition from string
   */
  parseWorkflow(yamlContent: string): Workflow {
    try {
      const parsed = parseYaml(yamlContent);

      if (!isPlainRecord(parsed)) {
        throw new Error('Workflow definition must be an object');
      }

      if (!parsed.name || !parsed.version || !parsed.steps) {
        throw new Error('Workflow must have: name, version, and steps');
      }

      if (!Array.isArray(parsed.steps)) {
        throw new Error('Workflow steps must be an array');
      }

      const name = String(parsed.name);
      const version = String(parsed.version);
      const description =
        typeof parsed.description === 'string' ? parsed.description : undefined;

  const steps = parsed.steps.map((stepValue: unknown, index: number): WorkflowStep => {
        if (!isPlainRecord(stepValue)) {
          throw new Error(`Workflow step at index ${index} must be an object`);
        }

        const id =
          typeof stepValue.id === 'string' && stepValue.id.trim().length > 0
            ? stepValue.id
            : `step_${index}`;
        const skill = typeof stepValue.skill === 'string' ? stepValue.skill : '';

        if (!skill) {
          throw new Error(`Step ${id} must have a skill`);
        }

        const input = toJsonRecord(stepValue.input);
        const dependsOn = ensureStringArray(stepValue.depends_on);
        const timeout =
          typeof stepValue.timeout === 'number' && Number.isFinite(stepValue.timeout)
            ? stepValue.timeout
            : 30000;

        const retrySource = isPlainRecord(stepValue.retry) ? stepValue.retry : undefined;
        let retry: WorkflowStep['retry'];
        if (retrySource) {
          const maxAttempts =
            typeof retrySource.max_attempts === 'number' &&
            Number.isFinite(retrySource.max_attempts)
              ? retrySource.max_attempts
              : 1;
          const backoff =
            retrySource.backoff === 'exponential' || retrySource.backoff === 'linear'
              ? retrySource.backoff
              : undefined;

          retry = {
            max_attempts: maxAttempts,
            backoff,
          };
        } else {
          retry = undefined;
        }

        return {
          id,
          skill,
          input,
          depends_on: dependsOn,
          timeout,
          retry,
        };
      });

      return {
        name,
        description,
        version,
        steps,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse workflow: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate workflow structure and dependencies
   */
  validateWorkflow(workflow: Workflow): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!workflow.name) errors.push('Workflow must have a name');
    if (!workflow.version) errors.push('Workflow must have a version');
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    // Validate each step
    const stepIds = new Set<string>();
    workflow.steps.forEach((step, index) => {
      if (!step.id) errors.push(`Step ${index} must have an id`);
      if (!step.skill) errors.push(`Step ${step.id || index} must have a skill`);

      if (step.id) {
        if (stepIds.has(step.id)) {
          errors.push(`Duplicate step id: ${step.id}`);
        }
        stepIds.add(step.id);
      }

      // Validate dependencies exist
      if (step.depends_on) {
        step.depends_on.forEach((depId) => {
          if (!workflow.steps.some((s) => s.id === depId)) {
            errors.push(
              `Step ${step.id} depends on non-existent step ${depId}`,
            );
          }
        });
      }
    });

    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies(workflow);
    if (circularDeps.length > 0) {
      errors.push(
        `Circular dependencies detected: ${circularDeps.join(', ')}`,
      );
    }

    // Warnings for best practices
    if (workflow.steps.length > 10) {
      warnings.push(
        `Workflow has ${workflow.steps.length} steps. Consider breaking into smaller workflows.`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect circular dependencies in workflow
   */
  private detectCircularDependencies(workflow: Workflow): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: string[] = [];

    const dfs = (stepId: string): void => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find((s) => s.id === stepId);
      if (!step || !step.depends_on) return;

      for (const dep of step.depends_on) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          circular.push(`${stepId} -> ${dep}`);
        }
      }

      recursionStack.delete(stepId);
    };

    workflow.steps.forEach((step) => {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    });

    return circular;
  }

  /**
   * Resolve execution order using topological sort
   */
  resolveExecutionOrder(workflow: Workflow): ExecutionOrder[] {
    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // Initialize
    workflow.steps.forEach((step) => {
      inDegree.set(step.id, step.depends_on?.length || 0);
      adjacencyList.set(step.id, []);
    });

    // Build graph
    workflow.steps.forEach((step) => {
      step.depends_on?.forEach((depId) => {
        const dependents = adjacencyList.get(depId) || [];
        dependents.push(step.id);
        adjacencyList.set(depId, dependents);
      });
    });

    // Topological sort (Kahn's algorithm)
    const queue: string[] = [];
    workflow.steps.forEach((step) => {
      if ((inDegree.get(step.id) || 0) === 0) {
        queue.push(step.id);
      }
    });

    const sortedSteps: string[] = [];
    while (queue.length > 0) {
      const stepId = queue.shift()!;
      sortedSteps.push(stepId);

      const dependents = adjacencyList.get(stepId) || [];
      dependents.forEach((depId) => {
        const currentDegree = inDegree.get(depId) || 0;
        inDegree.set(depId, currentDegree - 1);

        if (inDegree.get(depId) === 0) {
          queue.push(depId);
        }
      });
    }

    // Convert to ExecutionOrder
    return sortedSteps.map((stepId) => ({
      stepId,
      dependencies: stepMap.get(stepId)?.depends_on || [],
      canExecuteInParallel: this.getParallelExecutableSteps(
        stepId,
        workflow,
      ),
    }));
  }

  /**
   * Find steps that can execute in parallel
   */
  private getParallelExecutableSteps(
    stepId: string,
    workflow: Workflow,
  ): string[] {
    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) return [];

    // Steps with same dependencies can run in parallel
    const sameDeps = workflow.steps.filter(
      (s) =>
        s.id !== stepId &&
        JSON.stringify(s.depends_on || []) ===
          JSON.stringify(step.depends_on || []),
    );

    return sameDeps.map((s) => s.id);
  }

  /**
   * Replace variables in step input using previous step outputs
   */
  replaceVariables(
    input: Record<string, JsonValue>,
    context: WorkflowContext,
  ): Record<string, JsonValue> {
    const result: Record<string, JsonValue> = {};

    Object.entries(input).forEach(([key, value]) => {
      result[key] = this.replaceValue(value, context);
    });

    return result;
  }

  private replaceValue(value: JsonValue, context: WorkflowContext): JsonValue {
    if (typeof value === 'string') {
      return value.includes('{{') ? this.substituteTemplate(value, context) : value;
    }

    if (Array.isArray(value)) {
      const arrayValue = value as JsonValue[];
      return arrayValue.map((item) => this.replaceValue(item, context));
    }

    if (isJsonRecord(value)) {
      const nested: Record<string, JsonValue> = {};
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        nested[nestedKey] = this.replaceValue(nestedValue, context);
      });
      return nested;
    }

    return value;
  }

  /**
   * Substitute template variables in string
   */
  private substituteTemplate(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{(.*?)\}\}/g, (_, rawPath) => {
      const trimmed = rawPath.trim();
      const value = this.getNestedValue(context, trimmed);

      if (value === undefined) {
        return `{{${rawPath}}}`;
      }

      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return String(value);
      }

      try {
        return JSON.stringify(value);
      } catch {
        return '[unserializable]';
      }
    });
  }

  /**
   * Get nested object value using dot notation
   */
  private getNestedValue(context: WorkflowContext, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = context;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(key);
        if (!Number.isInteger(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
        continue;
      }

      if (typeof current === 'object') {
        const record = current as Record<string, unknown>;
        current = record[key];
        continue;
      }

      return undefined;
    }

    return current;
  }

  /**
   * Get next executable steps based on completed steps
   */
  getNextSteps(
    workflow: Workflow,
    completedStepIds: Set<string>,
  ): string[] {
    const executable: string[] = [];

    workflow.steps.forEach((step) => {
      if (completedStepIds.has(step.id)) return; // Already executed

      // Check if all dependencies are completed
      const dependenciesMet =
        (step.depends_on || []).length === 0 ||
        (step.depends_on || []).every((depId) =>
          completedStepIds.has(depId),
        );

      if (dependenciesMet) {
        executable.push(step.id);
      }
    });

    return executable;
  }

  /**
   * Simulate workflow execution for testing
   */
  async simulateExecution(
    workflow: Workflow,
    onStepStart?: (stepId: string) => void,
    onStepComplete?: (stepId: string, output: SkillInvocationResult) => void,
  ): Promise<WorkflowContext> {
    const context: WorkflowContext = { steps: {} };
    const completed = new Set<string>();

    while (completed.size < workflow.steps.length) {
      const nextSteps = this.getNextSteps(workflow, completed);

      if (nextSteps.length === 0) break; // Deadlock

      // Execute steps (sequentially for simulation)
      for (const stepId of nextSteps) {
        const step = workflow.steps.find((s) => s.id === stepId)!;

        onStepStart?.(stepId);

        // Replace variables in input
        const resolvedInput = this.replaceVariables(step.input, context);

        // Simulate skill execution
        const output: SkillInvocationResult = {
          skill: step.skill,
          input: resolvedInput,
          timestamp: new Date().toISOString(),
        };

        context.steps[stepId] = output;
        completed.add(stepId);

        onStepComplete?.(stepId, output);

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    return context;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isPlainRecord(value)) {
    const record: Record<string, JsonValue> = {};
    Object.entries(value).forEach(([key, entry]) => {
      record[key] = toJsonValue(entry);
    });
    return record;
  }

  return String(value);
}

function toJsonRecord(value: unknown): Record<string, JsonValue> {
  if (!isPlainRecord(value)) {
    return {};
  }

  const record: Record<string, JsonValue> = {};
  Object.entries(value).forEach(([key, entry]) => {
    record[key] = toJsonValue(entry);
  });
  return record;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function isJsonRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Export singleton instance
let workflowEngineInstance: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngineInstance) {
    workflowEngineInstance = new WorkflowEngine();
  }
  return workflowEngineInstance;
}

export function resetWorkflowEngine(): void {
  workflowEngineInstance = null;
}
