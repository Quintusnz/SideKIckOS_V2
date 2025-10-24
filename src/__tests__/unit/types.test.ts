/**
 * Unit Tests for Core Types
 * Validates type definitions structure
 */

import { describe, it, expect } from 'vitest';
import type {
  SkillMetadata,
  Skill,
  SkillInvocationInput,
  Message,
  ToolInvocation,
  WorkflowStep,
  Workflow,
  JsonValue,
} from '@/types';

describe('SkillMetadata Type', () => {
  it('should have all required properties', () => {
    const metadata: SkillMetadata = {
      name: 'Web Research',
      version: '1.0.0',
      description: 'Performs web research',
      category: 'research',
      tools: ['web_search'],
      input_schema: { query: { type: 'string' } },
      output_format: 'markdown',
    };

    expect(metadata.name).toBe('Web Research');
    expect(metadata.version).toBe('1.0.0');
    expect(metadata.category).toBe('research');
  });

  it('should support optional properties', () => {
    const metadata: SkillMetadata = {
      name: 'Calculator',
      version: '1.0.0',
      description: 'Simple calculator',
      category: 'math',
      tools: [],
      input_schema: {},
      output_format: 'text',
      estimated_tokens: 100,
      author: 'System',
      tags: ['math', 'simple'],
    };

    expect(metadata.estimated_tokens).toBe(100);
    expect(metadata.author).toBe('System');
    expect(metadata.tags).toContain('math');
  });
});

describe('Skill Type', () => {
  it('should contain metadata and markdown', () => {
    const skill: Skill = {
      metadata: {
        name: 'Test Skill',
        version: '1.0.0',
        description: 'Test',
        category: 'test',
        tools: [],
        input_schema: {},
        output_format: 'text',
      },
      markdown: '# Test Skill\nThis is a test skill',
    };

    expect(skill.metadata.name).toBe('Test Skill');
    expect(skill.markdown).toContain('Test Skill');
  });

  it('should optionally include logic function', async () => {
    const skill: Skill = {
      metadata: {
        name: 'Logic Skill',
        version: '1.0.0',
        description: 'Has logic',
        category: 'test',
        tools: [],
        input_schema: { value: { type: 'number' } },
        output_format: 'text',
      },
      markdown: '# Logic Skill',
      logic: async (input: SkillInvocationInput) => {
        const value = typeof input.value === 'number' ? input.value : 0;
        return { result: value * 2 };
      },
    };

    const result = await skill.logic!({ value: 5 });
    if (!isJsonRecord(result) || typeof result.result !== 'number') {
      throw new Error('Skill logic returned unexpected result shape');
    }

    expect(result.result).toBe(10);
  });
});

describe('Message Type', () => {
  it('should have user messages', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, assistant!',
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, assistant!');
  });

  it('should have assistant messages with tool invocations', () => {
    const invocation: ToolInvocation = {
      id: 'tool-1',
      toolName: 'web_search',
      args: { query: 'test' },
      state: 'output-available',
      result: { found: true },
    };

    const message: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'I found some results.',
      toolInvocations: [invocation],
    };

    expect(message.toolInvocations).toHaveLength(1);
    expect(message.toolInvocations![0].toolName).toBe('web_search');
  });

  it('should support timestamps', () => {
    const now = new Date();
    const message: Message = {
      id: 'msg-3',
      role: 'assistant',
      content: 'Response',
      createdAt: now,
    };

    expect(message.createdAt).toEqual(now);
  });
});

describe('ToolInvocation Type', () => {
  it('should track tool call state', () => {
    const invocation: ToolInvocation = {
      id: 'invoke-1',
      toolName: 'calculator',
      args: { a: 5, b: 3 },
      state: 'input-available',
    };

    expect(invocation.state).toBe('input-available');

    invocation.state = 'output-available';
    invocation.result = { sum: 8 };

    expect(invocation.state).toBe('output-available');
    expect(invocation.result.sum).toBe(8);
  });
});

describe('WorkflowStep Type', () => {
  it('should define workflow steps', () => {
    const step: WorkflowStep = {
      id: 'step-1',
      skill: 'web_research',
      input: { query: 'AI trends' },
      timeout: 30,
      retries: 2,
    };

    expect(step.skill).toBe('web_research');
    expect(step.timeout).toBe(30);
  });

  it('should support dependencies', () => {
    const step: WorkflowStep = {
      id: 'step-2',
      skill: 'summarizer',
      input: { content: '{{ steps.step-1.output }}' },
      depends_on: ['step-1'],
    };

    expect(step.depends_on).toContain('step-1');
  });

  it('should support failure handling', () => {
    const step: WorkflowStep = {
      id: 'step-3',
      skill: 'primary',
      input: {},
      fallback: 'fallback_skill',
      on_failure: 'retry',
    };

    expect(step.fallback).toBe('fallback_skill');
    expect(step.on_failure).toBe('retry');
  });
});

describe('Workflow Type', () => {
  it('should define complete workflows', () => {
    const workflow: Workflow = {
      name: 'Research Workflow',
      version: '1.0.0',
      description: 'Multi-step research',
      steps: [
        {
          id: 'step-1',
          skill: 'web_research',
          input: { query: 'topic' },
        },
        {
          id: 'step-2',
          skill: 'summarizer',
          input: {},
          depends_on: ['step-1'],
        },
      ],
    };

    expect(workflow.steps).toHaveLength(2);
    expect(workflow.steps[1].depends_on).toContain('step-1');
  });
});

function isJsonRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
