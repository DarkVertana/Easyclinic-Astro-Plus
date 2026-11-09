/**
 * Thin wrapper over the Claude API. Two calls only: structured() returns validated JSON with no tools, and searchWeb()
 * returns URLs read from the search result blocks, never from the model's prose. Request shape and failure handling
 * are documented, with sources, in docs/research/admin-engine-edge-cases.md.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SourceCandidate, Usage } from './types.ts';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 64_000;
const INPUT_PER_TOKEN = 4 / 1e6;
const OUTPUT_PER_TOKEN = 20 / 1e6;
const PER_SEARCH = 10 / 1000;
const MAX_PAUSES = 5;
/** Shared by every request in one stage, so a 300 s Vercel function always has time left to save the job. */
export const STAGE_DEADLINE_MS = 240_000;
const FALLBACK_REQUEST = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

export class AiNotConfiguredError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set, so the writing engine cannot run. Add it to the environment.');
    this.name = 'AiNotConfiguredError';
  }
}

export type AiFailure = 'refusal' | 'max_tokens' | 'pause_limit' | 'invalid_output' | 'unexpected_stop' | 'search_failed' | 'rate_limited' | 'api' | 'deadline' | 'budget';

export class AiError extends Error {
  constructor(readonly kind: AiFailure, message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/** The part of the SDK client this module uses; tests supply a fake. */
export interface MessagesClient {
  beta: {
    messages: {
      stream(params: never, options?: { timeout?: number; signal?: AbortSignal }): { finalMessage(): Promise<ApiMessage> };
    };
  };
}

export interface ApiBlock {
  type: string;
  text?: string;
  content?: unknown;
}

export interface ApiMessage {
  content: ApiBlock[];
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null; server_tool_use?: { web_search_requests?: number } | null };
}

export type JsonSchema = Record<string, unknown>;

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, costUsd: 0, webSearches: 0 });

export function addUsage(into: Usage, more: Usage): void {
  into.inputTokens += more.inputTokens;
  into.outputTokens += more.outputTokens;
  into.costUsd = Math.round((into.costUsd + more.costUsd) * 1e6) / 1e6;
  into.webSearches = (into.webSearches ?? 0) + (more.webSearches ?? 0);
}

function usageOf(message: ApiMessage): Usage {
  const inputTokens = message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
  const outputTokens = message.usage.output_tokens;
  const webSearches = message.usage.server_tool_use?.web_search_requests ?? 0;
  return { inputTokens, outputTokens, webSearches, costUsd: inputTokens * INPUT_PER_TOKEN + outputTokens * OUTPUT_PER_TOKEN + webSearches * PER_SEARCH };
}

/** Checks a value against the subset of JSON Schema we send. A refused or cut-off response may not match the schema. */
export function validateSchema(value: unknown, schema: JsonSchema, path = '$'): string | null {
  const type = schema.type;
  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${path} is not an object`;
    const record = value as Record<string, unknown>;
    for (const key of (schema.required as string[]) ?? []) if (!(key in record)) return `${path}.${key} is missing`;
    const props = (schema.properties as Record<string, JsonSchema>) ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in record) {
        const err = validateSchema(record[key], sub, `${path}.${key}`);
        if (err) return err;
      }
    }
    return null;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return `${path} is not an array`;
    for (let i = 0; i < value.length; i++) {
      const err = validateSchema(value[i], schema.items as JsonSchema, `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }
  if (type === 'string') {
    if (typeof value !== 'string') return `${path} is not a string`;
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return `${path} is not an allowed value`;
    return null;
  }
  if (type === 'boolean') return typeof value === 'boolean' ? null : `${path} is not a boolean`;
  if (type === 'number' || type === 'integer') return typeof value === 'number' ? null : `${path} is not a number`;
  return null;
}

function translateError(err: unknown): unknown {
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate_limited', 'The Claude API is rate limiting us. Retry in a few minutes.');
  if (err instanceof Anthropic.AuthenticationError) return new AiNotConfiguredError();
  if (err instanceof Anthropic.APIError) return new AiError('api', `Claude API error ${err.status ?? ''}: ${err.message}`.slice(0, 300));
  return err;
}

export class ClaudeClient {
  readonly usage: Usage = emptyUsage();
  private readonly injected?: MessagesClient;
  private real?: MessagesClient;

  private readonly deadlineAt: number;
  private readonly maxUsd: number;
  private readonly onUsage?: (usage: Usage) => void;

  constructor(client?: MessagesClient, options: { deadlineMs?: number; maxUsd?: number; onUsage?: (usage: Usage) => void } = {}) {
    this.injected = client;
    this.deadlineAt = Date.now() + (options.deadlineMs ?? STAGE_DEADLINE_MS);
    this.maxUsd = options.maxUsd ?? Infinity;
    this.onUsage = options.onUsage;
  }

  private client(): MessagesClient {
    if (this.injected) return this.injected;
    if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError();
    this.real ??= new Anthropic({ maxRetries: 0 }) as unknown as MessagesClient;
    return this.real;
  }

