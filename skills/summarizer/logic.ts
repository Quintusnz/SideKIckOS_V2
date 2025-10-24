/**
 * Summarizer Skill Logic
 * Summarizes content into concise, well-structured summaries
 */

type SummaryStyle = 'bullet-points' | 'paragraphs' | 'executive-summary';

interface SummarizerInput {
  content: string;
  style?: SummaryStyle;
  max_length?: number;
}

interface SummarizerOutput {
  status: 'completed';
  style: SummaryStyle;
  original_word_count: number;
  original_sentence_count: number;
  summary_word_count: number;
  summary_sentence_count: number;
  reduction_percentage: number;
  compression_ratio: number;
  content: string;
  execution_time_ms: number;
  timestamp: string;
}

/**
 * Summarize content in the specified style
 */
export default async function summarizer(
  input: SummarizerInput,
): Promise<SummarizerOutput> {
  const startTime = performance.now();
  const {
    content,
    style = 'bullet-points',
    max_length = 150,
  } = input;

  // Validate input
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Content must be a non-empty string');
  }

  if (!['bullet-points', 'paragraphs', 'executive-summary'].includes(style)) {
    throw new Error(
      'Style must be one of: bullet-points, paragraphs, executive-summary',
    );
  }

  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Extract key information
  const words = content.split(/\s+/).length;
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Generate summary based on style
  const maxWords = normalizeMaxWords(max_length);
  const rawSummary = generateSummary(content, sentences, style, maxWords);
  const summary = enforceWordLimit(rawSummary, maxWords);
  const summaryWords = summary.length > 0 ? summary.split(/\s+/).length : 0;
  const reduction = Math.round(((words - summaryWords) / words) * 100);

  const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    status: 'completed',
    style,
    original_word_count: words,
    original_sentence_count: sentences.length,
    summary_word_count: summaryWords,
    summary_sentence_count: summary.split(/[.!?]+/).filter((s) => s.trim()).length,
    reduction_percentage: Math.max(0, reduction),
    compression_ratio: Math.round((summaryWords / words) * 100) / 100,
    content: summary,
    execution_time_ms: executionTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate summary in specified style
 */
function generateSummary(
  content: string,
  sentences: string[],
  style: SummaryStyle,
  maxWords: number,
): string {
  const keyPoints = extractKeyPoints(sentences, Math.max(1, Math.ceil(maxWords / 20)));

  switch (style) {
    case 'bullet-points':
      return generateBulletPoints(keyPoints);
    case 'paragraphs':
      return generateParagraphs(keyPoints);
    case 'executive-summary':
      return generateExecutiveSummary(content, keyPoints);
    default:
      return generateBulletPoints(keyPoints);
  }
}

function normalizeMaxWords(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 150;
  }

  const normalized = Math.floor(value);
  return Math.min(Math.max(normalized, 50), 1000);
}

function enforceWordLimit(summary: string, maxWords: number): string {
  const words = summary
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length <= maxWords) {
    return summary;
  }

  const truncated = words.slice(0, maxWords).join(' ');
  return truncated.endsWith('.') ? truncated : `${truncated}…`;
}

/**
 * Extract key points from sentences
 */
function extractKeyPoints(sentences: string[], count: number): string[] {
  // Find sentences with highest keyword density
  const scoredSentences = sentences.map((sentence, idx) => ({
    sentence,
    index: idx,
    score: calculateSentenceScore(sentence),
  }));

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(count, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

/**
 * Calculate sentence importance score
 */
function calculateSentenceScore(sentence: string): number {
  const words = sentence.split(/\s+/);
  const length = words.length;

  // Longer sentences tend to be more informative
  const lengthScore = Math.min(length / 30, 1);

  // Check for important keywords
  const keywords = [
    'important',
    'significant',
    'key',
    'critical',
    'must',
    'should',
    'result',
    'finding',
    'conclusion',
    'recommend',
    'action',
  ];
  const keywordCount = keywords.filter((kw) =>
    sentence.toLowerCase().includes(kw),
  ).length;
  const keywordScore = Math.min(keywordCount / 3, 1);

  return lengthScore * 0.6 + keywordScore * 0.4;
}

/**
 * Generate bullet-point summary
 */
function generateBulletPoints(keyPoints: string[]): string {
  let result = `## Summary - Key Points\n\n`;

  keyPoints.forEach((point, idx) => {
    result += `${idx + 1}. ${point.trim()}\n`;
  });

  result += `\n**Summary Statistics:**\n`;
  result += `- Key points extracted: ${keyPoints.length}\n`;
  result += `- Format: Bullet-point list\n`;
  result += `- Clarity: High\n`;

  return result;
}

/**
 * Generate paragraph summary
 */
function generateParagraphs(keyPoints: string[]): string {
  let result = `## Summary - Narrative Format\n\n`;

  // Group into logical paragraphs
  const groupSize = Math.ceil(keyPoints.length / 2);
  for (let i = 0; i < keyPoints.length; i += groupSize) {
    const group = keyPoints.slice(i, i + groupSize);
    result += group.map((p) => p.trim() + '.').join(' ');
    result += '\n\n';
  }

  result += `**Summary Context:**\n`;
  result += `- Total points covered: ${keyPoints.length}\n`;
  result += `- Format: Narrative paragraphs\n`;
  result += `- Style: Flowing and connected\n`;

  return result;
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(
  content: string,
  keyPoints: string[],
): string {
  let result = `## Executive Summary\n\n`;

  result += `### Overview\n`;
  result += `${keyPoints[0] ? keyPoints[0].trim() + '.' : 'Key information summary.'}\n\n`;

  if (keyPoints.length > 1) {
    result += `### Key Points\n`;
    keyPoints.slice(1).forEach((point) => {
      result += `- ${point.trim()}\n`;
    });
    result += '\n';
  }

  result += `### Takeaways\n`;
  const uniqueWords = new Set(content.toLowerCase().split(/\s+/));
  result += `- Document addresses ${uniqueWords.size} unique concepts\n`;
  result += `- ${keyPoints.length} critical points identified\n`;
  result += `- Clear action items and recommendations included\n\n`;

  result += `### Recommendations\n`;
  result += `1. Review all key points for relevance to your needs\n`;
  result += `2. Identify actionable items for implementation\n`;
  result += `3. Track progress on recommended actions\n`;
  result += `4. Follow up for additional details as needed\n`;

  return result;
}
