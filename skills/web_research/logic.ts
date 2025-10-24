import fs from 'fs/promises';
import path from 'path';

/**
 * Web Research Skill Logic
 * Calls the Tavily Search API when available and falls back to
 * synthetic summaries if no API key is configured or the request fails.
 */

type ResearchDepth = 'shallow' | 'deep';

interface ResearchInput {
  query: string;
  depth?: ResearchDepth;
  max_sources?: number;
}

interface ResearchFinding {
  rank: number;
  source: string;
  title: string;
  relevance: number;
  snippet: string;
  url?: string;
  published_at?: string;
  detailed_summary?: string;
  key_points?: string[];
}

interface ResearchOutput {
  query: string;
  depth: ResearchDepth;
  status: 'completed';
  sources_found: number;
  max_sources: number;
  findings: ResearchFinding[];
  summary: string;
  report: string;
  execution_time_ms: number;
  timestamp: string;
}

interface TavilySearchRequest {
  api_key: string;
  query: string;
  search_depth: 'basic' | 'advanced';
  max_results: number;
  include_answer: boolean;
  include_images: boolean;
  include_image_descriptions: boolean;
  include_raw_content: boolean;
}

interface TavilySearchResult {
  title?: string;
  url: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
let cachedApiKey: string | null | undefined;

/**
 * Executes web research on a query.
 * Returns structured findings and markdown report with citations when possible.
 */
export default async function webResearch(
  input: ResearchInput,
): Promise<ResearchOutput> {
  const startTime = performance.now();
  const { query, depth = 'shallow' } = input;
  const maxSources = normalizeMaxSources(input.max_sources);

  if (!isValidQuery(query)) {
    throw new Error('Query must be a non-empty string');
  }

  const apiKey = await resolveTavilyApiKey();
  const normalizedDepth = depth === 'deep' ? 'deep' : 'shallow';

  try {
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not configured');
    }

    const tavilyResponse = await callTavilyApi({
      query,
      depth: normalizedDepth,
      maxResults: maxSources,
      apiKey,
    });

    const findings = buildFindingsFromTavily(tavilyResponse.results, normalizedDepth);
    const executionTime = getExecutionTime(startTime);

    return {
      query,
      depth: normalizedDepth,
      status: 'completed',
      sources_found: findings.length,
      max_sources: maxSources,
      findings,
      summary: buildSummaryFromTavily(query, findings, tavilyResponse.answer, normalizedDepth),
      report: buildMarkdownReport(query, findings, normalizedDepth, tavilyResponse.answer),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    } satisfies ResearchOutput;
  } catch (error) {
    console.warn('[web_research] Falling back to synthetic findings:', error instanceof Error ? error.message : error);

    const findings = buildFallbackFindings(query, normalizedDepth, maxSources);
    const executionTime = getExecutionTime(startTime);

    return {
      query,
      depth: normalizedDepth,
      status: 'completed',
      sources_found: findings.length,
      max_sources: maxSources,
      findings,
      summary: buildFallbackSummary(query, findings, normalizedDepth),
      report: buildFallbackMarkdown(query, findings, normalizedDepth),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    } satisfies ResearchOutput;
  }
}

function isValidQuery(query: string | undefined): query is string {
  return typeof query === 'string' && query.trim().length > 0;
}

function normalizeMaxSources(value: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(Math.floor(value), 1), 10);
  }
  return 5;
}

