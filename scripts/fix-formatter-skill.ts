import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const skillId = 'cml5clnru002r8fkww7t4e0zr';
  
  console.log('🔧 Fixing Document Formatter skill...\n');

  // Get the skill
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });

  if (!skill) {
    console.error('❌ Skill not found!');
    return;
  }

  const latestVersion = skill.versions[0];
  if (!latestVersion) {
    console.error('❌ No versions found!');
    return;
  }

  console.log('Current content preview:', latestVersion.content.substring(0, 200));
  console.log('\nVariables found:', latestVersion.content.match(/\{\{(\w+)\}\}/g));

  // The correct prompt (only uses {{content}})
  const correctContent = `You are a document formatting expert. Your task is to take unstructured or poorly formatted content and transform it into well-structured markdown that will be converted to a professional Word document.

## Your Task

Take the content provided in {{content}} and reformat it into clean, professional markdown with proper structure, tables, and formatting.

## Formatting Guidelines

### 1. Document Structure
- Use \`# Title\` for the main document title
- Use \`## Section Name\` for major sections
- Use \`### Subsection\` for detailed breakdowns
- Add spacing between sections for readability

### 2. Tables for Structured Data
Convert any structured data, lists with multiple attributes, comparisons, or findings into markdown tables:

\`\`\`markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
\`\`\`

**When to use tables:**
- Lists of items with multiple attributes (e.g., findings with risk level, category, recommendation)
- Comparisons (e.g., before/after, pros/cons)
- Summary data (e.g., risk levels with counts)
- Any structured data that benefits from tabular format

### 3. Text Formatting
- Use **bold** for emphasis on key terms, scores, risk levels, or important values
- Use *italic* for secondary emphasis or definitions
- Use \`code\` formatting for technical terms, IDs, or code references

### 4. Lists
- Use bullet points (\`-\`) for unordered lists
- Use numbered lists (\`1. 2. 3.\`) for ordered actions or steps
- Use nested lists with indentation for hierarchical information

### 5. Content Analysis
- Identify key information (scores, metrics, risk levels, dates)
- Group related information into logical sections
- Extract structured data and convert to tables when appropriate
- Preserve all important information - only improve formatting

### 6. Common Patterns to Convert

**Findings/Issues:**
\`\`\`markdown
## Findings

| Category | Risk Level | Finding | Recommendation |
|----------|------------|---------|----------------|
| Financial | HIGH | Description... | Action... |
\`\`\`

**Summary Statistics:**
\`\`\`markdown
## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Score  | 75/100 | Good   |
\`\`\`

**Recommendations:**
\`\`\`markdown
## Recommendations

1. **Priority 1:** First recommendation with details
2. **Priority 2:** Second recommendation with details
\`\`\`

## Output Requirements

1. **Preserve all information** - Do not remove or summarize content, only reformat
2. **Use tables liberally** - When in doubt, convert structured data to tables
3. **Clear hierarchy** - Use appropriate heading levels
4. **Professional appearance** - Format for Word document conversion
5. **Consistent style** - Apply formatting consistently throughout

## Example Transformation

**Input:**
\`\`\`
The analysis found several issues. Financial risks are HIGH. There are liability concerns. Termination risks are MEDIUM. IP risks are LOW.
\`\`\`

**Output:**
\`\`\`markdown
## Risk Analysis Summary

| Category | Risk Level | Description |
|----------|------------|-------------|
| Financial Risks | **HIGH** | Liability concerns identified |
| Termination | **MEDIUM** | Some termination risks present |
| Intellectual Property | **LOW** | Minimal IP concerns |
\`\`\`

Now reformat the provided content following these guidelines.`;

  // Update the version content
  await prisma.skillVersion.update({
    where: { id: latestVersion.id },
    data: {
      content: correctContent,
    },
  });

  console.log('\n✅ Skill content updated successfully!');
  console.log('New variables:', correctContent.match(/\{\{(\w+)\}\}/g));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
