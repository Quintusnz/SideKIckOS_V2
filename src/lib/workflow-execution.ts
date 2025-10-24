/**
 * Workflow Execution Engine
 * Handles real-time execution of multi-step workflows with context propagation and timeouts
 */

import { WorkflowEngine, Workflow, WorkflowStep, WorkflowContext } from './workflows';
import { AdvancedOrchestrator } from './advanced-orchestrator';
import type { SkillInvocationInput, SkillInvocationResult } from '@/types';

/**
 * Execution callbacks
 */
export interface ExecutionCallbacks {
  onStepStart?: (stepId: string, step: WorkflowStep) => void;
  onStepComplete?: (stepId: string, output: SkillInvocationResult) => void;
  onStepError?: (stepId: string, error: Error) => void;
  onStepSkip?: (stepId: string, reason: string) => void;
  onWorkflowStart?: () => void;
  onWorkflowComplete?: (context: WorkflowContext) => void;
  onWorkflowError?: (error: Error) => void;
}

/**
 * Execution options
 */
export interface ExecutionOptions {
  timeout?: number; // Global workflow timeout in ms
  stepTimeout?: number; // Per-step timeout in ms
  continueOnError?: boolean; // Continue workflow on step failure
  parallel?: boolean; // Execute independent steps in parallel
  callbacks?: ExecutionCallbacks;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  workflow: Workflow;
  context: WorkflowContext;
  executedSteps: string[];
  failedSteps: string[];
  duration: number;
  error?: Error;
}

export type WorkflowStreamEvent =
  | { type: 'start' }
  | { type: 'step-start'; stepId: string; step: WorkflowStep }
  | { type: 'step-complete'; stepId: string; output: SkillInvocationResult }
  | { type: 'step-error'; stepId: string; error: Error }
  | { type: 'step-skip'; stepId: string; reason: string }
  | { type: 'workflow-complete'; context: WorkflowContext }
  | { type: 'workflow-error'; error: Error }
  | { type: 'complete'; result: ExecutionResult };

/**
 * WorkflowExecutionEngine - Executes workflows with real-time streaming
 */
export class WorkflowExecutionEngine {
  private workflowEngine: WorkflowEngine;
  private orchestrator: AdvancedOrchestrator;

  constructor(
    workflowEngine?: WorkflowEngine,
    orchestrator?: AdvancedOrchestrator,
  ) {
    this.workflowEngine =
      workflowEngine || new WorkflowEngine();
    this.orchestrator =
      orchestrator || new AdvancedOrchestrator();
  }

