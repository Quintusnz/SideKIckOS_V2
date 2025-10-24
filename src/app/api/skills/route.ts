/**
 * GET /api/skills
 * Returns list of all available skills with their metadata
 * Used by frontend to populate skill selector and display available tools to user
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import type { JsonValue, SkillMetadata } from '@/types';

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
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      console.warn(`No YAML frontmatter found in ${skillMdPath}`);
      return null;
    }

    // Parse YAML
    const metadata = normalizeSkillMetadata(yaml.parse(frontmatterMatch[1]));

    if (!metadata) {
      console.warn(`Invalid metadata schema in ${skillMdPath}`);
    }

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

export async function GET() {
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

type UnknownRecord = Record<string, unknown>;

function normalizeSkillMetadata(raw: unknown): SkillMetadata | null {
  if (!isRecord(raw)) {
    return null;
  }

  const name = typeof raw.name === 'string' ? raw.name : undefined;
  const version = typeof raw.version === 'string' ? raw.version : undefined;
  const description = typeof raw.description === 'string' ? raw.description : undefined;
  const category = typeof raw.category === 'string' ? raw.category : undefined;
  const tools = Array.isArray(raw.tools) ? raw.tools.filter((tool): tool is string => typeof tool === 'string') : [];
  const outputFormat = typeof raw.output_format === 'string' ? raw.output_format : undefined;

  if (!name || !version || !description || !category || tools.length === 0 || !outputFormat) {
    return null;
  }

  const inputSchema = toJsonRecord(raw.input_schema);

  const estimatedTokens = typeof raw.estimated_tokens === 'number' && Number.isFinite(raw.estimated_tokens)
    ? raw.estimated_tokens
    : undefined;
  const author = typeof raw.author === 'string' ? raw.author : undefined;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined;

  return {
    name,
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

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (isRecord(value)) {
    const record: Record<string, JsonValue> = {};
    Object.entries(value).forEach(([key, entry]) => {
      record[key] = toJsonValue(entry);
    });
    return record;
  }

  return String(value);
}

function toJsonRecord(value: unknown): Record<string, JsonValue> {
  if (!isRecord(value)) {
    return {};
  }

  const record: Record<string, JsonValue> = {};
  Object.entries(value).forEach(([key, entry]) => {
    record[key] = toJsonValue(entry);
  });
  return record;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
