/**
 * Shared LLM provider — unified interface for OpenAI, OpenRouter, and Gemini.
 * Implements automatic multi-provider fallback: if the primary provider fails
 * (rate-limit, quota, network), the system tries the remaining providers in
 * sequence before giving up. This ensures maximum uptime when free-tier quotas
 * are exhausted on one platform but available on another.
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

/** Returns the preferred provider (first to try) */
function getProvider(): Provider {
  const p = process.env.AI_PROVIDER || 'openai';
  if (p === 'gemini' || p === 'openrouter') return p;
  return 'openai';
}

/** Returns the ordered fallback chain starting with the preferred provider */
function getFallbackChain(): Provider[] {
  const primary = getProvider();
  const all: Provider[] = ['openai', 'openrouter', 'gemini'];
  return [primary, ...all.filter((p) => p !== primary)];
}

/** Check if an error is retryable (rate-limit / quota / transient) */
function isRetryableError(err: any): boolean {
  const msg = String(err?.message || '');
  return /429|402|quota|rate.?limit|insufficient.?credits|RESOURCE_EXHAUSTED/i.test(msg);
}

/**
 * Call the configured LLM provider with a list of messages.
 * Implements automatic fallback: tries primary provider first, then falls back
 * to remaining providers if the error is retryable (429/402/quota).
 */
export async function callLLM(messages: LLMMessage[], opts: LLMOptions = {}): Promise<LLMResult> {
  const { temperature = 0.7, maxTokens = 500, timeout = 30_000 } = opts;
  const chain = getFallbackChain();
  const errors: string[] = [];

  for (const provider of chain) {
    try {
      if (provider === 'gemini') {
        return await callGemini(messages, { temperature, maxTokens, timeout });
      }
      return await callOpenAICompatible(messages, { temperature, maxTokens, timeout, provider });
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown error';
      errors.push(`[${provider}] ${errMsg}`);
      console.warn(`[ai-provider] ${provider} failed: ${errMsg.slice(0, 120)}`);

      // Only fallback on retryable errors; hard errors (bad request, auth) stop the chain
      if (!isRetryableError(err)) {
        throw err;
      }
    }
  }

  // All providers exhausted
  throw new Error(`All AI providers exhausted. Errors: ${errors.join(' | ')}`);
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

  if (!apiKey) throw new Error(`${provider.toUpperCase()}_API_KEY not configured — quota/rate-limit`);

  const baseUrl = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');

  const model = provider === 'openrouter'
    ? (process.env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free')
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
    throw new Error(`AI provider error (${provider}): ${res.status} — ${body.slice(0, 300)}`);
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
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured — quota/rate-limit');

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
    throw new Error(`Gemini error: ${res.status} — ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return { content, provider: 'gemini', model };
}
