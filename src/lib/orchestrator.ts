/**
 * Skills Orchestrator
 * Handles dynamic tool registration and GPT-5 integration with streaming
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type {
  SkillMetadata,
  Skill,
  JsonValue,
  SkillInvocationInput,
  SkillInvocationResult,
} from '@/types';
import type { SkillRegistry } from './skills';

/**
 * Execution metrics for tracking skill performance
 */
export interface SkillMetric {
  skillName: string;
  executionCount: number;
  averageDuration: number;
  lastExecutedAt: Date | null;
  errorCount: number;
}

/**
 * SkillsOrchestrator - Manages AI interaction with tools
 * Converts skills to tools and handles tool calling loop
 */
export class SkillsOrchestrator {
  private skills: Map<string, Skill> = new Map();
  private metrics: Map<string, SkillMetric> = new Map();
  private executionCache: Map<string, SkillInvocationResult> = new Map();
  private retryAttempts: number = 3;
  private retryDelayMs: number = 1000;
  private registry?: SkillRegistry;

  /**
   * Register skills for tool calling
   */
  registerSkills(skillsData: Array<{ name: string; skill: Skill }>): void {
    skillsData.forEach(({ name, skill }) => {
      const normalizedSkill = this.normalizeSkill(name, skill);
      this.skills.set(name, normalizedSkill);

      if (!this.metrics.has(name)) {
        this.metrics.set(name, {
          skillName: name,
          executionCount: 0,
          averageDuration: 0,
          lastExecutedAt: null,
          errorCount: 0,
        });
      }
    });
  }

  attachSkillRegistry(registry: SkillRegistry): void {
    this.registry = registry;
  }

  /**
   * Convert registered skills to tool definitions for Vercel AI SDK
   * Returns record of tool definitions compatible with streamText/generateText
   */
  getToolDefinitions(): Record<
    string,
    {
      description: string;
      inputSchema: z.ZodTypeAny;
      execute: (
        input: SkillInvocationInput,
      ) => Promise<SkillInvocationResult>;
    }
  > {
    const tools: Record<string, {
      description: string;
      inputSchema: z.ZodTypeAny;
      execute: (
        input: SkillInvocationInput,
      ) => Promise<SkillInvocationResult>;
    }> = {};

    this.skills.forEach((skill: Skill, skillName) => {
      const metadata = skill.metadata as SkillMetadata;
      const schema = this.createZodSchema(metadata.input_schema ?? {});

      tools[skillName] = {
        description: metadata.description,
        inputSchema: schema,
        execute: async (input: SkillInvocationInput) =>
          await this.invokeSkill(skillName, input),
      };
    });

    return tools;
  }

  /**
   * Convert registered skills into AI SDK tool definitions ready for streamText/generateText.
   */
  buildToolSet(): ToolSet {
    const definitions = this.getToolDefinitions();
    const toolSet: ToolSet = {};
    type ToolOptions = Parameters<typeof tool>[0];

    Object.entries(definitions).forEach(([toolName, definition]) => {
      const executeWrapper = async (
        params: unknown,
      ): Promise<SkillInvocationResult> =>
        definition.execute(params as SkillInvocationInput);

      const baseOptions: ToolOptions = {
        description: definition.description,
        inputSchema: definition.inputSchema as unknown as ToolOptions['inputSchema'],
      };

      const toolDefinition = tool(baseOptions);

      (toolDefinition as unknown as { execute?: typeof executeWrapper }).execute = executeWrapper;

      toolSet[toolName] = toolDefinition as unknown as ToolSet[string];
    });

    return toolSet;
  }

  /**
   * Build system prompt with available skills context
   */
  buildSystemPrompt(): string {
    const skillsList = Array.from(this.skills.entries())
      .map(([skillId, skill]) => this.describeSkill(skillId, skill.metadata))
      .join('\n\n');

    const formattedSkills = skillsList.length > 0
      ? skillsList
      : '- No skills are currently registered. Respond that you are unavailable.';

    return `You are an AI assistant with access to the following skills:

${formattedSkills}

When the user asks for help, analyze their request and determine which skill(s) to use.
Use the appropriate tools to accomplish the task.
Always provide a summary of what you did and the results.`;
  }

  private normalizeSkill(skillId: string, skill: Skill): Skill {
    const metadata = this.normalizeMetadata(skillId, skill.metadata);
    return {
      ...skill,
      metadata,
    };
  }

