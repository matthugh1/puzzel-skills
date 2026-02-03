import { documentExtractionService } from './document-extraction.service';
import { skillsIntegrationService } from './skills-integration.service';
import { complianceDocumentRepository } from '@/repositories/compliance-document.repository';
import { complianceAnalysisRepository } from '@/repositories/compliance-analysis.repository';
import type { ComplianceStatus } from '@prisma/client';
import { llmService } from './llm.service';
import type { ChatMessage } from '@/lib/ai-client';

export interface ComplianceAnalysisResult {
  score: number; // 0-100
  status: ComplianceStatus;
  findings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    category: string;
    description: string;
    location?: string;
  }>;
  violations: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    rule: string;
    description: string;
    location?: string;
  }>;
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    description: string;
  }>;
}

export interface AnalysisProgress {
  type: 'status' | 'skill' | 'model' | 'thinking' | 'extracting' | 'analyzing' | 'parsing';
  message: string;
  skillName?: string;
  model?: string;
  progress?: number; // 0-100
}

/**
 * Compliance Analysis Service
 * Analyzes documents for compliance using skills and LLM
 */
class ComplianceAnalysisService {
  /**
   * Analyze a document for compliance
   */
  async analyzeDocument(
    documentId: string,
    userId: string,
    provider: 'openai' | 'anthropic' = 'openai'
  ): Promise<ComplianceAnalysisResult> {
    // Get document
    const document = await complianceDocumentRepository.findById(
      documentId,
      userId
    );

    if (!document) {
      throw new Error('Document not found or access denied');
    }

    if (document.status === 'PROCESSING') {
      throw new Error('Document is already being processed');
    }

    // Update status to PROCESSING
    await complianceDocumentRepository.update(documentId, userId, {
      status: 'PROCESSING',
    });

    try {
      // Extract text from document
      const documentText = await documentExtractionService.extractText(
        document.filePath,
        document.mimeType
      );

      if (!documentText || documentText.trim().length === 0) {
        throw new Error('Failed to extract text from document');
      }

      // Get skill content
      const { content: skillContent, skillName } =
        await skillsIntegrationService.getSkillContent(document.skillId, userId);

      // Build LLM prompt
      const prompt = this.buildAnalysisPrompt(skillContent, documentText);

      // Call LLM for analysis
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are a compliance analyst. Analyze documents against compliance requirements and return structured JSON responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const llmResponse = await llmService.chat(messages, {
        model: provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5', // GPT-4o for OpenAI, Claude Sonnet 4.5 for Anthropic
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 8000, // Increased for longer responses, especially for complex documents
      }, provider);

      // Parse LLM response
      const analysisResult = this.parseAnalysisResponse(llmResponse.content);

      // Calculate compliance status
      const status = this.calculateComplianceStatus(analysisResult.score);

      // Store analysis results
      await complianceAnalysisRepository.create({
        documentId,
        userId,
        skillId: document.skillId,
        score: analysisResult.score,
        status,
        findings: analysisResult.findings,
        violations: analysisResult.violations,
        recommendations: analysisResult.recommendations,
        rawResponse: {
          content: llmResponse.content,
          model: llmResponse.model,
        },
        completedAt: new Date(),
      });

      // Update document status to COMPLETED
      await complianceDocumentRepository.update(documentId, userId, {
        status: 'COMPLETED',
      });

      return analysisResult;
    } catch (error: any) {
      // Update document status to FAILED
      await complianceDocumentRepository.update(documentId, userId, {
        status: 'FAILED',
      });

      throw error;
    }
  }

