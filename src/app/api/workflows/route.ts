/**
 * Workflows API Route
 * Handles workflow discovery, execution, and streaming
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngine } from '@/lib/workflows';
import { getWorkflowExecutionEngine } from '@/lib/workflow-execution';

/**
 * GET /api/workflows
 * Returns all available workflows
 */
export async function GET(): Promise<NextResponse> {
  try {
    // In a real implementation, this would scan the /workflows directory
    // For now, return example workflows
    const workflows = [
      {
        name: 'Deep Research & Report',
        description: 'Conduct research and generate a report',
        version: '1.0.0',
        steps: [
          { id: 'research', skill: 'web_research' },
          { id: 'summarize', skill: 'summarizer', depends_on: ['research'] },
          { id: 'report', skill: 'report_writer', depends_on: ['summarize'] },
        ],
      },
      {
        name: 'Content Analysis',
        description: 'Analyze and summarize content',
        version: '1.0.0',
        steps: [
          { id: 'analyze', skill: 'web_research' },
          { id: 'summarize', skill: 'summarizer', depends_on: ['analyze'] },
        ],
      },
    ];

    return NextResponse.json(workflows);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch workflows';
    return NextResponse.json(
      { error: `Failed to fetch workflows: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * POST /api/workflows
 * Execute a workflow and stream results
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { workflow, options } = await req.json();

    if (!workflow || !workflow.steps) {
      return NextResponse.json(
        { error: 'Invalid workflow definition' },
        { status: 400 },
      );
    }

    // Validate workflow
    const workflowEngine = getWorkflowEngine();
    const validation = workflowEngine.validateWorkflow(workflow);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 },
      );
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          const executionEngine = getWorkflowExecutionEngine();

          // Execute workflow with streaming
          await executionEngine.executeWorkflow(workflow, {
            ...options,
            callbacks: {
              onWorkflowStart: () => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ type: 'workflow-start' }) + '\n',
                  ),
                );
              },
              onStepStart: (stepId, step) => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'step-start',
                      stepId,
                      skill: step.skill,
                    }) + '\n',
                  ),
                );
              },
              onStepComplete: (stepId, output) => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'step-complete',
                      stepId,
                      output,
                    }) + '\n',
                  ),
                );
              },
              onStepError: (stepId, error) => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'step-error',
                      stepId,
                      error: error.message,
                    }) + '\n',
                  ),
                );
              },
              onWorkflowComplete: (context) => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'workflow-complete',
                      context,
                    }) + '\n',
                  ),
                );
              },
              onWorkflowError: (error) => {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'workflow-error',
                      error: error.message,
                    }) + '\n',
                  ),
                );
              },
            },
          });

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new NextResponse(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Workflow execution failed',
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workflows/:id
 * Get execution plan for workflow
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const { workflow } = await req.json();

    if (!workflow || !workflow.steps) {
      return NextResponse.json(
        { error: 'Invalid workflow definition' },
        { status: 400 },
      );
    }

    const executionEngine = getWorkflowExecutionEngine();
    const plan = executionEngine.getExecutionPlan(workflow);

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to get execution plan',
      },
      { status: 500 },
    );
  }
}
