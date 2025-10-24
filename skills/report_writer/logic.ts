/**
 * Report Writer Skill Logic
 * Generates professional, well-structured reports
 */

type ReportStyle = 'technical' | 'business' | 'academic';

interface ReportWriterInput {
  title: string;
  content: string;
  style?: ReportStyle;
  include_toc?: boolean;
  include_appendix?: boolean;
}

interface ReportWriterOutput {
  status: 'completed';
  title: string;
  style: ReportStyle;
  include_toc: boolean;
  include_appendix: boolean;
  content_sections: number;
  word_count: number;
  character_count: number;
  format: 'markdown';
  report: string;
  metadata: {
    generated_at: string;
    author: string;
    version: string;
  };
  execution_time_ms: number;
}

/**
 * Generate a professional report
 */
export default async function reportWriter(
  input: ReportWriterInput,
): Promise<ReportWriterOutput> {
  const startTime = performance.now();
  const {
    title,
    content,
    style = 'business',
    include_toc = true,
    include_appendix = true,
  } = input;

  // Validate input
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Title must be a non-empty string');
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Content must be a non-empty string');
  }

  if (!['technical', 'business', 'academic'].includes(style)) {
    throw new Error(
      'Style must be one of: technical, business, academic',
    );
  }

  // Simulate report generation
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Generate the report
  const report = generateReport(
    title,
    content,
    style,
    include_toc,
    include_appendix,
  );

  const executionTime = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    status: 'completed',
    title,
    style,
    include_toc,
    include_appendix,
    content_sections: countSections(report),
    word_count: report.split(/\s+/).length,
    character_count: report.length,
    format: 'markdown',
    report,
    metadata: {
      generated_at: new Date().toISOString(),
      author: 'Report Writer Skill',
      version: '1.0',
    },
    execution_time_ms: executionTime,
  };
}

/**
 * Generate the full report
 */
function generateReport(
  title: string,
  content: string,
  style: ReportStyle,
  includeToc: boolean,
  includeAppendix: boolean,
): string {
  let report = '';

  // Add title page
  report += generateTitlePage(title, style);

  // Add table of contents
  if (includeToc) {
    report += '\n' + generateTableOfContents(style);
  }

  // Add main sections
  report += '\n' + generateMainSections(content, style);

  // Add appendix if requested
  if (includeAppendix) {
    report += '\n' + generateAppendix(style);
  }

  return report;
}

/**
 * Generate title page
 */
function generateTitlePage(title: string, style: string): string {
  const reportType =
    style === 'academic'
      ? 'Academic Report'
      : style === 'technical'
        ? 'Technical Report'
        : 'Business Report';

  return `
# ${title}

**Report Type:** ${reportType}  
**Generated:** ${new Date().toLocaleDateString()}  
**Status:** Final  

---
`.trim();
}

/**
 * Generate table of contents
 */
function generateTableOfContents(style: ReportStyle): string {
  const sections = getReportSections(style);

  let toc = '## Table of Contents\n\n';
  sections.forEach((section, idx) => {
    toc += `${idx + 1}. ${section}\n`;
  });

  return toc;
}

/**
 * Get section structure for style
 */
function getReportSections(style: ReportStyle): string[] {
  if (style === 'academic') {
    return [
      'Introduction',
      'Literature Review',
      'Methodology',
      'Results',
      'Discussion',
      'Conclusion',
      'References',
      'Appendices',
    ];
  }

  if (style === 'technical') {
    return [
      'Executive Summary',
      'Overview',
      'Technical Details',
      'Architecture',
      'Implementation',
      'Performance Metrics',
      'Results',
      'Conclusion',
    ];
  }

  // Business style
  return [
    'Executive Summary',
    'Background',
    'Key Findings',
    'Analysis',
    'Recommendations',
    'Implementation Plan',
    'Success Metrics',
  ];
}

/**
 * Generate main sections
 */