  /**
   * Analyze a document for compliance with progress callbacks
   */
  async analyzeDocumentWithProgress(
    documentId: string,
    userId: string,
    onProgress: (progress: AnalysisProgress) => void,
    provider: 'openai' | 'anthropic' = 'openai'
  ): Promise<ComplianceAnalysisResult> {
    // Get document
    onProgress({
      type: 'status',
      message: 'Loading document...',
      progress: 5,
    });

    const document = await complianceDocumentRepository.findById(
      documentId,
      userId
    );

    if (!document) {
      throw new Error('Document not found or access denied');
    }

    if (document.status === 'PROCESSING') {
      throw new Error('Document is already being processed');
    }

    // Update status to PROCESSING
    await complianceDocumentRepository.update(documentId, userId, {
      status: 'PROCESSING',
    });

    try {
      // Extract text from document
      onProgress({
        type: 'extracting',
        message: 'Extracting text from document...',
        progress: 15,
      });

      const documentText = await documentExtractionService.extractText(
        document.filePath,
        document.mimeType
      );

      if (!documentText || documentText.trim().length === 0) {
        throw new Error('Failed to extract text from document');
      }

      // Get skill content
      onProgress({
        type: 'skill',
        message: 'Loading analysis skill...',
        skillName: 'Loading...',
        progress: 25,
      });

      const { content: skillContent, skillName } =
        await skillsIntegrationService.getSkillContent(document.skillId, userId);

      onProgress({
        type: 'skill',
        message: `Using skill: ${skillName}`,
        skillName,
        progress: 30,
      });

      // Build LLM prompt
      onProgress({
        type: 'analyzing',
        message: 'Preparing analysis...',
        progress: 35,
      });

      const prompt = this.buildAnalysisPrompt(skillContent, documentText);

      // Call LLM for analysis
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are a compliance analyst. Analyze documents against compliance requirements and return structured JSON responses.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const model = provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5';
      onProgress({
        type: 'model',
        message: `Analyzing with ${model} (${provider === 'openai' ? 'OpenAI' : 'Anthropic'})...`,
        model,
        progress: 40,
      });

      onProgress({
        type: 'thinking',
        message: 'AI is analyzing the contract for red flags and compliance issues...',
        progress: 45,
      });

      const llmResponse = await llmService.chat(messages, {
        model,
        temperature: 0.3,
        maxTokens: 8000, // Increased for longer responses, especially for complex documents
      }, provider);

      onProgress({
        type: 'parsing',
        message: 'Parsing analysis results...',
        progress: 85,
      });

      // Parse LLM response
      const analysisResult = this.parseAnalysisResponse(llmResponse.content);

      // Calculate compliance status
      const status = this.calculateComplianceStatus(analysisResult.score);

      onProgress({
        type: 'status',
        message: 'Saving results...',
        progress: 90,
      });

      // Store analysis results
      await complianceAnalysisRepository.create({
        documentId,
        userId,
        skillId: document.skillId,
        score: analysisResult.score,
        status,
        findings: analysisResult.findings,
        violations: analysisResult.violations,
        recommendations: analysisResult.recommendations,
        rawResponse: {
          content: llmResponse.content,
          model: llmResponse.model,
        },
        completedAt: new Date(),
      });

      // Update document status to COMPLETED
      await complianceDocumentRepository.update(documentId, userId, {
        status: 'COMPLETED',
      });

      onProgress({
        type: 'status',
        message: 'Analysis complete!',
        progress: 100,
      });

      return analysisResult;
    } catch (error: any) {
      // Update document status to FAILED
      await complianceDocumentRepository.update(documentId, userId, {
        status: 'FAILED',
      });

      throw error;
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(
    skillContent: string,
    documentText: string
  ): string {
    return `You are a compliance analyst. Analyze the following document against these compliance requirements:

## Compliance Requirements (Skill Content):
${skillContent}

## Document to Analyze:
${documentText.substring(0, 50000)}${documentText.length > 50000 ? '\n\n[... document truncated for length ...]' : ''}

## Instructions:
Analyze the document against the compliance requirements above. Return a JSON response with the following structure:

{
  "score": <number 0-100>,
  "status": "<PASS|FAIL|PARTIAL>",
  "findings": [
    {
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW|INFO>",
      "category": "<category name>",
      "description": "<finding description>",
      "location": "<optional location reference>"
    }
  ],
  "violations": [
    {
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW|INFO>",
      "rule": "<specific rule violated>",
      "description": "<violation description>",
      "location": "<optional location reference>"
    }
  ],
  "recommendations": [
    {
      "priority": "<HIGH|MEDIUM|LOW>",
      "action": "<recommended action>",
      "description": "<recommendation description>"
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Return ONLY raw JSON - no markdown code blocks (no \`\`\`json), no explanations, no text before or after
2. The JSON must have this EXACT structure with these top-level fields:
   - "score" (number 0-100) - MUST be at top level, not nested
   - "status" (string: "PASS", "FAIL", or "PARTIAL") - MUST be at top level, not nested
   - "findings" (array) - MUST be at top level
   - "violations" (array) - MUST be at top level  
   - "recommendations" (array) - MUST be at top level
3. Do NOT nest score/status inside a "summary" or "document" object - they must be at the root level
4. Ensure the JSON is complete - all arrays and objects must be properly closed
5. If you have many findings/violations/recommendations, prioritize the most important ones to stay within token limits
6. The response must be valid, parseable JSON that starts with { and ends with }
7. Do not include any text outside the JSON object

Example of correct structure:
{
  "score": 75,
  "status": "PARTIAL",
  "findings": [...],
  "violations": [...],
  "recommendations": [...]
}`;
  }

  /**
   * Parse LLM response into structured analysis result
   * Handles markdown code blocks, truncated responses, and various JSON formats
   */
  private parseAnalysisResponse(
    llmContent: string
  ): ComplianceAnalysisResult {
    try {
      // Extract JSON from response (handle markdown code blocks and incomplete responses)
      let jsonText = llmContent.trim();
      
      // Remove markdown code blocks - handle both complete and truncated cases
      if (jsonText.includes('```json')) {
        // Try to extract JSON from markdown code block
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)(?:```|$)/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim();
        } else {
          // Handle case where closing ``` is missing (truncated response)
          jsonText = jsonText.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        }
      } else if (jsonText.startsWith('```')) {
        // Handle generic code blocks without language specified
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      }
      
      // Remove any leading/trailing whitespace or text before first {
      const firstBrace = jsonText.indexOf('{');
      if (firstBrace === -1) {
        throw new Error('No JSON object found in response. Response starts with: ' + jsonText.substring(0, 100));
      }
      
      jsonText = jsonText.substring(firstBrace);
      
      // Try to find the last complete closing brace by counting braces
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      let lastCompleteBrace = -1;
      
      for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            if (braceCount === 0 && bracketCount === 0) {
              lastCompleteBrace = i;
              break; // Found complete JSON object
            }
          }
          if (char === '[') bracketCount++;
          if (char === ']') bracketCount--;
        }
      }
      