  /**
   * Execute workflow with streaming callbacks
   */
  async executeWorkflow(
    workflow: Workflow,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    const startTime = performance.now();
    const context: WorkflowContext = { steps: {} };
    const executedSteps: string[] = [];
    const failedSteps: string[] = [];
    const {
      timeout = 300000, // 5 minutes default
      stepTimeout = 30000, // 30 seconds default
      continueOnError = false,
      callbacks = {},
    } = options;

    try {
      // Validate workflow
      const validation = this.workflowEngine.validateWorkflow(workflow);
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      callbacks.onWorkflowStart?.();

      // Set up global timeout
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Workflow execution timeout')),
          timeout,
        );
      });

      // Execute workflow with timeout
      const executionPromise = this.executeWorkflowInternal(
        workflow,
        context,
        stepTimeout,
        executedSteps,
        failedSteps,
        continueOnError,
        callbacks,
      );

      try {
        await Promise.race([executionPromise, timeoutPromise]);
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }

      const duration = performance.now() - startTime;

      callbacks.onWorkflowComplete?.(context);

      return {
        success: failedSteps.length === 0,
        workflow,
        context,
        executedSteps,
        failedSteps,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      callbacks.onWorkflowError?.(err);

      return {
        success: false,
        workflow,
        context,
        executedSteps,
        failedSteps,
        duration,
        error: err,
      };
    }
  }

  /**
   * Internal workflow execution
   */
  private async executeWorkflowInternal(
    workflow: Workflow,
    context: WorkflowContext,
    stepTimeout: number,
    executedSteps: string[],
    failedSteps: string[],
    continueOnError: boolean,
    callbacks: ExecutionCallbacks,
  ): Promise<void> {
    const completed = new Set<string>();

    while (completed.size < workflow.steps.length) {
      const nextSteps = this.workflowEngine.getNextSteps(
        workflow,
        completed,
      );

      if (nextSteps.length === 0) break; // Deadlock or all complete

      // Execute steps sequentially for now
      for (const stepId of nextSteps) {
        const step = workflow.steps.find((s) => s.id === stepId);
        if (!step) {
          throw new Error(`Step not found: ${stepId}`);
        }

        try {
          callbacks.onStepStart?.(stepId, step);

          // Replace variables in input
          const resolvedInput: SkillInvocationInput = this.workflowEngine.replaceVariables(
            step.input,
            context,
          );

          // Execute step with timeout
          const stepTimeoutMs = step.timeout || stepTimeout;
          const output = await this.executeStepWithTimeout(
            stepId,
            step.skill,
            resolvedInput,
            stepTimeoutMs,
          );

          // Store output in context
          context.steps[stepId] = output;
          executedSteps.push(stepId);
          completed.add(stepId);

          callbacks.onStepComplete?.(stepId, output);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          failedSteps.push(stepId);
          completed.add(stepId);

          callbacks.onStepError?.(stepId, err);

          if (!continueOnError) {
            throw err;
          }
        }
      }
    }
  }

  /**
   * Execute step with timeout
   */
  private async executeStepWithTimeout(
    stepId: string,
    skillName: string,
    input: SkillInvocationInput,
    timeoutMs: number,
  ): Promise<SkillInvocationResult> {
    return new Promise<SkillInvocationResult>((resolve, reject) => {
      let completed = false;

      // Execute skill
      const skillPromise = this.orchestrator.executeSkill(
        skillName,
        input,
      );

      // Set timeout
      const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
        if (!completed) {
          reject(
            new Error(
              `Step ${stepId} execution timeout after ${timeoutMs}ms`,
            ),
          );
        }
      }, timeoutMs);

      // Handle promise
      skillPromise
        .then((result) => {
          completed = true;
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch((error) => {
          completed = true;
          clearTimeout(timeoutHandle);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  /**
   * Stream workflow execution (for real-time updates)
   */
  async *streamWorkflowExecution(
    workflow: Workflow,
    options: ExecutionOptions = {},
  ): AsyncGenerator<WorkflowStreamEvent> {
    const events: WorkflowStreamEvent[] = [];

    const { callbacks: userCallbacks, ...restOptions } = options;

    const proxyCallbacks: ExecutionCallbacks = {
      onWorkflowStart: () => {
        events.push({ type: 'start' });
        userCallbacks?.onWorkflowStart?.();
      },
      onStepStart: (stepId, step) => {
        events.push({ type: 'step-start', stepId, step });
        userCallbacks?.onStepStart?.(stepId, step);
      },
      onStepComplete: (stepId, output) => {
        events.push({ type: 'step-complete', stepId, output });
        userCallbacks?.onStepComplete?.(stepId, output);
      },
      onStepError: (stepId, error) => {
        events.push({ type: 'step-error', stepId, error });
        userCallbacks?.onStepError?.(stepId, error);
      },
      onStepSkip: (stepId, reason) => {
        events.push({ type: 'step-skip', stepId, reason });
        userCallbacks?.onStepSkip?.(stepId, reason);
      },
      onWorkflowComplete: (context) => {
        events.push({ type: 'workflow-complete', context });
        userCallbacks?.onWorkflowComplete?.(context);
      },
      onWorkflowError: (error) => {
        events.push({ type: 'workflow-error', error });
        userCallbacks?.onWorkflowError?.(error);
      },
    };

    const result = await this.executeWorkflow(workflow, {
      ...restOptions,
      callbacks: proxyCallbacks,
    });

    while (events.length > 0) {
      const event = events.shift();
      if (event) {
        yield event;
      }
    }

    yield { type: 'complete', result };
  }

  /**
   * Check if workflow can execute a skill
   */
  canExecuteSkill(skillName: string): boolean {
    return this.orchestrator.hasSkill(skillName);
  }

  /**
   * Get workflow execution plan (without executing)
   */
  getExecutionPlan(workflow: Workflow): {
    steps: string[];
    dependencies: Record<string, string[]>;
    parallelGroups: string[][];
  } {
    const executionOrder =
      this.workflowEngine.resolveExecutionOrder(workflow);

    const dependencies: Record<string, string[]> = {};

    executionOrder.forEach(({ stepId, dependencies: deps }) => {
      dependencies[stepId] = deps;
    });

    // Group steps that can execute in parallel
    const parallelGroups: string[][] = [];
    const processed = new Set<string>();

    executionOrder.forEach(({ stepId, canExecuteInParallel }) => {
      if (!processed.has(stepId)) {
        const group = [stepId, ...canExecuteInParallel];
        parallelGroups.push(group);
        group.forEach((s) => processed.add(s));
      }
    });

    return {
      steps: executionOrder.map((e) => e.stepId),
      dependencies,
      parallelGroups,
    };
  }
}

// Export singleton instance
let workflowExecutionEngineInstance: WorkflowExecutionEngine | null = null;

export function getWorkflowExecutionEngine(): WorkflowExecutionEngine {
  if (!workflowExecutionEngineInstance) {
    workflowExecutionEngineInstance = new WorkflowExecutionEngine();
  }
  return workflowExecutionEngineInstance;
}

export function resetWorkflowExecutionEngine(): void {
  workflowExecutionEngineInstance = null;
}
