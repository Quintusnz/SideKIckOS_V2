/**
 * GET /api/skills
 * Returns list of all available skills with their metadata
 * Used by frontend to populate skill selector and display available tools to user
 */

import { NextRequest, NextResponse } from 'next/server';
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

interface SkillInfo {
  id: string;
  metadata: SkillMetadata;
  hasLogic: boolean;
}

/**
 * Parse YAML frontmatter from SKILL.md file
 */
async function parseSkillMetadata(skillPath: string): Promise<SkillMetadata | null> {
  try {
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Extract YAML frontmatter (text between --- markers)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.warn(`No YAML frontmatter found in ${skillMdPath}`);
      return null;
    }

    // Parse YAML
    const metadata = yaml.parse(frontmatterMatch[1]) as SkillMetadata;
    return metadata;
  } catch (error) {
    console.error(`Error parsing skill metadata from ${skillPath}:`, error);
    return null;
  }
}

/**
 * Check if skill has executable logic
 */
async function hasSkillLogic(skillPath: string): Promise<boolean> {
  try {
    const logicPath = path.join(skillPath, 'logic.ts');
    const files = await fs.readdir(skillPath);
    return files.some((f) => f === 'logic.ts' || f === 'logic.js');
  } catch {
    return false;
  }
}

/**
 * Discover all skills from the skills directory
 */
async function discoverSkills(): Promise<SkillInfo[]> {
  try {
    const skillsDir = path.join(process.cwd(), 'skills');

    // Check if skills directory exists
    try {
      await fs.access(skillsDir);
    } catch {
      console.warn('Skills directory not found');
      return [];
    }

    const skillDirs = await fs.readdir(skillsDir);
    const skills: SkillInfo[] = [];

    for (const skillDirName of skillDirs) {
      const skillPath = path.join(skillsDir, skillDirName);
      const stats = await fs.stat(skillPath);

      if (!stats.isDirectory()) continue;

      const metadata = await parseSkillMetadata(skillPath);
      if (!metadata) continue;

      const hasLogic = await hasSkillLogic(skillPath);

      skills.push({
        id: skillDirName,
        metadata,
        hasLogic,
      });
    }

    // Sort by name for consistent ordering
    skills.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));

    return skills;
  } catch (error) {
    console.error('Error discovering skills:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const skills = await discoverSkills();

    return NextResponse.json(
      {
        success: true,
        data: {
          skills: skills.map((skill) => ({
            id: skill.id,
            name: skill.metadata.name,
            version: skill.metadata.version,
            description: skill.metadata.description,
            category: skill.metadata.category,
            tools: skill.metadata.tools,
            input_schema: skill.metadata.input_schema,
            output_format: skill.metadata.output_format,
            hasLogic: skill.hasLogic,
            author: skill.metadata.author,
            tags: skill.metadata.tags,
          })),
          total: skills.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/skills:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve skills',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
