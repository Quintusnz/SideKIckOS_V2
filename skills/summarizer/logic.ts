/**
 * Summarizer Skill Logic
 * Summarizes text content into concise summaries
 */

export default async function summarizer(input: {
  content: string;
  style?: 'bullet-points' | 'paragraphs' | 'executive-summary';
  max_length?: number;
}) {
  const {
    content,
    style = 'bullet-points',
    max_length = 500,
  } = input;

  // Simulate text analysis
  const words = content.split(/\s+/).length;
  const reduction = Math.round(((words - max_length) / words) * 100);

  const summary = generateSummary(content, style, max_length);

  return {
    original_length_words: words,
    summary_length_words: summary.split(/\s+/).length,
    reduction_percentage: reduction,
    style,
    content: summary,
    execution_time_ms: Math.random() * 500 + 100,
  };
}

function generateSummary(
  content: string,
  style: string,
  maxLength: number
): string {
  // Extract first ~3 sentences as key points
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim());
  const keyPoints = sentences.slice(0, 3);

  switch (style) {
    case 'bullet-points':
      return generateBulletPoints(keyPoints, maxLength);
    case 'paragraphs':
      return generateParagraphs(keyPoints, maxLength);
    case 'executive-summary':
      return generateExecutiveSummary(keyPoints, maxLength);
    default:
      return generateBulletPoints(keyPoints, maxLength);
  }
}

function generateBulletPoints(
  keyPoints: string[],
  _maxLength: number
): string {
  return `
## Summary - Bullet Points

${keyPoints.map((point) => `- ${point.trim()}`).join('\n')}

**Original**: ${keyPoints.length} key points extracted and summarized.
  `.trim();
}

function generateParagraphs(
  keyPoints: string[],
  _maxLength: number
): string {
  return `
## Summary - Narrative

${keyPoints.map((point) => `${point.trim()}.`).join(' ')}

This summary captures the essential information from the original content in narrative form.
  `.trim();
}

function generateExecutiveSummary(
  keyPoints: string[],
  _maxLength: number
): string {
  return `
## Executive Summary

### Overview
${keyPoints[0] ? keyPoints[0].trim() : 'Key information summary'}.

### Key Points
${keyPoints.slice(1).map((point) => `- ${point.trim()}`).join('\n')}

### Conclusion
The material presents important findings and considerations for stakeholders.

---
*Executive summary generated automatically*
  `.trim();
}
