/**
 * Shared LLM provider — unified interface for OpenAI, OpenRouter, and Gemini.
 * Eliminates duplicated calling logic across API routes.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  /** Sampling temperature (0-1). Default: 0.7 */
  temperature?: number;
  /** Max output tokens. Default: 500 */
  maxTokens?: number;
  /** Request timeout in ms. Default: 30000 */
  timeout?: number;
}

export interface LLMResult {
  content: string;
  provider: string;
  model: string;
}

type Provider = 'openai' | 'openrouter' | 'gemini';

function getProvider(): Provider {
  const p = process.env.AI_PROVIDER || 'openai';
  if (p === 'gemini' || p === 'openrouter') return p;
  return 'openai';
}

/**
 * Call the configured LLM provider with a list of messages.
 * Supports openai, openrouter, and gemini via AI_PROVIDER env var.
 */
export async function callLLM(messages: LLMMessage[], opts: LLMOptions = {}): Promise<LLMResult> {
  const { temperature = 0.7, maxTokens = 500, timeout = 30_000 } = opts;
  const provider = getProvider();

  if (provider === 'gemini') {
    return callGemini(messages, { temperature, maxTokens, timeout });
  }
  return callOpenAICompatible(messages, { temperature, maxTokens, timeout, provider });
}

/**
 * Call LLM and parse JSON from the response.
 * Handles markdown code blocks and raw JSON.
 */
export async function callLLMJson<T = any>(messages: LLMMessage[], opts: LLMOptions = {}): Promise<T> {
  const result = await callLLM(messages, opts);
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM did not return valid JSON');
  return JSON.parse(jsonMatch[0]) as T;
}

// ── Internal implementations ─────────────────────────────

async function callOpenAICompatible(
  messages: LLMMessage[],
  opts: { temperature: number; maxTokens: number; timeout: number; provider: 'openai' | 'openrouter' }
): Promise<LLMResult> {
  const { temperature, maxTokens, timeout, provider } = opts;

  const apiKey = provider === 'openrouter'
    ? process.env.OPENROUTER_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY not configured`);

  const baseUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');

  const model = provider === 'openrouter'
    ? (process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct')
    : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI provider error (${provider}): ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  return { content, provider, model };
}

async function callGemini(
  messages: LLMMessage[],
  opts: { temperature: number; maxTokens: number; timeout: number }
): Promise<LLMResult> {
  const { temperature, maxTokens, timeout } = opts;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // Gemini uses contents[] + systemInstruction
  const systemMsg = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini error: ${res.status} — ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return { content, provider: 'gemini', model };
}
