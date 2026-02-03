import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

const MODEL_MAP: Record<string, string> = {
  'gpt-4': 'gpt-4-turbo-preview',
  'gpt-4-turbo': 'gpt-4-turbo-preview',
  'gpt-4o': 'gpt-4o', // Best for contract analysis - structured outputs and accuracy
  'gpt-3.5': 'gpt-3.5-turbo',
};

export function chatWithOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<ChatResponse> {
  const client = new OpenAI({ apiKey });
  // Default to GPT-4o for better contract analysis (structured outputs, accuracy)
  const model = MODEL_MAP[options.model || 'gpt-4o'] || options.model || 'gpt-4o';

  return client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  }).then((response) => {
    const choice = response.choices[0];
    return {
      content: choice.message.content || '',
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  });
}

export async function chatWithAnthropic(
  apiKey: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<ChatResponse> {
  const client = new Anthropic({ apiKey });
  const model = options.model || 'claude-sonnet-4-5';

  const systemMessage = messages.find((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    system: systemMessage?.content,
    messages: chatMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const content = response.content[0];
  const textContent = content.type === 'text' ? content.text : '';

  return {
    content: textContent,
    model: response.model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