      // If we found a complete JSON object, use it
      if (lastCompleteBrace !== -1) {
        jsonText = jsonText.substring(0, lastCompleteBrace + 1);
      } else {
        // Response might be truncated - try to close incomplete structures
        console.warn('Response appears truncated, attempting to fix JSON');
        
        // Count remaining open structures
        const remainingBraces = braceCount;
        const remainingBrackets = bracketCount;
        
        // Close incomplete arrays first, then objects
        let fixedJson = jsonText;
        
        // Remove any incomplete string at the end
        if (inString) {
          // Find the last complete string or remove incomplete one
          const lastQuote = fixedJson.lastIndexOf('"');
          if (lastQuote > 0 && fixedJson[lastQuote - 1] !== '\\') {
            // String might be complete, but check if we're in the middle of a value
            // For safety, just close it
            fixedJson = fixedJson.substring(0, lastQuote + 1);
          }
        }
        
        // Close incomplete arrays
        for (let i = 0; i < remainingBrackets; i++) {
          fixedJson += ']';
        }
        
        // Close incomplete objects
        for (let i = 0; i < remainingBraces; i++) {
          fixedJson += '}';
        }
        
        jsonText = fixedJson;
      }

      const parsed = JSON.parse(jsonText);

      // Validate and normalize
      return {
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        status: this.normalizeStatus(parsed.status),
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        violations: Array.isArray(parsed.violations) ? parsed.violations : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : [],
      };
    } catch (error) {
      // Log the full response for debugging
      console.error('Failed to parse LLM response:', error);
      console.error('Full response length:', llmContent.length);
      console.error('Response (first 2000 chars):', llmContent.substring(0, 2000));
      console.error('Response (last 500 chars):', llmContent.substring(Math.max(0, llmContent.length - 500)));
      
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}. Response length: ${llmContent.length} chars. Preview: ${llmContent.substring(0, 500)}...`
      );
    }
  }

  /**
   * Normalize compliance status
   */
  private normalizeStatus(status: string | undefined | null): ComplianceStatus {
    if (!status || typeof status !== 'string') {
      return 'PARTIAL'; // Default if status is missing
    }
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'PASS') return 'PASS';
    if (upperStatus === 'FAIL') return 'FAIL';
    return 'PARTIAL';
  }

  /**
   * Calculate compliance status from score
   */
  private calculateComplianceStatus(score: number): ComplianceStatus {
    if (score >= 90) return 'PASS';
    if (score < 60) return 'FAIL';
    return 'PARTIAL';
  }
}

export const complianceAnalysisService = new ComplianceAnalysisService();
