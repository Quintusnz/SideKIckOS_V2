/**
 * Skills Orchestrator
 * Handles dynamic tool registration and GPT-5 integration with streaming
 */

import { z } from 'zod';
import type { SkillMetadata } from '@/types';

/**
 * SkillsOrchestrator - Manages AI interaction with tools
 * Converts skills to tools and handles tool calling loop
 */
export class SkillsOrchestrator {
  private skills: Map<string, any> = new Map();

  /**
   * Register skills for tool calling
   */
  registerSkills(skillsData: Array<{ name: string; skill: any }>): void {
    skillsData.forEach(({ name, skill }) => {
      this.skills.set(name, skill);
    });
  }

  /**
   * Convert registered skills to tool definitions for Vercel AI SDK
   * Returns record of tool definitions compatible with streamText/generateText
   */
  getToolDefinitions(): Record<
    string,
    { description: string; parameters: z.ZodObject<any>; execute?: (input: any) => Promise<any> }
  > {
    const tools: Record<string, any> = {};

    this.skills.forEach((skill, skillName) => {
      const metadata = skill.metadata;
      const schema = this.createZodSchema(metadata.input_schema);

      tools[skillName] = {
        description: metadata.description,
        parameters: schema,
        execute: async (input: any) => {
          if (skill.logic) {
            return await skill.logic(input);
          }
          return { status: 'completed' };
        },
      };
    });

    return tools;
  }

  /**
   * Build system prompt with available skills context
   */
  buildSystemPrompt(): string {
    const skillsList = Array.from(this.skills.values())
      .map((skill) => {
        const meta = skill.metadata;
        return `- **${meta.name}** (${meta.category}): ${meta.description}\n  Input: ${JSON.stringify(meta.input_schema).substring(0, 50)}...`;
      })
      .join('\n');

    return `You are an AI assistant with access to the following skills:

${skillsList}

When the user asks for help, analyze their request and determine which skill(s) to use.
Use the appropriate tools to accomplish the task.
Always provide a summary of what you did and the results.`;
  }

  /**
   * Create Zod schema from input_schema definition
   * Converts simple schema format to Zod validation
   */
  private createZodSchema(inputSchema: Record<string, any>): z.ZodObject<any> {
    const fields: Record<string, any> = {};

    Object.entries(inputSchema).forEach(([key, def]: [string, any]) => {
      if (def.type === 'string') {
        if (def.enum) {
          fields[key] = z.enum(def.enum);
        } else {
          fields[key] = z.string();
        }
      } else if (def.type === 'number') {
        fields[key] = z.number();
      } else if (def.type === 'boolean') {
        fields[key] = z.boolean();
      } else {
        fields[key] = z.any();
      }

      // Make optional if has default
      if (def.default !== undefined) {
        fields[key] = fields[key].optional();
      } else if (!def.required) {
        fields[key] = fields[key].optional();
      }
    });

    return z.object(fields);
  }

  /**
   * Get a skill by name
   */
  getSkill(skillName: string): any {
    return this.skills.get(skillName);
  }

  /**
   * Invoke a skill directly (without AI)
   */
  async invokeSkill(skillName: string, input: any): Promise<any> {
    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (skill.logic) {
      return await skill.logic(input);
    }

    return null;
  }

  /**
   * List all available skills for context
   */
  listSkills(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }
}

// Export singleton
let orchestratorInstance: SkillsOrchestrator | null = null;

export function getSkillsOrchestrator(): SkillsOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new SkillsOrchestrator();
  }
  return orchestratorInstance;
}

export function resetSkillsOrchestrator(): void {
  orchestratorInstance = null;
}
