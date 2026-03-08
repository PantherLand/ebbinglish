import { z } from "zod";
import { buildTrancyCompatibleAudioUrls } from "@/src/pronunciation-sources";

// ─── Shared entry types (mirror DictionaryEntryData from the UI component) ───

export type AiDictExample = { en: string | null; zh: string | null };

export type AiDictSubsense = {
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: AiDictExample[];
};

export type AiDictSense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: AiDictExample[];
  subsenses: AiDictSubsense[];
};

export type AiDictPosBlock = {
  pos: string | null;
  labels: string[];
  senses: AiDictSense[];
};

export type AiDictIdiomSense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: AiDictExample[];
};

export type AiDictIdiom = {
  phrase: string;
  senses: AiDictIdiomSense[];
};

export type AiDictEntry = {
  headword: string;
  meaning: string | null;
  pos: string | null;
  pronunciations: string[];
  audioUrls: string[];
  posBlocks: AiDictPosBlock[];
  senses: AiDictSense[];
  idioms: AiDictIdiom[];
  fallbackText: string | null;
};

// ─── Zod schema for validating AI JSON output ────────────────────────────────

const exampleSchema = z.object({
  en: z.string().nullable().catch(null),
  zh: z.string().nullable().catch(null),
});

const subsenseSchema = z.object({
  labels: z.array(z.string()).catch([]),
  definitionEn: z.string().nullable().catch(null),
  definitionZh: z.string().nullable().catch(null),
  examples: z.array(exampleSchema).catch([]),
});

const senseSchema = z.object({
  num: z.string().nullable().catch(null),
  labels: z.array(z.string()).catch([]),
  definitionEn: z.string().nullable().catch(null),
  definitionZh: z.string().nullable().catch(null),
  examples: z.array(exampleSchema).catch([]),
  subsenses: z.array(subsenseSchema).catch([]),
});

const posBlockSchema = z.object({
  pos: z.string().nullable().catch(null),
  labels: z.array(z.string()).catch([]),
  senses: z.array(senseSchema).catch([]),
});

const idiomSenseSchema = z.object({
  num: z.string().nullable().catch(null),
  labels: z.array(z.string()).catch([]),
  definitionEn: z.string().nullable().catch(null),
  definitionZh: z.string().nullable().catch(null),
  examples: z.array(exampleSchema).catch([]),
});

const idiomSchema = z.object({
  phrase: z.string(),
  senses: z.array(idiomSenseSchema).catch([]),
});

const aiEntrySchema = z.object({
  headword: z.string(),
  meaning: z.string().nullable().optional().catch(null),
  pos: z.string().nullable().optional().catch(null),
  pronunciations: z.array(z.string()).catch([]),
  posBlocks: z.array(posBlockSchema).catch([]),
  idioms: z.array(idiomSchema).catch([]),
});

// ─── In-memory cache ─────────────────────────────────────────────────────────

const cache = new Map<string, { entry: AiDictEntry; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const OPENROUTER_TIMEOUT_MS = 20_000;
const OPENROUTER_DEFAULT_MODELS = [
  "deepseek/deepseek-chat",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
  "google/gemini-flash-1.5",
] as const;

function getCached(key: string): AiDictEntry | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.entry;
}

