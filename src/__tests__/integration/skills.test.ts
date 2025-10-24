/**
 * Integration Tests for Skills
 * Tests skill loading, invocation, and correctness
 */

import { describe, it, expect } from 'vitest';
import type { JsonValue, SkillMetadata } from '@/types';

type ResearchDepth = 'shallow' | 'deep';
type SummarizerStyle = 'bullet-points' | 'paragraphs';
type ReportStyle = 'technical' | 'business' | 'academic';

interface WebResearchInput {
  query: string;
  depth?: ResearchDepth;
}

interface WebResearchFinding {
  source: string;
  title: string;
  relevance: number;
}

interface WebResearchResult {
  query: string;
  depth: ResearchDepth;
  status: 'completed';
  findings: WebResearchFinding[];
}

interface SummarizerInput {
  content: string;
  style?: string;
}

interface SummarizerResult {
  content: string;
  style: SummarizerStyle;
  reduction: '70%';
}

interface ReportWriterInput {
  title: string;
  content: string;
  style?: string;
}

interface ReportWriterResult {
  title: string;
  style: ReportStyle;
  report: string;
}

interface MockSkill<Input, Output> {
  metadata: SkillMetadata;
  logic: (input: Input) => Promise<Output>;
}

const RESEARCH_DEPTH_VALUES: ReadonlyArray<ResearchDepth> = ['shallow', 'deep'];
const SUMMARIZER_STYLE_VALUES: ReadonlyArray<SummarizerStyle> = ['bullet-points', 'paragraphs'];
const REPORT_STYLE_VALUES: ReadonlyArray<ReportStyle> = ['technical', 'business', 'academic'];

const webResearchSkill: MockSkill<WebResearchInput, WebResearchResult> = {
  metadata: {
    name: 'Web Research',
    version: '1.0.0',
    description: 'Performs web-based research',
    category: 'research',
    tools: ['web_search'],
    input_schema: {
      query: { type: 'string' },
      depth: { type: 'string', enum: [...RESEARCH_DEPTH_VALUES] },
    },
    output_format: 'markdown',
  },
  logic: async (input) => {
    const depth = isResearchDepth(input.depth) ? input.depth : 'shallow';

    return {
      query: input.query,
      depth,
      status: 'completed',
      findings: [
        {
          source: 'DB',
          title: `Research on ${input.query}`,
          relevance: 0.95,
        },
      ],
    } satisfies WebResearchResult;
  },
};

const summarizerSkill: MockSkill<SummarizerInput, SummarizerResult> = {
  metadata: {
    name: 'Summarizer',
    version: '1.0.0',
    description: 'Summarizes text content',
    category: 'analysis',
    tools: ['text_analysis'],
    input_schema: {
      content: { type: 'string' },
      style: { type: 'string', enum: [...SUMMARIZER_STYLE_VALUES] },
    },
    output_format: 'markdown',
  },
  logic: async (input) => {
    const style = isSummarizerStyle(input.style) ? input.style : 'bullet-points';
    const contentPreview = input.content.slice(0, 50);

    return {
      content: `Summary of: ${contentPreview}${contentPreview.length === 50 ? '...' : ''}`,
      style,
      reduction: '70%',
    } satisfies SummarizerResult;
  },
};

const reportWriterSkill: MockSkill<ReportWriterInput, ReportWriterResult> = {
  metadata: {
    name: 'Report Writer',
    version: '1.0.0',
    description: 'Generates professional reports',
    category: 'writing',
    tools: ['document_generation'],
    input_schema: {
      title: { type: 'string' },
      content: { type: 'string' },
      style: { type: 'string', enum: [...REPORT_STYLE_VALUES] },
    },
    output_format: 'markdown',
  },
  logic: async (input) => {
    const style = isReportStyle(input.style) ? input.style : 'business';

    return {
      title: input.title,
      style,
      report: `# ${input.title}\n\n${input.content}`,
    } satisfies ReportWriterResult;
  },
};