  private normalizeMetadata(skillId: string, metadata: SkillMetadata): SkillMetadata {
    const displayName = this.normalizeName(skillId, metadata.name);
    const version = this.normalizeText(metadata.version, '1.0.0');
    const description = this.normalizeText(metadata.description, 'No description provided.');
    const category = this.normalizeText(metadata.category, 'general');
    const tools = this.normalizeStringArray(metadata.tools);
    const inputSchema = this.normalizeInputSchema(metadata.input_schema);
    const outputFormat = this.normalizeText(metadata.output_format, 'text');
    const estimatedTokens = typeof metadata.estimated_tokens === 'number' && Number.isFinite(metadata.estimated_tokens)
      ? metadata.estimated_tokens
      : undefined;
    const author = this.normalizeOptionalText(metadata.author);
    const tags = this.normalizeOptionalStringArray(metadata.tags);

    return {
      name: displayName,
      version,
      description,
      category,
      tools,
      input_schema: inputSchema,
      output_format: outputFormat,
      estimated_tokens: estimatedTokens,
      author,
      tags,
    };
  }

  private normalizeName(skillId: string, name?: string): string {
    if (typeof name === 'string' && name.trim().length > 0) {
      return name.trim();
    }

    return skillId
      .split(/[_-]/)
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private normalizeText(value: string | undefined, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return fallback;
  }

  private normalizeOptionalText(value: string | undefined): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return undefined;
  }