async function callTavilyApi(params: {
  query: string;
  depth: ResearchDepth;
  maxResults: number;
  apiKey: string;
}): Promise<TavilySearchResponse> {
  const body: TavilySearchRequest = {
    api_key: params.apiKey,
    query: params.query,
    search_depth: params.depth === 'deep' ? 'advanced' : 'basic',
    max_results: params.maxResults,
    include_answer: true,
    include_images: false,
    include_image_descriptions: false,
    include_raw_content: false,
  };

  const response = await fetch(TAVILY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as TavilySearchResponse;

  if (!Array.isArray(data.results)) {
    throw new Error('Unexpected Tavily response format');
  }

  return data;
}

function buildFindingsFromTavily(
  results: TavilySearchResult[],
  depth: ResearchDepth,
): ResearchFinding[] {
  const hasResults = Array.isArray(results) && results.length > 0;
  if (!hasResults) {
    return [];
  }

  return results.map((result, index) => {
    const snippet = sanitizeSnippet(result.content ?? '');
    const keyPoints = depth === 'deep' ? extractKeyPoints(snippet) : undefined;

    return {
      rank: index + 1,
      source: deriveSourceName(result.url),
      title: result.title ?? result.url,
      relevance: normalizeScore(result.score),
      snippet: snippet || 'No summary provided.',
      url: result.url,
      published_at: result.published_date,
      detailed_summary: depth === 'deep' ? snippet : undefined,
      key_points: keyPoints,
    } satisfies ResearchFinding;
  });
}

function buildSummaryFromTavily(
  query: string,
  findings: ResearchFinding[],
  answer: string | undefined,
  depth: ResearchDepth,
): string {
  if (answer && answer.trim().length > 0) {
    return answer.trim();
  }

  if (findings.length === 0) {
    return `No relevant sources were returned for "${query}".`;
  }

  const avgRelevance = Math.round(
    (findings.reduce((sum, item) => sum + item.relevance, 0) / findings.length) * 100,
  );

  return `Found ${findings.length} sources for "${query}" (avg relevance score: ${avgRelevance}/100). Research depth: ${depth === 'deep' ? 'comprehensive' : 'quick scan'}.`;
}

function buildMarkdownReport(
  query: string,
  findings: ResearchFinding[],
  depth: ResearchDepth,
  answer: string | undefined,
): string {
  const lines: string[] = [];

  lines.push(`# Research Report: ${query}`);
  lines.push('');
  lines.push(`**Research Type:** ${depth === 'deep' ? 'Deep (advanced Tavily search)' : 'Shallow (quick Tavily scan)'}`);
  lines.push(`**Sources Found:** ${findings.length}`);
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push(answer && answer.trim().length > 0 ? answer.trim() : buildSummaryFromTavily(query, findings, undefined, depth));
  lines.push('');

  if (findings.length > 0) {
    lines.push('## Key Findings');
    findings.forEach((finding) => {
      lines.push('');
      lines.push(`### ${finding.rank}. ${finding.title}`);
      lines.push(`- **Source:** ${finding.source}`);
      if (finding.url) {
        lines.push(`- **Link:** ${finding.url}`);
      }
      lines.push(`- **Relevance Score:** ${Math.round(finding.relevance)}/100`);
      lines.push(`- **Summary:** ${finding.snippet}`);
      if (finding.published_at) {
        lines.push(`- **Published:** ${finding.published_at}`);
      }
      if (finding.key_points && finding.key_points.length > 0) {
        lines.push('- **Key Points:**');
        finding.key_points.forEach((point) => {
          lines.push(`  - ${point}`);
        });
      }
    });
  } else {
    lines.push('## Key Findings');
    lines.push('No sources were returned.');
  }

  lines.push('');
  lines.push('---');
  lines.push('*This report was generated by the Web Research skill using the Tavily Search API.*');

  return lines.join('\n');
}

async function resolveTavilyApiKey(): Promise<string | undefined> {
  if (cachedApiKey !== undefined) {
    return cachedApiKey ?? undefined;
  }

  const fromEnv = normalizeEnvValue(process.env.TAVILY_API_KEY);
  if (fromEnv) {
    cachedApiKey = fromEnv;
    return fromEnv;
  }

  const candidatePaths = getCandidateEnvPaths();

  for (const filePath of candidatePaths) {
    try {
      const contents = await fs.readFile(filePath, 'utf-8');
      const extracted = extractEnvValue(contents, 'TAVILY_API_KEY');
      if (extracted) {
        cachedApiKey = extracted;
        return extracted;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code && code !== 'ENOENT') {
        console.warn('[web_research] Failed to read env file', filePath, error);
      }
    }
  }

  cachedApiKey = null;
  return undefined;
}

function getCandidateEnvPaths(): string[] {
  const cwd = process.cwd();
  const files = [
    '.env.local',
    '.env.development.local',
    '.env.development',
    '.env',
  ];

  return files.map((file) => path.resolve(cwd, file));
}

function extractEnvValue(source: string, key: string): string | undefined {
  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const normalized = trimmedLine.startsWith('export ')
      ? trimmedLine.slice('export '.length).trim()
      : trimmedLine;

    const [lhs, ...rhsParts] = normalized.split('=');
    if (!lhs || lhs.trim() !== key) {
      continue;
    }

    const rawValue = rhsParts.join('=').trim();
    if (rawValue.length === 0) {
      return undefined;
    }

    const unquoted = rawValue.replace(/^['"]/, '').replace(/['"]$/, '');
    return normalizeEnvValue(unquoted);
  }

  return undefined;
}

function normalizeEnvValue(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildFallbackFindings(
  query: string,
  depth: ResearchDepth,
  maxSources: number,
): ResearchFinding[] {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 0);
  const count = Math.min(maxSources, Math.max(terms.length, depth === 'deep' ? 5 : 3));

  return Array.from({ length: count }).map((_, index) => {
    const term = terms[index % terms.length] ?? query;
    return {
      rank: index + 1,
      source: 'Synthetic Source',
      title: `${capitalize(term)} insights and industry commentary`,
      relevance: 75 + Math.round(Math.random() * 15),
      snippet: `Analysis of ${term} highlights notable developments and strategic implications based on historical data and expert commentary.`,
      detailed_summary: depth === 'deep'
        ? `Expanded coverage of ${term} including market dynamics, competitive positioning, and future outlook.`
        : undefined,
      key_points: depth === 'deep'
        ? [
            `${capitalize(term)} continues to shape competitive strategy`,
            `Adoption barriers focus on governance and integration for ${term}`,
            `Leading organizations report tangible ROI from ${term} initiatives`,
          ]
        : undefined,
    } satisfies ResearchFinding;
  });
}

function buildFallbackSummary(
  query: string,
  findings: ResearchFinding[],
  depth: ResearchDepth,
): string {
  return `Generated ${findings.length} synthetic findings for "${query}" (${depth} depth). Configure TAVILY_API_KEY to enable live web citations.`;
}

function buildFallbackMarkdown(
  query: string,
  findings: ResearchFinding[],
  depth: ResearchDepth,
): string {
  const lines: string[] = [];
  lines.push(`# Research Report: ${query}`);
  lines.push('');
  lines.push(`**Research Type:** ${depth}`);
  lines.push(`**Sources Found:** ${findings.length}`);
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(buildFallbackSummary(query, findings, depth));
  lines.push('');
  lines.push('## Key Findings');
  findings.forEach((finding) => {
    lines.push('');
    lines.push(`### ${finding.rank}. ${finding.title}`);
    lines.push(`- **Source:** ${finding.source}`);
    lines.push(`- **Relevance Score:** ${Math.round(finding.relevance)}/100`);
    lines.push(`- **Summary:** ${finding.snippet}`);
    if (finding.detailed_summary) {
      lines.push(`- **Details:** ${finding.detailed_summary}`);
    }
    if (finding.key_points) {
      lines.push('- **Key Points:**');
      finding.key_points.forEach((point) => lines.push(`  - ${point}`));
    }
  });
  lines.push('');
  lines.push('---');
  lines.push('*Synthetic findings generated because Tavily Search is unavailable.*');
  return lines.join('\n');
}

function getExecutionTime(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function sanitizeSnippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractKeyPoints(text: string): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 0)
    .slice(0, 3);
}

function deriveSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown Source';
  }
}

function normalizeScore(score: number | undefined): number {
  if (typeof score === 'number' && Number.isFinite(score)) {
    const bounded = Math.min(Math.max(score, 0), 1);
    return Math.round(bounded * 100);
  }
  return 70;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
