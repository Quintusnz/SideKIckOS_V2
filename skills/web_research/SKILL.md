---
name: Web Research
version: 1.0.0
description: Performs web-based research on any topic
category: research
tools:
  - web_search
  - summarization
input_schema:
  query:
    type: string
    description: Topic to research
  depth:
    type: string
    enum: [shallow, deep]
    default: shallow
output_format: markdown
estimated_tokens: 2000
author: SkillsFlow
tags:
  - research
  - web
  - information-gathering
---

# Web Research Skill

## Purpose
Conduct comprehensive internet-based research and gather relevant information about any topic.

## How It Works
1. Parse the user query to identify key search terms
2. Formulate targeted search queries
3. Search multiple sources (could use web APIs)
4. Aggregate and synthesize findings
5. Return structured markdown report

## Example Usage

### Shallow Search
```
Query: "Latest trends in renewable energy"
Expected Output: Brief overview (500-1000 words)
```

### Deep Search
```
Query: "Impact of AI on employment"
Expected Output: Comprehensive analysis (2000+ words) with citations
```

## Constraints
- Only whitelisted APIs allowed
- Maximum 3 search calls per invocation
- 30-second timeout limit
- Must cite sources

## Output Format
Returns markdown with:
- Executive summary
- Key findings (bullet points)
- Detailed analysis
- Source citations

## Success Criteria
✓ Relevant results found
✓ Multiple sources cited
✓ Well-organized markdown
✓ Information is current and accurate
