/**
 * Unit Tests for SkillsOrchestrator
 * Tests tool registration, schema creation, and system prompts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillsOrchestrator } from '@/lib/orchestrator';
import { z } from 'zod';

describe('SkillsOrchestrator', () => {
  let orchestrator: SkillsOrchestrator;

  beforeEach(() => {
    orchestrator = new SkillsOrchestrator();
  });

  describe('Skill Registration', () => {
    it('should register skills', () => {
      const mockSkill = {
        metadata: {
          name: 'Calculator',
          description: 'Simple calculator',
          category: 'math',
          tools: [],
          input_schema: { a: { type: 'number' }, b: { type: 'number' } },
          output_format: 'text',
        },
        logic: async (input: any) => ({ sum: input.a + input.b }),
      };

      orchestrator.registerSkills([{ name: 'calculator', skill: mockSkill }]);

      const skill = orchestrator.getSkill('calculator');
      expect(skill).toBeDefined();
      expect(skill.metadata.name).toBe('Calculator');
    });

    it('should register multiple skills', () => {
      const skills = [
        {
          name: 'skill1',
          skill: { metadata: { name: 'Skill 1' }, logic: async () => ({}) },
        },
        {
          name: 'skill2',
          skill: { metadata: { name: 'Skill 2' }, logic: async () => ({}) },
        },
      ];

      orchestrator.registerSkills(skills);

      expect(orchestrator.getSkill('skill1')).toBeDefined();
      expect(orchestrator.getSkill('skill2')).toBeDefined();
    });
  });

  describe('Tool Definition Generation', () => {
    it('should generate tool definitions for registered skills', () => {
      const skill = {
        metadata: {
          name: 'Multiplier',
          description: 'Multiplies two numbers',
          category: 'math',
          tools: [],
          input_schema: { x: { type: 'number' }, y: { type: 'number' } },
          output_format: 'text',
        },
        logic: async (input: any) => ({ product: input.x * input.y }),
      };

      orchestrator.registerSkills([{ name: 'multiply', skill }]);
      const tools = orchestrator.getToolDefinitions();

      expect(tools.multiply).toBeDefined();
      expect(tools.multiply.description).toBe('Multiplies two numbers');
      expect(tools.multiply.parameters).toBeDefined();
    });

    it('should create valid Zod schemas from input_schema', () => {
      const skill = {
        metadata: {
          name: 'Schema Test',
          description: 'Tests schema generation',
          category: 'test',
          tools: [],
          input_schema: {
            name: { type: 'string' },
            age: { type: 'number' },
            active: { type: 'boolean' },
            role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          },
          output_format: 'text',
        },
        logic: async (input: any) => input,
      };

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
        tools.schema_test.parameters.parse(validInput);
      }).not.toThrow();
    });

    it('should handle optional fields in schema', () => {
      const skill = {
        metadata: {
          name: 'Optional Test',
          description: 'Tests optional fields',
          category: 'test',
          tools: [],
          input_schema: {
            required_field: { type: 'string' },
            optional_field: { type: 'string', default: 'default_value' },
          },
          output_format: 'text',
        },
        logic: async (input: any) => input,
      };

      orchestrator.registerSkills([{ name: 'optional_test', skill }]);
      const tools = orchestrator.getToolDefinitions();

      // Should accept input with only required field
      expect(() => {
        tools.optional_test.parameters.parse({ required_field: 'test' });
      }).not.toThrow();
    });
  });

  describe('System Prompt Generation', () => {
    it('should build system prompt with available skills', () => {
      const skills = [
        {
          name: 'skill1',
          skill: {
            metadata: {
              name: 'Skill One',
              description: 'First skill',
              category: 'category1',
              tools: [],
              input_schema: {},
              output_format: 'text',
            },
            logic: async () => ({}),
          },
        },
        {
          name: 'skill2',
          skill: {
            metadata: {
              name: 'Skill Two',
              description: 'Second skill',
              category: 'category2',
              tools: [],
              input_schema: {},
              output_format: 'markdown',
            },
            logic: async () => ({}),
          },
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
      const skill = {
        metadata: {
          name: 'Test Skill',
          description: 'Test description',
          category: 'test',
          tools: [],
          input_schema: {},
          output_format: 'text',
        },
        logic: async () => ({}),
      };

      orchestrator.registerSkills([{ name: 'test', skill }]);
      const prompt = orchestrator.buildSystemPrompt();

      expect(prompt).toContain('AI assistant');
      expect(prompt).toContain('tools');
      expect(prompt).toContain('analyze');
    });
  });

  describe('Skill Invocation', () => {
    it('should invoke skill directly', async () => {
      const mockLogic = vi.fn(async (input: any) => ({
        result: input.value * 2,
      }));

      const skill = {
        metadata: {
          name: 'Doubler',
          description: 'Doubles input',
          category: 'math',
          tools: [],
          input_schema: { value: { type: 'number' } },
          output_format: 'text',
        },
        logic: mockLogic,
      };

      orchestrator.registerSkills([{ name: 'doubler', skill }]);
      const result = await orchestrator.invokeSkill('doubler', { value: 5 });

      expect(mockLogic).toHaveBeenCalledWith({ value: 5 });
      expect(result.result).toBe(10);
    });

    it('should throw error for non-existent skill', async () => {
      await expect(
        orchestrator.invokeSkill('non_existent', {})
      ).rejects.toThrow('Skill not found');
    });

    it('should handle skill execution via tool definition', async () => {
      const skill = {
        metadata: {
          name: 'Adder',
          description: 'Adds two numbers',
          category: 'math',
          tools: [],
          input_schema: { a: { type: 'number' }, b: { type: 'number' } },
          output_format: 'text',
        },
        logic: async (input: any) => ({ sum: input.a + input.b }),
      };

      orchestrator.registerSkills([{ name: 'add', skill }]);
      const tools = orchestrator.getToolDefinitions();
      const toolExecute = tools.add.execute;

      if (toolExecute) {
        const result = await toolExecute({ a: 3, b: 7 });
        expect(result.sum).toBe(10);
      }
    });
  });

  describe('Skill Listing', () => {
    it('should list all registered skills metadata', () => {
      const skills = [
        {
          name: 'skill1',
          skill: {
            metadata: {
              name: 'First',
              description: 'First skill',
              category: 'cat1',
              tools: [],
              input_schema: {},
              output_format: 'text',
            },
          },
        },
        {
          name: 'skill2',
          skill: {
            metadata: {
              name: 'Second',
              description: 'Second skill',
              category: 'cat2',
              tools: [],
              input_schema: {},
              output_format: 'text',
            },
          },
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
      const skill = {
        metadata: {
          name: 'No Logic Skill',
          description: 'Has no logic',
          category: 'test',
          tools: [],
          input_schema: {},
          output_format: 'text',
        },
        // No logic property
      };

      orchestrator.registerSkills([{ name: 'no_logic', skill }]);
      const tools = orchestrator.getToolDefinitions();
      const toolExecute = tools.no_logic.execute;

      if (toolExecute) {
        const result = await toolExecute({});
        expect(result.status).toBe('completed');
      }
    });

    it('should handle invalid Zod schema gracefully', () => {
      const skill = {
        metadata: {
          name: 'Schema Test',
          description: 'Tests schema',
          category: 'test',
          tools: [],
          input_schema: {
            number_field: { type: 'number' },
          },
          output_format: 'text',
        },
        logic: async (input: any) => input,
      };

      orchestrator.registerSkills([{ name: 'schema', skill }]);
      const tools = orchestrator.getToolDefinitions();

      // This should fail - string where number expected
      expect(() => {
        tools.schema.parameters.parse({ number_field: 'not a number' });
      }).toThrow();
    });
  });
});
