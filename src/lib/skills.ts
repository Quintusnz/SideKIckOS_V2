/**
 * Skill Registry - Core component for skill discovery and management
 * Handles SKILL.md parsing, metadata loading, and lazy-loaded logic
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import type { SkillMetadata, Skill } from '@/types';

/**
 * SkillRegistry - Manages all available skills
 * - Loads skill metadata on initialization
 * - Lazy-loads executable logic only when needed
 * - Provides skill lookup and invocation
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;

  constructor(skillsDir: string = './skills') {
    this.skillsDir = skillsDir;
  }

  /**
   * Initialize registry by scanning skills directory
   * Loads metadata from SKILL.md files but NOT the logic.js files yet
   */
  async initialize(): Promise<void> {
    try {
      const skillFolders = await fs.readdir(this.skillsDir);

      for (const folder of skillFolders) {
        const skillPath = path.join(this.skillsDir, folder);
        const stats = await fs.stat(skillPath);

        if (stats.isDirectory()) {
          await this.loadSkillMetadata(folder, skillPath);
        }
      }

      console.log(`[SkillRegistry] Loaded ${this.skills.size} skills`);
    } catch (error) {
      console.warn(
        `[SkillRegistry] Could not initialize: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load skill metadata from SKILL.md file
   * This is called during initialization - logic is NOT loaded yet
   */
  private async loadSkillMetadata(
    skillName: string,
    skillPath: string
  ): Promise<void> {
    try {
      const skillMdPath = path.join(skillPath, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      // Extract YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.warn(
          `[SkillRegistry] No YAML frontmatter in ${skillName}/SKILL.md`
        );
        return;
      }

      // Parse YAML metadata
      const metadata = yaml.parse(frontmatterMatch[1]) as SkillMetadata;
      const markdown = content.substring(frontmatterMatch[0].length).trim();

      // Store skill with metadata and markdown, but NOT logic
      this.skills.set(skillName, {
        metadata,
        markdown,
        // logic is undefined until explicitly loaded
      });

      console.log(
        `[SkillRegistry] Loaded metadata for skill: ${metadata.name}`
      );
    } catch (error) {
      console.error(
        `[SkillRegistry] Failed to load ${skillName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lazy-load skill logic (only when skill is invoked)
   */
  private async loadSkillLogic(skillName: string): Promise<void> {
    const skill = this.skills.get(skillName);
    if (!skill || skill.logic) return; // Already loaded

    try {
      const skillPath = path.join(this.skillsDir, skillName);
      const logicPath = path.join(skillPath, 'logic.ts');
      const logicJsPath = path.join(skillPath, 'logic.js');

      // Try TypeScript first, then JavaScript
      let logicExists = false;
      let logicFile = logicPath;

      try {
        await fs.stat(logicPath);
        logicExists = true;
      } catch {
        try {
          await fs.stat(logicJsPath);
          logicExists = true;
          logicFile = logicJsPath;
        } catch {
          // Logic file not found - that's OK, it's optional
        }
      }

      if (logicExists) {
        // Dynamically import the logic
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require(logicFile);
        skill.logic = module.default || module;
        console.log(`[SkillRegistry] Lazy-loaded logic for skill: ${skillName}`);
      }
    } catch (error) {
      console.warn(
        `[SkillRegistry] Could not load logic for ${skillName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get all skill metadata (for GPT context)
   * Returns only metadata, NOT executable logic
   */
  async getSkillMetadata(): Promise<SkillMetadata[]> {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  /**
   * Get a specific skill
   */
  getSkill(skillName: string): Skill | undefined {
    return this.skills.get(skillName);
  }

  /**
   * Invoke a skill with given input
   * This is where lazy-loading of logic happens
   */
  async invokeSkill(skillName: string, input: any): Promise<any> {
    const skill = this.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    // Lazy-load logic if needed
    await this.loadSkillLogic(skillName);

    // If skill has executable logic, invoke it
    if (skill.logic) {
      try {
        return await skill.logic(input);
      } catch (error) {
        throw new Error(
          `Skill execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Otherwise return skill metadata + markdown for AI interpretation
    return {
      type: 'markdown_skill',
      metadata: skill.metadata,
      markdown: skill.markdown,
      input,
    };
  }

  /**
   * List all available skills
   */
  listSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Check if a skill exists
   */
  hasSkill(skillName: string): boolean {
    return this.skills.has(skillName);
  }

  /**
   * Get a skill by name (for debugging)
   */
  getSkillMetadataByName(skillName: string): SkillMetadata | undefined {
    return this.skills.get(skillName)?.metadata;
  }
}

// Export singleton instance
let registryInstance: SkillRegistry | null = null;

export async function getSkillRegistry(): Promise<SkillRegistry> {
  if (!registryInstance) {
    registryInstance = new SkillRegistry();
    await registryInstance.initialize();
  }
  return registryInstance;
}

export function resetSkillRegistry(): void {
  registryInstance = null;
}