  private normalizeStringArray(values: string[] | undefined): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  }

  private normalizeOptionalStringArray(values: string[] | undefined): string[] | undefined {
    const normalized = this.normalizeStringArray(values);
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeInputSchema(schema: Record<string, JsonValue> | undefined): Record<string, JsonValue> {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return {};
    }

    const entries: Array<[string, JsonValue]> = Object.entries(schema).filter(
      ([key]) => typeof key === 'string' && key.length > 0,
    );

    return entries.reduce<Record<string, JsonValue>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  private describeSkill(skillId: string, metadata: SkillMetadata): string {
    const inputs = this.summarizeInputSchema(metadata.input_schema);
    const tools = metadata.tools.length > 0 ? metadata.tools.join(', ') : 'No external tools';

    return `- **${metadata.name}** (${metadata.category})
  ID: ${skillId}
  Description: ${metadata.description}
  Tools: ${tools}
  Input Parameters: ${inputs}`;
  }

  private summarizeInputSchema(schema: Record<string, JsonValue>): string {
    const entries = Object.entries(schema);

    if (entries.length === 0) {
      return 'No inputs required';
    }

    return entries
      .map(([field, definition]) => {
        const typeLabel = this.inferFieldType(definition);
        const optional = this.isFieldRequired(definition) ? '' : ' (optional)';
        return `${field}: ${typeLabel}${optional}`;
      })
      .join('; ');
  }

  private inferFieldType(definition: JsonValue): string {
    if (definition == null) {
      return 'unknown';
    }

    if (typeof definition === 'string') {
      return definition;
    }

    if (Array.isArray(definition)) {
      return 'array';
    }

    if (typeof definition !== 'object') {
      return typeof definition;
    }

    const record = definition as Record<string, JsonValue> & {
      type?: JsonValue;
      enum?: JsonValue;
      items?: JsonValue;
      element?: JsonValue;
      properties?: JsonValue;
      fields?: JsonValue;
    };

    if (Array.isArray(record.enum) && record.enum.length > 0) {
      return 'enum';
    }

    const type = typeof record.type === 'string' ? record.type : undefined;
    if (type) {
      return type;
    }

    if (record.items != null || record.element != null) {
      return 'array';
    }

    if (record.properties != null || record.fields != null) {
      return 'object';
    }

    return 'unknown';
  }

  /**
   * Create Zod schema from input_schema definition
   * Converts simple schema format to Zod validation
   */
  private createZodSchema(
    inputSchema: Record<string, JsonValue>,
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const fields: Record<string, z.ZodTypeAny> = {};

    Object.entries(inputSchema || {}).forEach(([key, definition]) => {
      const schema = this.resolveSchemaDefinition(definition);
      const isRequired = this.isFieldRequired(definition);

      let enrichedSchema = schema;

      if (!isRequired) {
        enrichedSchema = enrichedSchema.optional();
      }

      const defaultValue = this.getDefaultValue(definition);
      if (defaultValue !== undefined && 'default' in enrichedSchema) {
        enrichedSchema = (enrichedSchema as z.ZodTypeAny).default(defaultValue);
      }

      const description = this.getDescription(definition);
      if (description) {
        enrichedSchema = enrichedSchema.describe(description);
      }

      fields[key] = enrichedSchema;
    });

    return z.object(fields);
  }

  private resolveSchemaDefinition(definition: JsonValue): z.ZodTypeAny {
    if (definition == null) {
      return z.any();
    }

    if (typeof definition === 'string') {
      return this.schemaFromPrimitive(definition);
    }

    if (Array.isArray(definition)) {
      const [first] = definition;
      return z.array(this.resolveSchemaDefinition(first ?? {}));
    }

    if (typeof definition !== 'object') {
      return z.any();
    }

    if (definition.enum && Array.isArray(definition.enum) && definition.enum.length > 0) {
      return z.enum(definition.enum as [string, ...string[]]);
    }

    const typedDefinition = definition as Record<string, JsonValue>;
    const type = (typedDefinition.type as string | undefined) ?? (typedDefinition.dataType as string | undefined);

    if (type === 'array') {
      const itemDefinition = (typedDefinition.items as JsonValue | undefined)
        ?? (typedDefinition.element as JsonValue | undefined)
        ?? {};
      return z.array(this.resolveSchemaDefinition(itemDefinition));
    }

    if (type === 'object') {
      const properties = (typedDefinition.properties as Record<string, JsonValue> | undefined)
        ?? (typedDefinition.fields as Record<string, JsonValue> | undefined)
        ?? {};
      return this.createZodSchema(properties);
    }

    if (type === 'number') {
      return z.number();
    }

    if (type === 'boolean') {
      return z.boolean();
    }

    if (type === 'string') {
      return z.string();
    }

    return type ? this.schemaFromPrimitive(type) : z.any();
  }

  private schemaFromPrimitive(type: string): z.ZodTypeAny {
    switch (type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.any());
      case 'object':
        return z.object({}).catchall(z.any());
      default:
        return z.any();
    }
  }

  private isFieldRequired(definition: JsonValue): boolean {
    if (definition == null) return true;
    if (typeof definition === 'string') return true;
    if (typeof definition !== 'object') return true;

    const typedDefinition = definition as Record<string, JsonValue> & {
      required?: boolean;
      optional?: boolean;
      default?: JsonValue;
    };

    if (typedDefinition.required === false) return false;
    if (typedDefinition.optional === true) return false;
    if (typedDefinition.default !== undefined) return false;

    return true;
  }

  private getDefaultValue(definition: JsonValue): JsonValue | undefined {
    if (definition && typeof definition === 'object' && 'default' in definition) {
      return (definition as { default?: JsonValue }).default;
    }
    return undefined;
  }

  private getDescription(definition: JsonValue): string | undefined {
    if (definition && typeof definition === 'object') {
      const asRecord = definition as Record<string, JsonValue> & {
        description?: JsonValue;
        summary?: JsonValue;
      };
      return typeof asRecord.description === 'string'
        ? asRecord.description
        : typeof asRecord.summary === 'string'
        ? asRecord.summary
        : undefined;
    }
    return undefined;
  }

  /**
   * Get a skill by name
   */
  getSkill(skillName: string): Skill | undefined {
    return this.skills.get(skillName);
  }

  /**
   * Invoke a skill directly (without AI)
   */
  async invokeSkill(
    skillName: string,
    input: SkillInvocationInput,
    executionContext?: Record<string, unknown>,
  ): Promise<SkillInvocationResult> {
    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    if (skill.logic) {
      return await skill.logic(input, executionContext);
    }

    if (this.registry) {
      return await this.registry.invokeSkill(skillName, input);
    }

    return {
      type: 'metadata_only',
      status: 'completed',
      skill: skillName,
      metadata: skill.metadata,
      note: 'Skill has no executable logic; returned metadata only.',
      input,
    };
  }

  /**
   * Invoke skill with retry logic
   */
  async invokeSkillWithRetry(
    skillName: string,
    input: SkillInvocationInput,
    maxAttempts?: number,
  ): Promise<SkillInvocationResult> {
    const attempts = maxAttempts || this.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.invokeSkill(skillName, input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < attempts) {
          // Exponential backoff
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Skill invocation failed after retries');
  }

  /**
   * Execute multiple skills in parallel
   */
  async executeSkillsParallel(
    executions: Array<{ skillName: string; input: SkillInvocationInput }>,
  ): Promise<{
    results: Record<string, SkillInvocationResult>;
    errors: Record<string, Error>;
  }> {
    const results: Record<string, SkillInvocationResult> = {};
    const errors: Record<string, Error> = {};

    const promises = executions.map(async ({ skillName, input }, index) => {
      try {
        const result = await this.invokeSkill(skillName, input);
        results[`${skillName}_${index}`] = result;
      } catch (error) {
        errors[`${skillName}_${index}`] =
          error instanceof Error ? error : new Error(String(error));
      }
    });

    await Promise.all(promises);

    return { results, errors };
  }

  /**
   * Get metrics for a skill
   */
  getSkillMetrics(skillName?: string): SkillMetric | SkillMetric[] {
    if (skillName) {
      return (
        this.metrics.get(skillName) || {
          skillName,
          executionCount: 0,
          averageDuration: 0,
          lastExecutedAt: null,
          errorCount: 0,
        }
      );
    }

    return Array.from(this.metrics.values());
  }

  /**
   * Clear execution cache
   */
  clearCache(skillName?: string): void {
    if (skillName) {
      const keysToDelete: string[] = [];
      this.executionCache.forEach((_, key) => {
        if (key.startsWith(skillName)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.executionCache.delete(key));
    } else {
      this.executionCache.clear();
    }
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