function setCached(key: string, entry: AiDictEntry): void {
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
  cache.set(key, { entry, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Config ───────────────────────────────────────────────────────────────────

export function isAiDictConfigured(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() || process.env.OPEN_ROUTER_API_KEY?.trim(),
  );
}

class OpenRouterHttpError extends Error {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    super(`OpenRouter request failed (${status}): ${details.slice(0, 200)}`);
    this.name = "OpenRouterHttpError";
    this.status = status;
    this.details = details;
  }
}

function shouldRetryWithNextModel(error: unknown): boolean {
  if (error instanceof OpenRouterHttpError) {
    if (error.status === 403 || error.status === 404 || error.status === 429) {
      return true;
    }
    return /(model.+not available|not available in your region|no endpoints found|provider.+unavailable)/i.test(
      error.details,
    );
  }

  if (error instanceof Error) {
    return /(model.+not available|not available in your region|no endpoints found|provider.+unavailable)/i.test(
      error.message,
    );
  }

  return false;
}

function extractJsonObject(text: string): unknown {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

// ─── Main lookup ──────────────────────────────────────────────────────────────

export async function lookupWordByAI(headword: string): Promise<AiDictEntry> {
  const word = headword.trim();
  if (!word) {
    return emptyEntry(word);
  }

  const cacheKey = word.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPEN_ROUTER_API_KEY?.trim() ||
    ""
  );
  if (!apiKey) return emptyEntry(word);

  const configuredModel =
    process.env.OPENROUTER_MODEL?.trim() || process.env.OPEN_ROUTER_MODEL?.trim() || "";
  const modelCandidates = [...new Set([configuredModel, ...OPENROUTER_DEFAULT_MODELS].filter(Boolean))];

  const systemPrompt =
    "You are a bilingual English-Chinese lexicographer. Return ONLY a JSON object — no markdown, no extra text.";

  const userPrompt = `Define the English word or phrase: "${word}"

Return a JSON object with exactly this structure:
{
  "headword": "canonical form",
  "meaning": "brief primary meaning in English (max 80 chars)",
  "pos": "primary part of speech",
  "pronunciations": ["/IPA/"],
  "posBlocks": [
    {
      "pos": "noun",
      "labels": [],
      "senses": [
        {
          "num": "1",
          "labels": [],
          "definitionEn": "definition in English",
          "definitionZh": "中文释义",
          "examples": [{ "en": "One example sentence.", "zh": "一个例句。" }],
          "subsenses": []
        }
      ]
    }
  ],
  "idioms": []
}

Rules:
- Include all major parts of speech in posBlocks (noun, verb, adjective, etc.)
- Each sense must have exactly 1 example with both English and Chinese
- definitionZh must be natural Chinese
- pronunciations uses standard IPA with forward slashes`;

  let rawText = "";
  let lastError: unknown = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];
    const hasNextCandidate = index < modelCandidates.length - 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ebbinglish.app",
          "X-Title": "Ebbinglish",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new OpenRouterHttpError(response.status, details);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (payload.error?.message) {
        throw new Error(`OpenRouter error: ${payload.error.message}`);
      }

      rawText = payload.choices?.[0]?.message?.content?.trim() ?? "";
      if (rawText) {
        break;
      }
      throw new Error("AI returned empty content");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error("AI lookup timed out");
      } else {
        lastError = error;
      }

      if (!hasNextCandidate || !shouldRetryWithNextModel(lastError)) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!rawText) throw new Error("AI returned empty content");

  const jsonObj = extractJsonObject(rawText);
  if (!jsonObj) throw new Error("AI did not return valid JSON");

  const parsed = aiEntrySchema.safeParse(jsonObj);
  if (!parsed.success) {
    throw new Error(`AI response does not match expected schema: ${parsed.error.message}`);
  }

  const data = parsed.data;

  // Derive a flat senses list from posBlocks for convenience
  const senses: AiDictSense[] = data.posBlocks.flatMap((block) =>
    block.senses.map((s) => ({ ...s, num: s.num ?? null })),
  );

  const entry: AiDictEntry = {
    headword: data.headword || word,
    meaning: data.meaning ?? null,
    pos: data.pos ?? null,
    pronunciations: data.pronunciations,
    audioUrls: buildTrancyCompatibleAudioUrls(data.headword || word),
    posBlocks: data.posBlocks,
    senses,
    idioms: data.idioms,
    fallbackText: null,
  };

  setCached(cacheKey, entry);
  return entry;
}

function emptyEntry(headword: string): AiDictEntry {
  return {
    headword,
    meaning: null,
    pos: null,
    pronunciations: [],
    audioUrls: buildTrancyCompatibleAudioUrls(headword),
    posBlocks: [],
    senses: [],
    idioms: [],
    fallbackText: null,
  };
}
