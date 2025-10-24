/**
 * Unit Tests for SkillsOrchestrator
 * Tests tool registration, schema creation, and system prompts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillsOrchestrator } from '@/lib/orchestrator';
import type {
  Skill,
  SkillMetadata,
  SkillInvocationInput,
  SkillInvocationResult,
  JsonValue,
} from '@/types';

describe('SkillsOrchestrator', () => {
  let orchestrator: SkillsOrchestrator;

  beforeEach(() => {
    orchestrator = new SkillsOrchestrator();
  });

  describe('Skill Registration', () => {
    it('should register skills', () => {
      const mockSkill = buildTestSkill({
        metadata: {
          name: 'Calculator',
          description: 'Simple calculator',
          category: 'math',
          input_schema: { a: { type: 'number' }, b: { type: 'number' } },
        },
        logic: async (input) => ({
          sum: ensureNumericInput(input, 'a') + ensureNumericInput(input, 'b'),
        }),
      });

      orchestrator.registerSkills([{ name: 'calculator', skill: mockSkill }]);

      const skill = orchestrator.getSkill('calculator');
      expect(skill).toBeDefined();
      expect(skill.metadata.name).toBe('Calculator');
    });

    it('should register multiple skills', () => {
      const skills = [
        {
          name: 'skill1',
          skill: buildTestSkill({ metadata: { name: 'Skill 1' }, logic: async () => ({}) }),
        },
        {
          name: 'skill2',
          skill: buildTestSkill({ metadata: { name: 'Skill 2' }, logic: async () => ({}) }),
        },
      ];

      orchestrator.registerSkills(skills);

      expect(orchestrator.getSkill('skill1')).toBeDefined();
      expect(orchestrator.getSkill('skill2')).toBeDefined();
    });
  });

  describe('Tool Definition Generation', () => {
    it('should generate tool definitions for registered skills', () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Multiplier',
          description: 'Multiplies two numbers',
          category: 'math',
          input_schema: { x: { type: 'number' }, y: { type: 'number' } },
        },
        logic: async (input) => ({
          product:
            ensureNumericInput(input, 'x') * ensureNumericInput(input, 'y'),
        }),
      });

      orchestrator.registerSkills([{ name: 'multiply', skill }]);
      const tools = orchestrator.getToolDefinitions();

      expect(tools.multiply).toBeDefined();
      expect(tools.multiply.description).toBe('Multiplies two numbers');
      expect(tools.multiply.inputSchema).toBeDefined();
    });

    it('should create valid Zod schemas from input_schema', () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Schema Test',
          description: 'Tests schema generation',
          category: 'test',
          input_schema: {
            name: { type: 'string' },
            age: { type: 'number' },
            active: { type: 'boolean' },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          },
        },
        logic: async (input) => input,
      });

      orchestrator.registerSkills([{ name: 'schema_test', skill }]);
      const tools = orchestrator.getToolDefinitions();

      // Verify schema can parse valid input
      const validInput = {
        name: 'John',
        age: 30,
        active: true,
        role: 'admin',
      };

      expect(() => {
        tools.schema_test.inputSchema.parse(validInput);
      }).not.toThrow();
    });

    it('should handle optional fields in schema', () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Optional Test',
          description: 'Tests optional fields',
          category: 'test',
          input_schema: {
            required_field: { type: 'string' },
            optional_field: { type: 'string', default: 'default_value' },
          },
        },
        logic: async (input) => input,
      });

      orchestrator.registerSkills([{ name: 'optional_test', skill }]);
      const tools = orchestrator.getToolDefinitions();

      // Should accept input with only required field
      expect(() => {
        tools.optional_test.inputSchema.parse({ required_field: 'test' });
      }).not.toThrow();
    });
  });

  describe('System Prompt Generation', () => {
    it('should build system prompt with available skills', () => {
      const skills = [
        {
          name: 'skill1',
          skill: buildTestSkill({
            metadata: {
              name: 'Skill One',
              description: 'First skill',
              category: 'category1',
              output_format: 'text',
            },
            logic: async () => ({}),
          }),
        },
        {
          name: 'skill2',
          skill: buildTestSkill({
            metadata: {
              name: 'Skill Two',
              description: 'Second skill',
              category: 'category2',
              output_format: 'markdown',
            },
            logic: async () => ({}),
          }),
        },
      ];

      orchestrator.registerSkills(skills);
      const prompt = orchestrator.buildSystemPrompt();

      expect(prompt).toContain('Skill One');
      expect(prompt).toContain('Skill Two');
      expect(prompt).toContain('First skill');
      expect(prompt).toContain('Second skill');
    });

    it('should include instructions in system prompt', () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Test Skill',
          description: 'Test description',
          category: 'test',
        },
        logic: async () => ({}),
      });

      orchestrator.registerSkills([{ name: 'test', skill }]);
      const prompt = orchestrator.buildSystemPrompt();

      expect(prompt).toContain('AI assistant');
      expect(prompt).toContain('tools');
      expect(prompt).toContain('analyze');
    });
  });

  describe('Skill Invocation', () => {
    it('should invoke skill directly', async () => {
      const mockLogic = vi.fn(async (input: SkillInvocationInput) => ({
        result: ensureNumericInput(input, 'value') * 2,
      }));

      const skill = buildTestSkill({
        metadata: {
          name: 'Doubler',
          description: 'Doubles input',
          category: 'math',
          input_schema: { value: { type: 'number' } },
        },
        logic: mockLogic,
      });

      orchestrator.registerSkills([{ name: 'doubler', skill }]);
      const result = await orchestrator.invokeSkill('doubler', { value: 5 });

  expect(mockLogic).toHaveBeenCalledWith({ value: 5 }, undefined);
      expect(extractNumericField(result, 'result')).toBe(10);
    });

    it('should throw error for non-existent skill', async () => {
      await expect(
        orchestrator.invokeSkill('non_existent', {})
      ).rejects.toThrow('Skill not found');
    });

    it('should handle skill execution via tool definition', async () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Adder',
          description: 'Adds two numbers',
          category: 'math',
          input_schema: { a: { type: 'number' }, b: { type: 'number' } },
        },
        logic: async (input) => ({
          sum:
            ensureNumericInput(input, 'a') + ensureNumericInput(input, 'b'),
        }),
      });

      orchestrator.registerSkills([{ name: 'add', skill }]);
      const tools = orchestrator.getToolDefinitions();
      const result = await tools.add.execute({ a: 3, b: 7 });

      expect(extractNumericField(result, 'sum')).toBe(10);
    });
  });

  describe('Skill Listing', () => {
    it('should list all registered skills metadata', () => {
      const skills = [
        {
          name: 'skill1',
          skill: buildTestSkill({
            metadata: {
              name: 'First',
              description: 'First skill',
              category: 'cat1',
            },
          }),
        },
        {
          name: 'skill2',
          skill: buildTestSkill({
            metadata: {
              name: 'Second',
              description: 'Second skill',
              category: 'cat2',
            },
          }),
        },
      ];

      orchestrator.registerSkills(skills);
      const skillList = orchestrator.listSkills();

      expect(skillList).toHaveLength(2);
      expect(skillList[0].name).toBe('First');
      expect(skillList[1].name).toBe('Second');
    });
  });

  describe('Error Handling', () => {
    it('should handle skills without logic gracefully', async () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'No Logic Skill',
          description: 'Has no logic',
          category: 'test',
        },
      });

      orchestrator.registerSkills([{ name: 'no_logic', skill }]);
      const tools = orchestrator.getToolDefinitions();
      const result = await tools.no_logic.execute({});

      expect(isMetadataOnlyResult(result)).toBe(true);
      if (isMetadataOnlyResult(result)) {
        expect(result.status).toBe('completed');
      }
    });

    it('should handle invalid Zod schema gracefully', () => {
      const skill = buildTestSkill({
        metadata: {
          name: 'Schema Test',
          description: 'Tests schema',
          category: 'test',
          input_schema: {
            number_field: { type: 'number' },
          },
        },
        logic: async (input) => input,
      });

      orchestrator.registerSkills([{ name: 'schema', skill }]);
      const tools = orchestrator.getToolDefinitions();

      // This should fail - string where number expected
      expect(() => {
        tools.schema.inputSchema.parse({ number_field: 'not a number' });
      }).toThrow();
    });
  });
});

const BASE_METADATA: SkillMetadata = {
  name: 'Test Skill',
  version: '1.0.0',
  description: 'Test skill',
  category: 'test',
  tools: [],
  input_schema: {},
  output_format: 'text',
};

type SkillOverrides = {
  metadata?: Partial<SkillMetadata>;
  markdown?: string;
  logic?: (input: SkillInvocationInput) => Promise<JsonValue>;
};

function buildTestSkill(overrides: SkillOverrides = {}): Skill {
  const metadataOverrides = overrides.metadata ?? {};

  const metadata: SkillMetadata = {
    name: metadataOverrides.name ?? BASE_METADATA.name,
    version: metadataOverrides.version ?? BASE_METADATA.version,
    description: metadataOverrides.description ?? BASE_METADATA.description,
    category: metadataOverrides.category ?? BASE_METADATA.category,
    tools: metadataOverrides.tools ? [...metadataOverrides.tools] : [],
    input_schema: metadataOverrides.input_schema
      ? { ...metadataOverrides.input_schema }
      : {},
    output_format: metadataOverrides.output_format ?? BASE_METADATA.output_format,
    estimated_tokens: metadataOverrides.estimated_tokens,
    author: metadataOverrides.author,
    tags: metadataOverrides.tags ? [...metadataOverrides.tags] : metadataOverrides.tags,
  };

  return {
    metadata,
    markdown: overrides.markdown ?? '# Test Skill',
    ...(overrides.logic ? { logic: overrides.logic } : {}),
  };
}

function ensureNumericInput(input: SkillInvocationInput, key: string): number {
  const value = input[key];
  if (typeof value === 'number') {
    return value;
  }

  throw new Error(`Expected numeric input for "${key}"`);
}

function extractNumericField(result: SkillInvocationResult, key: string): number {
  if (isJsonObject(result)) {
    const value = result[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  throw new Error(`Expected numeric field "${key}" in skill result`);
}

type MetadataOnlyResult = Extract<SkillInvocationResult, { type: 'metadata_only' }>;

function isMetadataOnlyResult(result: SkillInvocationResult): result is MetadataOnlyResult {
  return (
    isJsonObject(result) &&
    'type' in result &&
    result.type === 'metadata_only'
  );
}

function isJsonObject(value: SkillInvocationResult | JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