  /** One logical turn: sends, keeps every paused response in order, and resumes with the same tools. */
  private async turn(params: Record<string, unknown>, firstUser: string): Promise<ApiMessage[]> {
    const client = this.client();
    const messages: Array<{ role: string; content: unknown }> = [{ role: 'user', content: firstUser }];
    const responses: ApiMessage[] = [];
    for (let attempt = 0; attempt <= MAX_PAUSES; attempt++) {
      if (this.usage.costUsd >= this.maxUsd) throw new AiError('budget', 'This step reached its spending limit, so it stopped. Nothing was published.');
      const remaining = this.deadlineAt - Date.now();
      const late = () => new AiError('deadline', 'This step ran out of time, so it stopped. Retry, or narrow the brief if it repeats.');
      if (remaining <= 0) throw late();
      // The SDK's timeout stops at the response headers; the signal also covers a stream that stalls afterwards.
      const signal = AbortSignal.timeout(remaining);
      let response: ApiMessage;
      try {
        response = await Promise.race([
          client.beta.messages.stream({ model: MODEL, max_tokens: MAX_TOKENS, ...FALLBACK_REQUEST, ...params, messages } as never, { timeout: remaining, signal }).finalMessage(),
          new Promise<never>((_, refuse) => signal.addEventListener('abort', () => refuse(late()), { once: true })),
        ]);
      } catch (err) {
        throw signal.aborted ? late() : translateError(err);
      }
      responses.push(response);
      addUsage(this.usage, usageOf(response));
      this.onUsage?.(this.usage);
      if (response.stop_reason !== 'pause_turn') return responses;
      messages.push({ role: 'assistant', content: response.content });
    }
    throw new AiError('pause_limit', `The model paused more than ${MAX_PAUSES} times in one turn`);
  }

  private assertCompleted(message: ApiMessage): void {
    const stop = message.stop_reason;
    if (stop === 'refusal') {
      const category = message.stop_details?.category;
      throw new AiError('refusal', `Claude declined this request${category ? ` (category: ${category})` : ''}, and so did the fallback model. Partial output was discarded. Reword the brief.`);
    }
    if (stop === 'max_tokens' || stop === 'model_context_window_exceeded') {
      throw new AiError('max_tokens', `The response was cut off (${stop}), so it was discarded. Retry; if it repeats the sources are too long.`);
    }
    if (stop !== 'end_turn' && stop !== 'stop_sequence') throw new AiError('unexpected_stop', `Unexpected stop reason: ${stop}`);
  }

  /** JSON matching `schema`. Sends no tools, so text from fetched pages has nothing to act through. */
  async structured<T>(args: { system: string; user: string; schema: JsonSchema }): Promise<T> {
    const responses = await this.turn(
      { system: args.system, output_config: { effort: 'high', format: { type: 'json_schema', schema: args.schema } } },
      args.user,
    );
    const last = responses[responses.length - 1];
    this.assertCompleted(last);
    const text = last.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiError('invalid_output', 'The model returned text that is not valid JSON');
    }
    const problem = validateSchema(parsed, args.schema);
    if (problem) throw new AiError('invalid_output', `The model's JSON does not fit the schema: ${problem}`);
    return parsed as T;
  }

  /**
   * Candidate URLs from the result blocks. Web search always carries citations, which cannot be combined with
   * structured output, so a separate structured() call does any judging. Direct calls keep results in these blocks.
   * A search error arrives as HTTP 200 with an error object in place of the list.
   */
  async searchWeb(args: { system: string; user: string; maxUses: number; blockedDomains: readonly string[] }): Promise<{ candidates: SourceCandidate[]; errors: string[] }> {
    const responses = await this.turn(
      {
        system: args.system,
        output_config: { effort: 'high' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: args.maxUses, blocked_domains: args.blockedDomains, allowed_callers: ['direct'] }],
      },
      args.user,
    );
    const seen = new Map<string, SourceCandidate>();
    const errors: string[] = [];
    for (const message of responses) {
      for (const block of message.content) {
        if (block.type !== 'web_search_tool_result') continue;
        if (Array.isArray(block.content)) {
          for (const r of block.content as Array<{ type?: string; url?: string; title?: string; page_age?: string | null }>) {
            if (r.type === 'web_search_result' && r.url && !seen.has(r.url)) seen.set(r.url, { url: r.url, title: r.title ?? '', pageAge: r.page_age ?? null });
          }
        } else {
          errors.push((block.content as { error_code?: string } | null)?.error_code ?? 'unknown');
        }
      }
    }
    const last = responses[responses.length - 1];
    if (last.stop_reason === 'refusal' || (seen.size === 0 && last.stop_reason !== 'end_turn')) this.assertCompleted(last);
    if (seen.size === 0 && errors.length > 0) throw new AiError('search_failed', `Web search failed: ${[...new Set(errors)].join(', ')}`);
    return { candidates: [...seen.values()], errors };
  }
}