function generateMainSections(content: string, style: ReportStyle): string {
  let sections = '';

  if (style === 'academic') {
    sections = `
## 1. Introduction

This report presents research findings and analysis on the subject matter. The introduction provides context for understanding the significance and scope of the work.

## 2. Literature Review

Comprehensive review of prior work and research in this domain:
- Foundational concepts and theories
- Recent developments and trends
- Research gaps and opportunities

## 3. Methodology

The research employed the following approach:
- Research design and approach
- Data collection methods
- Analysis techniques and tools
- Quality assurance measures

## 4. Results

Key findings and results:

${content}

## 5. Discussion

Interpretation and analysis of results:
- Implications of findings
- Alignment with literature
- Unexpected outcomes
- Limitations and considerations

## 6. Conclusion

Summary of research findings and their significance:
- Main conclusions
- Contribution to field
- Future research directions

## 7. References

- Academic journals and publications
- Industry research reports
- Foundational texts and monographs
    `.trim();
  } else if (style === 'technical') {
    sections = `
## 1. Executive Summary

High-level overview of technical findings and recommendations for technical stakeholders.

## 2. Overview

System and project scope:
- Project objectives
- Scope and boundaries
- Stakeholders and users

## 3. Technical Details

Detailed technical information:
- System components
- Technologies used
- Integration points
- Data flows

## 4. Architecture

System architecture and design:
- High-level design
- Component interactions
- Database design
- Security considerations

## 5. Implementation

Implementation details:
- Development approach
- Code structure
- Deployment strategy
- Testing methodology

## 6. Performance Metrics

Key performance indicators:
- Response time: < 100ms
- Throughput: > 1000 ops/sec
- Availability: 99.9%
- Error rate: < 0.1%

## 7. Results

${content}

## 8. Conclusion

Technical conclusions and recommendations for next steps.
    `.trim();
  } else {
    // Business style
    sections = `
## 1. Executive Summary

This report provides key findings and strategic recommendations for business stakeholders. The summary includes actionable insights and recommended next steps.

## 2. Background

Business context and situation analysis:
- Market overview
- Current challenges
- Strategic objectives
- Competitive landscape

## 3. Key Findings

Main discoveries and observations:

${content}

## 4. Analysis

Detailed analysis of findings:
- Trend analysis
- Impact assessment
- Risk evaluation
- Opportunity identification

## 5. Recommendations

Strategic recommendations for action:
- **Short-term:** Immediate actions (0-3 months)
- **Medium-term:** Strategic initiatives (3-12 months)
- **Long-term:** Transformational changes (1-3 years)

## 6. Implementation Plan

Roadmap for implementation:
1. Priority 1: Critical initiatives
2. Priority 2: Important initiatives
3. Priority 3: Enhancement initiatives

**Timeline:** Q1 2025 - Q4 2025  
**Resources:** TBD based on prioritization  
**Success Criteria:** Defined KPIs and metrics

## 7. Success Metrics

How to measure success:
- Quantitative metrics
- Qualitative indicators
- Milestone checkpoints
- Review frequency
    `.trim();
  }

  return sections;
}

/**
 * Generate appendix
 */
function generateAppendix(style: ReportStyle): string {
  const appendixIntro =
    style === 'academic'
      ? 'Supplementary academic materials and extended references.'
      : style === 'technical'
        ? 'Technical supplements, configuration details, and logs.'
        : 'Supporting business documentation and additional resources.';

  const appendix = `
## Appendices

### A. Glossary

**Key Terms and Definitions**
- Term 1: Definition and context
- Term 2: Definition and context
- Term 3: Definition and context

### B. Supporting Data

Additional data and statistics supporting the main findings.

### C. Detailed Specifications

Detailed technical or business specifications for reference.

### D. Additional Resources

Links and references to additional resources:
- Documentation
- Tools and templates
- Contact information
- Further reading
    
### Contextual Notes

${appendixIntro}
`.trim();

  return appendix;
}

/**
 * Count sections in report
 */
function countSections(report: string): number {
  const matches = report.match(/^## /gm);
  return matches ? matches.length : 0;
}