const mockSkills = {
  web_research: webResearchSkill,
  summarizer: summarizerSkill,
  report_writer: reportWriterSkill,
} as const;

type CombinedMockSkill = (typeof mockSkills)[keyof typeof mockSkills];

function isResearchDepth(value: unknown): value is ResearchDepth {
  return typeof value === 'string' && RESEARCH_DEPTH_VALUES.includes(value as ResearchDepth);
}

function isSummarizerStyle(value: unknown): value is SummarizerStyle {
  return typeof value === 'string' && SUMMARIZER_STYLE_VALUES.includes(value as SummarizerStyle);
}

function isReportStyle(value: unknown): value is ReportStyle {
  return typeof value === 'string' && REPORT_STYLE_VALUES.includes(value as ReportStyle);
}

function isJsonRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getEnumValues(value: JsonValue | undefined): string[] {
  if (!isJsonRecord(value)) {
    return [];
  }

  const enumCandidate = value.enum;
  if (Array.isArray(enumCandidate)) {
    return enumCandidate.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function forEachMockSkill(callback: (skill: CombinedMockSkill) => void): void {
  (Object.values(mockSkills) as CombinedMockSkill[]).forEach((skill) => {
    callback(skill);
  });
}

describe('Skills Integration Tests', () => {
  describe('Web Research Skill', () => {
    it('should execute web research with shallow depth', async () => {
      const logic = mockSkills.web_research.logic;
      const result = await logic({
        query: 'climate change',
        depth: 'shallow',
      });

      expect(result.query).toBe('climate change');
      expect(result.depth).toBe('shallow');
      expect(result.status).toBe('completed');
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it('should execute web research with deep depth', async () => {
      const logic = mockSkills.web_research.logic;
      const result = await logic({
        query: 'AI in healthcare',
        depth: 'deep',
      });

      expect(result.depth).toBe('deep');
      expect(result.status).toBe('completed');
    });

    it('should have correct metadata', () => {
      const metadata = mockSkills.web_research.metadata;

      expect(metadata.name).toBe('Web Research');
      expect(metadata.category).toBe('research');
      expect(metadata.tools).toContain('web_search');
    });

    it('should validate input schema', () => {
      const schema = mockSkills.web_research.metadata.input_schema;

      expect(schema.query).toBeDefined();
      const depthEnum = getEnumValues(schema.depth);
      expect(depthEnum).toEqual(expect.arrayContaining(['shallow', 'deep']));
    });
  });

  describe('Summarizer Skill', () => {
    it('should summarize text with bullet points', async () => {
      const logic = mockSkills.summarizer.logic;
      const longText = 'This is a long text that needs summarization. '.repeat(10);

      const result = await logic({
        content: longText,
        style: 'bullet-points',
      });

      expect(result.style).toBe('bullet-points');
      expect(result.reduction).toBe('70%');
      expect(result.content).toContain('Summary of');
    });

    it('should summarize text in paragraphs', async () => {
      const logic = mockSkills.summarizer.logic;
      const text = 'Sample content for summarization';

      const result = await logic({
        content: text,
        style: 'paragraphs',
      });

      expect(result.style).toBe('paragraphs');
    });

    it('should handle empty content gracefully', async () => {
      const logic = mockSkills.summarizer.logic;

      const result = await logic({
        content: '',
        style: 'bullet-points',
      });

      expect(result.content).toBeDefined();
      expect(result.style).toBe('bullet-points');
    });

    it('should have correct output format', () => {
      const metadata = mockSkills.summarizer.metadata;

      expect(metadata.output_format).toBe('markdown');
      expect(metadata.category).toBe('analysis');
    });
  });

  describe('Report Writer Skill', () => {
    it('should generate business report', async () => {
      const logic = mockSkills.report_writer.logic;

      const result = await logic({
        title: 'Q4 Performance',
        content: 'Sales increased by 150%',
        style: 'business',
      });

      expect(result.title).toBe('Q4 Performance');
      expect(result.style).toBe('business');
      expect(result.report).toContain('# Q4 Performance');
      expect(result.report).toContain('Sales increased by 150%');
    });

    it('should generate technical report', async () => {
      const logic = mockSkills.report_writer.logic;

      const result = await logic({
        title: 'Architecture Design',
        content: 'Microservices architecture with 99.9% uptime',
        style: 'technical',
      });

      expect(result.style).toBe('technical');
      expect(result.report).toContain('Architecture Design');
    });

    it('should generate academic report', async () => {
      const logic = mockSkills.report_writer.logic;

      const result = await logic({
        title: 'Research Findings',
        content: 'Results show 95% accuracy',
        style: 'academic',
      });

      expect(result.style).toBe('academic');
      expect(result.report).toContain('Research Findings');
    });

    it('should default to business style', async () => {
      const logic = mockSkills.report_writer.logic;

      const result = await logic({
        title: 'Report',
        content: 'Content here',
      });

      expect(result.style).toBe('business');
    });

    it('should have markdown output format', () => {
      const metadata = mockSkills.report_writer.metadata;

      expect(metadata.output_format).toBe('markdown');
      expect(metadata.category).toBe('writing');
    });
  });

  describe('Skill Chaining', () => {
    it('should chain web_research → summarizer', async () => {
      // First, do research
      const researchResult = await mockSkills.web_research.logic({
        query: 'recent AI developments',
        depth: 'deep',
      });

      expect(researchResult.status).toBe('completed');

      // Then, summarize the results
      const summaryResult = await mockSkills.summarizer.logic({
        content: JSON.stringify(researchResult),
        style: 'bullet-points',
      });

      expect(summaryResult.style).toBe('bullet-points');
      expect(summaryResult.reduction).toBe('70%');
    });

    it('should chain research → summarize → report', async () => {
      // Research
      const research = await mockSkills.web_research.logic({
        query: 'market trends',
        depth: 'shallow',
      });

      // Summarize
      const summary = await mockSkills.summarizer.logic({
        content: JSON.stringify(research),
        style: 'bullet-points',
      });

      // Generate Report
      const report = await mockSkills.report_writer.logic({
        title: 'Market Analysis Report',
        content: summary.content,
        style: 'business',
      });

      expect(report.title).toBe('Market Analysis Report');
      expect(report.report).toContain('Market Analysis Report');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing query in web_research', async () => {
      const logic = mockSkills.web_research.logic;

      // Should not throw, but handle gracefully
      const result = await logic({ query: '', depth: 'shallow' });

      expect(result.query).toBe('');
      expect(result.status).toBe('completed');
    });

    it('should handle invalid style in summarizer', async () => {
      const logic = mockSkills.summarizer.logic;

      // Invalid style should still process
      const result = await logic({
        content: 'test',
        style: 'invalid-style',
      });

      expect(result.content).toBeDefined();
    });

    it('should handle very long content', async () => {
      const logic = mockSkills.summarizer.logic;
      const longContent = 'x'.repeat(10000);

      const result = await logic({
        content: longContent,
        style: 'bullet-points',
      });

      expect(result.content).toBeDefined();
      expect(result.reduction).toBe('70%');
    });
  });

  describe('Metadata Validation', () => {
    it('should have valid metadata for all skills', () => {
      forEachMockSkill((skill) => {
        expect(skill.metadata.name).toBeDefined();
        expect(skill.metadata.version).toBeDefined();
        expect(skill.metadata.description).toBeDefined();
        expect(skill.metadata.category).toBeDefined();
        expect(skill.metadata.output_format).toBeDefined();
      });
    });

    it('should have proper input schemas', () => {
      forEachMockSkill((skill) => {
        expect(skill.metadata.input_schema).toBeDefined();
        expect(typeof skill.metadata.input_schema).toBe('object');
      });
    });

    it('should have executable logic', () => {
      forEachMockSkill((skill) => {
        expect(skill.logic).toBeDefined();
        expect(typeof skill.logic).toBe('function');
      });
    });
  });
});
