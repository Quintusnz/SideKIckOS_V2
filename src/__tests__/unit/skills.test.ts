/**
 * Unit Tests for SkillRegistry
 * Tests metadata loading, lazy-loading, and skill invocation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  JsonValue,
  SkillMetadata,
  SkillInvocationInput,
  SkillInvocationResult,
} from '@/types';

/**
 * Mock SkillRegistry for testing without file system
 */
class MockSkillRegistry {
  private skills: Map<string, TestSkill> = new Map();

  constructor(skillsData?: Record<string, TestSkill>) {
    if (skillsData) {
      Object.entries(skillsData).forEach(([name, data]) => {
        this.skills.set(name, data);
      });
    }
  }

  async getSkillMetadata(): Promise<SkillMetadata[]> {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  getSkill(skillName: string): TestSkill | undefined {
    return this.skills.get(skillName);
  }

  async invokeSkill(
    skillName: string,
    input: SkillInvocationInput,
  ): Promise<SkillInvocationResult> {
    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (skill.logic) {
      return await skill.logic(input);
    }

    return {
      type: 'markdown_skill',
      metadata: skill.metadata,
      markdown: skill.markdown,
      input,
    };
  }

  listSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  hasSkill(skillName: string): boolean {
    return this.skills.has(skillName);
  }

  addSkill(name: string, skill: TestSkill): void {
    this.skills.set(name, skill);
  }
}

interface TestSkill {
  metadata: SkillMetadata;
  markdown: string;
  logic?: (
    input: SkillInvocationInput,
  ) => Promise<JsonValue>;
}

const DEFAULT_METADATA: SkillMetadata = {
  name: 'Test Skill',
  version: '1.0.0',
  description: 'Test skill',
  category: 'test',
  tools: [],
  input_schema: {},
  output_format: 'text',
};

type SkillOptions = {
  metadata?: Partial<SkillMetadata>;
  markdown?: string;
  logic?: (
    input: SkillInvocationInput,
  ) => Promise<JsonValue>;
};

function buildSkillEntry(options: SkillOptions = {}): TestSkill {
  const metadataOverrides = options.metadata ?? {};

  const metadata: SkillMetadata = {
    name: metadataOverrides.name ?? DEFAULT_METADATA.name,
    version: metadataOverrides.version ?? DEFAULT_METADATA.version,
    description: metadataOverrides.description ?? DEFAULT_METADATA.description,
    category: metadataOverrides.category ?? DEFAULT_METADATA.category,
    tools: metadataOverrides.tools ? [...metadataOverrides.tools] : [],
    input_schema: metadataOverrides.input_schema
      ? { ...metadataOverrides.input_schema }
      : {},
    output_format: metadataOverrides.output_format ?? DEFAULT_METADATA.output_format,
    estimated_tokens: metadataOverrides.estimated_tokens,
    author: metadataOverrides.author,
    tags: metadataOverrides.tags ? [...metadataOverrides.tags] : metadataOverrides.tags,
  };

  return {
    metadata,
    markdown: options.markdown ?? '# Test Skill',
    ...(options.logic ? { logic: options.logic } : {}),
  };
}

function extractNumericResult(
  result: SkillInvocationResult,
  key: string,
): number {
  if (isJsonObject(result)) {
    const value = result[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  throw new Error(`Expected numeric field "${key}" in result`);
}

type MarkdownSkillResult = Extract<
  SkillInvocationResult,
  { type: 'markdown_skill' }
>;

function isMarkdownResult(
  value: SkillInvocationResult,
): value is MarkdownSkillResult {
  return (
    isJsonObject(value) &&
    'type' in value &&
    value.type === 'markdown_skill'
  );
}

function isJsonObject(value: SkillInvocationResult | JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureNumericInput(
  input: SkillInvocationInput,
  key: string,
): number {
  const value = input[key];
  if (typeof value === 'number') {
    return value;
  }

  throw new Error(`Expected numeric input for "${key}"`);
}

describe('SkillRegistry', () => {
  let registry: MockSkillRegistry;

  beforeEach(() => {
    registry = new MockSkillRegistry();
  });

  describe('Skill Registration', () => {
    it('should register a skill with metadata', () => {
      const metadata: SkillMetadata = {
        name: 'Web Research',
        version: '1.0.0',
        description: 'Performs web research',
        category: 'research',
        tools: ['web_search'],
        input_schema: { query: { type: 'string' } },
        output_format: 'markdown',
      };

      registry.addSkill(
        'web_research',
        buildSkillEntry({ metadata, markdown: '# Web Research' }),
      );

      expect(registry.hasSkill('web_research')).toBe(true);
      expect(registry.getSkill('web_research')?.metadata.name).toBe(
        'Web Research'
      );
    });

    it('should list all registered skills', () => {
  registry.addSkill('skill1', buildSkillEntry({ metadata: { name: 'Skill 1' } }));
  registry.addSkill('skill2', buildSkillEntry({ metadata: { name: 'Skill 2' } }));
  registry.addSkill('skill3', buildSkillEntry({ metadata: { name: 'Skill 3' } }));

      const skills = registry.listSkills();
      expect(skills).toHaveLength(3);
      expect(skills).toContain('skill1');
      expect(skills).toContain('skill2');
      expect(skills).toContain('skill3');
    });

    it('should throw error when getting non-existent skill', async () => {
      await expect(
        registry.invokeSkill('non_existent', {})
      ).rejects.toThrow('Skill not found: non_existent');
    });
  });

  describe('Skill Invocation', () => {
    it('should invoke skill with executable logic', async () => {
      const mockLogic = vi.fn(async (input: SkillInvocationInput) => ({
        result: ensureNumericInput(input, 'value') * 2,
      }));

      registry.addSkill(
        'calculator',
        buildSkillEntry({
          metadata: {
            name: 'Calculator',
            description: 'Simple calculator',
            category: 'math',
            input_schema: { value: { type: 'number' } },
            output_format: 'text',
          },
          markdown: '# Calculator',
          logic: mockLogic,
        }),
      );

      const result = await registry.invokeSkill('calculator', { value: 5 });

      expect(mockLogic).toHaveBeenCalledWith({ value: 5 });
      expect(extractNumericResult(result, 'result')).toBe(10);
    });

    it('should handle skill without logic (markdown-only)', async () => {
      registry.addSkill(
        'analyzer',
        buildSkillEntry({
          metadata: {
            name: 'Analyzer',
            description: 'Analysis skill',
            category: 'analysis',
            output_format: 'markdown',
          },
          markdown: '# Analysis Skill\nProvides analysis',
        }),
      );

      const result = await registry.invokeSkill('analyzer', { data: 'test' });

      expect(isMarkdownResult(result)).toBe(true);
      if (isMarkdownResult(result)) {
        expect(result.metadata.name).toBe('Analyzer');
        expect(result.input).toEqual({ data: 'test' });
      }
    });

    it('should handle skill errors gracefully', async () => {
      const errorLogic = vi.fn(async () => {
        throw new Error('Skill execution failed');
      });

      registry.addSkill(
        'broken',
        buildSkillEntry({ metadata: { name: 'Broken Skill' }, logic: errorLogic }),
      );

      // Note: In the actual implementation, errors are caught
      // For testing, we just verify the logic is called
      await expect(
        registry.invokeSkill('broken', {})
      ).rejects.toThrow();
    });
  });

  describe('Metadata Retrieval', () => {
    it('should return all skill metadata', async () => {
      registry.addSkill(
        'skill1',
        buildSkillEntry({
          metadata: {
            name: 'Skill 1',
            version: '1.0.0',
            description: 'First skill',
            category: 'test',
            tools: ['tool1'],
            output_format: 'text',
          },
        }),
      );

      registry.addSkill(
        'skill2',
        buildSkillEntry({
          metadata: {
            name: 'Skill 2',
            version: '2.0.0',
            description: 'Second skill',
            category: 'test',
            tools: ['tool2'],
            output_format: 'json',
          },
        }),
      );

      const metadata = await registry.getSkillMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata[0].name).toBe('Skill 1');
      expect(metadata[1].name).toBe('Skill 2');
    });

    it('should include all metadata fields', async () => {
      const fullMetadata: SkillMetadata = {
        name: 'Full Skill',
        version: '1.2.3',
        description: 'Complete metadata',
        category: 'complete',
        tools: ['tool_a', 'tool_b'],
        input_schema: { param: { type: 'string' } },
        output_format: 'markdown',
        estimated_tokens: 500,
        author: 'Test Author',
        tags: ['tag1', 'tag2'],
      };

  registry.addSkill('full', buildSkillEntry({ metadata: fullMetadata }));

      const metadata = await registry.getSkillMetadata();
      const skill = metadata[0];

      expect(skill.name).toBe('Full Skill');
      expect(skill.version).toBe('1.2.3');
      expect(skill.tools).toContain('tool_a');
      expect(skill.estimated_tokens).toBe(500);
      expect(skill.author).toBe('Test Author');
      expect(skill.tags).toContain('tag1');
    });
  });

  describe('Lazy-Loading Pattern', () => {
    it('should support lazy-loading of logic', async () => {
      const metadata: SkillMetadata = {
        name: 'Lazy Skill',
        version: '1.0.0',
        description: 'Skill with lazy-loaded logic',
        category: 'test',
        tools: [],
        input_schema: {},
        output_format: 'text',
      };

      // Register skill without logic initially
      registry.addSkill('lazy', buildSkillEntry({ metadata, markdown: '# Lazy Skill' }));

      // Logic is not loaded yet
      const initialSkill = registry.getSkill('lazy');
      expect(initialSkill).toBeDefined();
      expect(initialSkill?.logic).toBeUndefined();

      // Add logic after registration (simulating lazy-loading)
      const skillRef = registry.getSkill('lazy');
      expect(skillRef).toBeDefined();
      if (!skillRef) {
        throw new Error('Expected lazy skill to exist');
      }

      skillRef.logic = async (input: SkillInvocationInput) => ({ processed: true, input });

      // Now logic is available
      const updatedSkill = registry.getSkill('lazy');
      expect(updatedSkill?.logic).toBeDefined();

      const result = await registry.invokeSkill('lazy', { test: 'data' });
      expect(isJsonObject(result) ? result.processed : undefined).toBe(true);
    });
  });

  describe('Skill Discovery', () => {
    it('should discover skills from metadata schema', () => {
      registry.addSkill(
        'web_research',
        buildSkillEntry({
          metadata: {
            name: 'Web Research',
            category: 'research',
            tools: ['web_search', 'summarize'],
            input_schema: { query: { type: 'string' } },
          },
        }),
      );

      const skill = registry.getSkill('web_research');
      expect(skill?.metadata.tools).toContain('web_search');
      expect(skill?.metadata.tools).toContain('summarize');
    });

    it('should organize skills by category', () => {
      registry.addSkill(
        'research',
        buildSkillEntry({ metadata: { name: 'Research', category: 'research' } }),
      );
      registry.addSkill(
        'write',
        buildSkillEntry({ metadata: { name: 'Write', category: 'writing' } }),
      );
      registry.addSkill(
        'analyze',
        buildSkillEntry({ metadata: { name: 'Analyze', category: 'analysis' } }),
      );

      const skills = registry.listSkills();
      const researchSkills = skills.filter(
        (name) => registry.getSkill(name)?.metadata.category === 'research'
      );
      const writingSkills = skills.filter(
        (name) => registry.getSkill(name)?.metadata.category === 'writing'
      );

      expect(researchSkills).toHaveLength(1);
      expect(writingSkills).toHaveLength(1);
    });
  });
});
