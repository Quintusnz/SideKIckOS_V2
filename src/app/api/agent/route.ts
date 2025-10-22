/**
 * POST /api/agent
 * Main orchestration endpoint that:
 * 1. Receives chat messages from frontend (via useChat hook)
 * 2. Registers available skills as AI tools
 * 3. Calls GPT-5 with streamText() from Vercel AI SDK
 * 4. Streams response back as Server-Sent Events (SSE)
 * 5. Frontend receives via useChat hook (automatic)
 *
 * This follows the Vercel AI SDK pattern for streaming with tool calling.
 */

import { NextRequest } from 'next/server';
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  category: string;
  tools: string[];
  input_schema: Record<string, any>;
  output_format: string;
  estimated_tokens?: number;
  author?: string;
  tags?: string[];
}

interface Skill {
  metadata: SkillMetadata;
  markdown: string;
  logic?: (input: any) => Promise<any>;
}

/**
 * Parse YAML frontmatter and extract metadata
 */
async function parseSkillMetadata(skillPath: string): Promise<{ metadata: SkillMetadata; markdown: string } | null> {
  try {
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf-8');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);
    if (!frontmatterMatch) {
      return null;
    }

    const metadata = yaml.parse(frontmatterMatch[1]) as SkillMetadata;
    const markdown = frontmatterMatch[2];

    return { metadata, markdown };
  } catch (error) {
    console.error(`Error parsing skill metadata:`, error);
    return null;
  }
}

/**
 * Load skill logic (lazy-loaded on-demand)
 */
async function loadSkillLogic(skillPath: string): Promise<((input: any) => Promise<any>) | undefined> {
  try {
    const logicPath = path.join(skillPath, 'logic.ts');
    const jsLogicPath = path.join(skillPath, 'logic.js');

    // Check if logic file exists
    const files = await fs.readdir(skillPath);
    if (!files.some((f) => f === 'logic.ts' || f === 'logic.js')) {
      return undefined;
    }

    // Dynamic import of the logic module
    // In production, you'd use a proper module loader
    // For now, we'll return a placeholder
    console.log(`Logic file exists for skill at ${skillPath}, but dynamic loading not fully implemented`);
    return undefined;
  } catch (error) {
    console.error(`Error loading skill logic:`, error);
    return undefined;
  }
}

/**
 * Discover and load all skills
 */
async function discoverSkills(): Promise<Map<string, Skill>> {
  const skillsMap = new Map<string, Skill>();

  try {
    const skillsDir = path.join(process.cwd(), 'skills');

    // Check if skills directory exists
    try {
      await fs.access(skillsDir);
    } catch {
      console.warn('Skills directory not found');
      return skillsMap;
    }

    const skillDirs = await fs.readdir(skillsDir);

    for (const skillDirName of skillDirs) {
      const skillPath = path.join(skillsDir, skillDirName);
      const stats = await fs.stat(skillPath);

      if (!stats.isDirectory()) continue;

      const parsed = await parseSkillMetadata(skillPath);
      if (!parsed) continue;

      const logic = await loadSkillLogic(skillPath);

      skillsMap.set(skillDirName, {
        metadata: parsed.metadata,
        markdown: parsed.markdown,
        logic,
      });
    }
  } catch (error) {
    console.error('Error discovering skills:', error);
  }

  return skillsMap;
}

/**
 * Convert JSON schema to Zod schema
 * Handles: string, number, boolean, object
 */
function createZodSchema(schema: Record<string, any>): z.ZodType<any> {
  const shape: Record<string, z.ZodType<any>> = {};

  for (const [key, field] of Object.entries(schema)) {
    let zodField: z.ZodType<any>;

    if (typeof field === 'string') {
      // Simple type string like "string", "number"
      switch (field) {
        case 'string':
          zodField = z.string();
          break;
        case 'number':
          zodField = z.number();
          break;
        case 'boolean':
          zodField = z.boolean();
          break;
        default:
          zodField = z.any();
      }
    } else if (typeof field === 'object' && field !== null) {
      // Complex type with options or enum
      if (field.type === 'string' && field.enum) {
        zodField = z.enum(field.enum);
      } else if (field.type === 'string') {
        zodField = z.string().describe(field.description || '');
      } else if (field.type === 'number') {
        zodField = z.number();
      } else if (field.type === 'boolean') {
        zodField = z.boolean();
      } else {
        zodField = z.any();
      }
    } else {
      zodField = z.any();
    }

    // Make optional if not in required array
    if (!field.required) {
      zodField = zodField.optional();
    }

    shape[key] = zodField;
  }

  return z.object(shape);
}

/**
 * Build system prompt with available skills
 */
function buildSystemPrompt(skills: Map<string, Skill>): string {
  const skillList = Array.from(skills.values())
    .map((skill) => `- **${skill.metadata.name}** (v${skill.metadata.version}): ${skill.metadata.description}`)
    .join('\n');

  return `You are an AI assistant with access to specialized tools (skills) that can help users accomplish tasks.

Available Skills:
${skillList}

When a user asks for help, analyze their request and determine which skill(s) to invoke. 
Provide clear explanations of what you're doing and the results.

Use the tool calls to execute skills when appropriate. Always explain the results to the user.`;
}

/**
 * Execute a skill by name with given input
 * Note: In production, you'd integrate with the actual skill logic
 */
async function executeSkill(skillName: string, input: any, skills: Map<string, Skill>): Promise<any> {
  const skill = skills.get(skillName);
  if (!skill) {
    return {
      success: false,
      error: `Skill '${skillName}' not found`,
    };
  }

  try {
    // If skill has logic, execute it
    if (skill.logic) {
      const result = await skill.logic(input);
      return {
        success: true,
        skill: skillName,
        result,
      };
    }

    // Otherwise return metadata-only response
    return {
      success: true,
      skill: skillName,
      message: 'Skill invoked (logic not available)',
      metadata: skill.metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error executing skill',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request: messages array required', { status: 400 });
    }

    // Discover available skills
    const skills = await discoverSkills();

    // Build tool definitions from skills
    const toolDefinitions: Record<string, any> = {};

    for (const [skillId, skill] of skills.entries()) {
      const metadata = skill.metadata;

      // Create Zod schema from input_schema
      const zodSchema = createZodSchema(metadata.input_schema);

      // Create tool definition
      toolDefinitions[skillId] = tool({
        description: metadata.description,
        parameters: zodSchema as any,
      } as any);

      // Add execute function directly to avoid type issues
      const executeFunc = async (input: any) => {
        return await executeSkill(skillId, input, skills);
      };
      toolDefinitions[skillId].execute = executeFunc;
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(skills);

    // Call streamText from Vercel AI SDK
    // This automatically handles tool calling loop
    const result = await streamText({
      model: openai(process.env.AI_MODEL || 'gpt-4-turbo'),
      system: systemPrompt,
      tools: toolDefinitions as any,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Convert to Server-Sent Events stream response
    // Frontend receives via useChat hook automatically
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error in POST /api/agent:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(`Error: ${errorMessage}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
