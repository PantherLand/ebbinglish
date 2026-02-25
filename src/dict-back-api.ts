export type DictSuggestItem = {
  headword: string;
  score: number;
};

type DictSuggestResponse = {
  data?: {
    items?: Array<{ headword?: string; score?: number }>;
  };
};

type DictEntryResponse = {
  data?: {
    dict_id?: string;
    headword?: string;
    content_type?: string;
    content?: unknown;
  };
};

type DictConfig = {
  baseUrl: string;
  dictId: string;
  apiKey?: string;
};

export type DictEntryExample = {
  en: string | null;
  zh: string | null;
};

export type DictEntrySubsense = {
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictEntryExample[];
};

export type DictEntrySense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictEntryExample[];
  subsenses: DictEntrySubsense[];
};

export type DictEntryPosBlock = {
  pos: string | null;
  labels: string[];
  senses: DictEntrySense[];
};

export type DictEntryIdiomSense = {
  num: string | null;
  labels: string[];
  definitionEn: string | null;
  definitionZh: string | null;
  examples: DictEntryExample[];
};

export type DictEntryIdiom = {
  phrase: string;
  senses: DictEntryIdiomSense[];
};

export type DictEntryDetail = {
  headword: string;
  meaning: string | null;
  pos: string | null;
  pronunciations: string[];
  /** Audio URLs (mp3/ogg) if available, primarily from dictionaryapi.dev phonetics[].audio */
  audioUrls: string[];
  posBlocks: DictEntryPosBlock[];
  senses: DictEntrySense[];
  idioms: DictEntryIdiom[];
  fallbackText: string | null;
  contentType: string;
};

const DEFAULT_DICT_ID = "oxford-1";
const FALLBACK_DICT_ID = "dictionaryapi-dev";
const REQUEST_TIMEOUT_MS = 8000;

// --- Structural limits (how many items to keep during parsing) ---
const DICT_ENTRIES_LIMIT = 4;      // max entries from dictionaryapi.dev
const POS_BLOCKS_LIMIT = 8;        // max POS blocks per entry
const SENSES_LIMIT = 12;           // max senses per POS block or entry
const LABELS_LIMIT = 6;            // max labels per sense/block
const EXAMPLES_LIMIT = 4;          // max examples per sense
const SUBSENSE_EXAMPLES_LIMIT = 3; // max examples per subsense
const SUBSENSES_LIMIT = 5;         // max subsenses per sense
const IDIOM_SENSES_LIMIT = 3;      // max senses per idiom
const IDIOMS_LIMIT = 8;            // max idioms per entry
const PRONUNCIATIONS_LIMIT = 4;    // max IPA strings
const AUDIO_URLS_LIMIT = 3;        // max audio URLs

// --- Text-length caps (characters) ---
const LEN_IPA = 80;
const LEN_EXAMPLE = 300;
const LEN_SUBSENSE_DEF = 320;
const LEN_SENSE_DEF = 360;
const LEN_MEANING = 500;
const LEN_PHRASE = 120;
const LEN_HEADWORD = 120;
const LEN_POS = 40;
const LEN_SENSE_NUM = 16;
const LEN_FALLBACK = 1200;

function normalizeDictId(dictId: string): string {
  return dictId.trim().toLowerCase();
}

function shouldUseFallbackDict(dictId: string): boolean {
  return normalizeDictId(dictId) === normalizeDictId(DEFAULT_DICT_ID);
}

function isLikelyNotFoundText(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  return /(not found|no entry|no match|no definitions found|不存在|未找到|找不到)/i.test(
    value,
  );
}

function isLikelyNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /((dict api (400|404|410|422))|entry_not_found|not found|no entry|no match|no definitions found|不存在|未找到|找不到)/i.test(
    error.message,
  );
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return true;
    }
  }

  if (error instanceof Error) {
    return /(aborted due to timeout|timeout|und_err_connect_timeout|aborterror|timeouterror)/i.test(
      error.message,
    );
  }

  return false;
}

function getConfig(): DictConfig | null {
  const service = process.env.DICT_BACK_API?.trim();

  if (!service) {
    return null;
  }

  const trimmed = service.replace(/\/+$/, "");
  const baseUrl = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;

  return {
    baseUrl,
    dictId: process.env.DICT_BACK_API_DICT_ID?.trim() || DEFAULT_DICT_ID,
    apiKey: process.env.DICT_BACK_API_KEY?.trim() || undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const out = value.trim();
  return out || null;
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSafeText(input: string | null, max: number = LEN_MEANING): string | null {
  if (!input) {
    return null;
  }

  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, max);
}

function parseExample(value: unknown): DictEntryExample | null {
  if (typeof value === "string") {
    const en = toSafeText(value, LEN_EXAMPLE);
    return en ? { en, zh: null } : null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const en =
    asString(record.en) || asString(record.example_en) || asString(record.example);
  const zh = asString(record.zh) || asString(record.example_zh);

  if (!en && !zh) {
    return null;
  }

  return {
    en: toSafeText(en, LEN_EXAMPLE),
    zh: toSafeText(zh, LEN_EXAMPLE),
  };
}

function parseExamples(value: unknown, limit: number = 4): DictEntryExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: DictEntryExample[] = [];
  for (const item of value) {
    const parsed = parseExample(item);
    if (parsed) {
      out.push(parsed);
      if (out.length >= limit) {
        break;
      }
    }
  }

  return out;
}

function parseSubsense(value: unknown): DictEntrySubsense | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const definitionEn = asString(record.definition_en) || asString(record.definitionEn);
  const definitionZh = asString(record.definition_zh) || asString(record.definitionZh);

  if (!definitionEn && !definitionZh) {
    return null;
  }

  return {
    labels: asStringArray(record.labels, LABELS_LIMIT),
    definitionEn: toSafeText(definitionEn, LEN_SUBSENSE_DEF),
    definitionZh: toSafeText(definitionZh, LEN_SUBSENSE_DEF),
    examples: parseExamples(record.examples, SUBSENSE_EXAMPLES_LIMIT),
  };
}

function parseSense(value: unknown): DictEntrySense | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const definitionEn = asString(record.definition_en) || asString(record.definitionEn);
  const definitionZh = asString(record.definition_zh) || asString(record.definitionZh);
  const subsensesRaw = Array.isArray(record.subsenses) ? record.subsenses : [];

  const subsenses: DictEntrySubsense[] = [];
  for (const subsense of subsensesRaw) {
    const parsed = parseSubsense(subsense);
    if (parsed) {
      subsenses.push(parsed);
      if (subsenses.length >= SUBSENSES_LIMIT) {
        break;
      }
    }
  }

  if (!definitionEn && !definitionZh && subsenses.length === 0) {
    return null;
  }

  return {
    num: toSafeText(asString(record.num), LEN_SENSE_NUM),
    labels: asStringArray(record.labels, LABELS_LIMIT),
    definitionEn: toSafeText(definitionEn, LEN_SENSE_DEF),
    definitionZh: toSafeText(definitionZh, LEN_SENSE_DEF),
    examples: parseExamples(record.examples, EXAMPLES_LIMIT),
    subsenses,
  };
}

function parseIdiomSense(value: unknown): DictEntryIdiomSense | null {
  const sense = parseSense(value);
  if (!sense) {
    return null;
  }

  return {
    num: sense.num,
    labels: sense.labels,
    definitionEn: sense.definitionEn,
    definitionZh: sense.definitionZh,
    examples: sense.examples,
  };
}

function parseIdioms(value: unknown): DictEntryIdiom[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const idioms: DictEntryIdiom[] = [];

  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const phrase = asString(record.phrase);
    if (!phrase) {
      continue;
    }

    const rawSenses = Array.isArray(record.senses) ? record.senses : [];
    const senses: DictEntryIdiomSense[] = [];

    for (const sense of rawSenses) {
      const parsed = parseIdiomSense(sense);
      if (parsed) {
        senses.push(parsed);
        if (senses.length >= IDIOM_SENSES_LIMIT) {
          break;
        }
      }
    }

    if (senses.length > 0) {
      idioms.push({
        phrase: toSafeText(phrase, LEN_PHRASE) || phrase,
        senses,
      });
    }

    if (idioms.length >= IDIOMS_LIMIT) {
      break;
    }
  }

  return idioms;
}

function parseSenses(value: unknown, limit: number): DictEntrySense[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const senses: DictEntrySense[] = [];
  for (const sense of value) {
    const parsed = parseSense(sense);
    if (parsed) {
      senses.push(parsed);
      if (senses.length >= limit) {
        break;
      }
    }
  }

  return senses;
}

function parsePosBlock(value: unknown): DictEntryPosBlock | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const senses = parseSenses(record.senses, SENSES_LIMIT);
  if (senses.length === 0) {
    return null;
  }

  return {
    pos: toSafeText(asString(record.pos), LEN_POS),
    labels: asStringArray(record.labels, LABELS_LIMIT),
    senses,
  };
}

function parsePosBlocks(value: unknown): DictEntryPosBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: DictEntryPosBlock[] = [];
  for (const item of value) {
    const parsed = parsePosBlock(item);
    if (parsed) {
      out.push(parsed);
      if (out.length >= POS_BLOCKS_LIMIT) {
        break;
      }
    }
  }

  return out;
}

function parsePronunciations(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];

  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const ipa =
      asString(record.ipa_raw) || asString(record.ipa) || asString(record.label);

    if (ipa) {
      const normalized = toSafeText(ipa, LEN_IPA);
      if (normalized && !out.includes(normalized)) {
        out.push(normalized);
      }
    }

    if (out.length >= PRONUNCIATIONS_LIMIT) {
      break;
    }
  }

  return out;
}

function parseStructuredEntry(content: unknown): {
  pos: string | null;
  pronunciations: string[];
  posBlocks: DictEntryPosBlock[];
  senses: DictEntrySense[];
  idioms: DictEntryIdiom[];
  fallbackText: string | null;
} {
  const record = asRecord(content);

  if (!record) {
    return {
      pos: null,
      pronunciations: [],
      posBlocks: [],
      senses: [],
      idioms: [],
      fallbackText: null,
    };
  }

  const rawPosBlocks = record.pos_blocks ?? record.posBlocks;
  const parsedPosBlocks = parsePosBlocks(rawPosBlocks);
  const standaloneSenses = parseSenses(record.senses, SENSES_LIMIT);
  const sensesFromBlocks = parsedPosBlocks.flatMap((block) => block.senses).slice(0, SENSES_LIMIT);
  const senses = sensesFromBlocks.length > 0 ? sensesFromBlocks : standaloneSenses;

  const text = toSafeText(asString(record.text), LEN_FALLBACK);
  const rawHtml = asString(record.raw_html);
  const fallbackText = text || (rawHtml ? toSafeText(stripHtml(rawHtml), LEN_FALLBACK) : null);
  const fallbackPos = toSafeText(asString(record.pos), LEN_POS);
  const posBlocks =
    parsedPosBlocks.length > 0
      ? parsedPosBlocks
      : senses.length > 0
        ? [
            {
              pos: fallbackPos,
              labels: asStringArray(record.labels, LABELS_LIMIT),
              senses,
            },
          ]
        : [];
  const resolvedPos = posBlocks.find((block) => block.pos)?.pos ?? fallbackPos;

  return {
    pos: resolvedPos,
    pronunciations: parsePronunciations(record.pronunciations),
    posBlocks,
    senses,
    idioms: parseIdioms(record.idioms),
    fallbackText,
  };
}

function pickPrimaryMeaningFromSenses(
  posBlocks: DictEntryPosBlock[],
  senses: DictEntrySense[],
  fallbackText: string | null,
): string | null {
  const firstSense = posBlocks[0]?.senses[0] || senses[0];
  if (firstSense) {
    const fromSense = firstSense.definitionZh || firstSense.definitionEn;
    if (fromSense) {
      return toSafeText(fromSense, LEN_MEANING);
    }

    const fromSubsense =
      firstSense.subsenses[0]?.definitionZh || firstSense.subsenses[0]?.definitionEn;
    if (fromSubsense) {
      return toSafeText(fromSubsense, LEN_MEANING);
    }
  }

  return toSafeText(fallbackText, LEN_MEANING);
}

function emptyEntryDetail(headword: string): DictEntryDetail {
  return {
    headword,
    meaning: null,
    pos: null,
    pronunciations: [],
    audioUrls: [],
    posBlocks: [],
    senses: [],
    idioms: [],
    fallbackText: null,
    contentType: "application/json",
  };
}

function hasStructuredContent(detail: DictEntryDetail): boolean {
  return (
    detail.posBlocks.length > 0 ||
    detail.senses.length > 0 ||
    detail.idioms.length > 0 ||
    detail.pronunciations.length > 0
  );
}

function hasMeaningfulEntry(detail: DictEntryDetail): boolean {
  const meaning = detail.meaning?.trim() || null;
  const fallbackText = detail.fallbackText?.trim() || null;
  const hasMeaning = Boolean(meaning && !isLikelyNotFoundText(meaning));
  const hasFallback = Boolean(fallbackText && !isLikelyNotFoundText(fallbackText));
  return hasMeaning || hasFallback || hasStructuredContent(detail);
}

function parseDictionaryApiDevContent(content: unknown): {
  headword: string | null;
  pos: string | null;
  pronunciations: string[];
  audioUrls: string[];
  posBlocks: DictEntryPosBlock[];
  senses: DictEntrySense[];
  fallbackText: string | null;
} | null {
  if (!Array.isArray(content)) {
    return null;
  }

  const entries = content
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .slice(0, DICT_ENTRIES_LIMIT);

  if (entries.length === 0) {
    return null;
  }

  const pronunciationSet = new Set<string>();
  const posBlocks: DictEntryPosBlock[] = [];
  const audioUrlSet = new Set<string>();
  let resolvedHeadword: string | null = null;

  const addPronunciation = (value: string | null) => {
    const normalized = toSafeText(value, LEN_IPA);
    if (normalized) {
      pronunciationSet.add(normalized);
    }
  };

  const addAudioUrl = (value: string | null) => {
    let url = asString(value);
    if (!url) {
      return;
    }
    // dictionaryapi.dev sometimes returns URLs like "//...".
    if (url.startsWith("//")) {
      url = `https:${url}`;
    }
    if (!/^https?:\/\//i.test(url)) {
      return;
    }
    audioUrlSet.add(url);
  };

  for (const entry of entries) {
    if (!resolvedHeadword) {
      resolvedHeadword = toSafeText(asString(entry.word), LEN_HEADWORD);
    }

    addPronunciation(asString(entry.phonetic));

    if (Array.isArray(entry.phonetics)) {
      for (const phonetic of entry.phonetics) {
        const record = asRecord(phonetic);
        if (!record) {
          continue;
        }
        addPronunciation(asString(record.text));
        addAudioUrl(asString(record.audio));
        if (pronunciationSet.size >= PRONUNCIATIONS_LIMIT && audioUrlSet.size >= AUDIO_URLS_LIMIT) {
          break;
        }
      }
    }

    const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
    for (const meaning of meanings) {
      const meaningRecord = asRecord(meaning);
      if (!meaningRecord) {
        continue;
      }

      const definitionsRaw = Array.isArray(meaningRecord.definitions)
        ? meaningRecord.definitions
        : [];
      const senses: DictEntrySense[] = [];

      for (let i = 0; i < definitionsRaw.length; i += 1) {
        const definitionRecord = asRecord(definitionsRaw[i]);
        if (!definitionRecord) {
          continue;
        }

        const definitionEn = toSafeText(
          asString(definitionRecord.definition) || asString(definitionRecord.meaning),
          LEN_SENSE_DEF,
        );
        if (!definitionEn || isLikelyNotFoundText(definitionEn)) {
          continue;
        }

        const example = toSafeText(asString(definitionRecord.example), LEN_EXAMPLE);
        senses.push({
          num: String(i + 1),
          labels: [],
          definitionEn,
          definitionZh: null,
          examples: example ? [{ en: example, zh: null }] : [],
          subsenses: [],
        });

        if (senses.length >= SENSES_LIMIT) {
          break;
        }
      }

      if (senses.length === 0) {
        continue;
      }

      posBlocks.push({
        pos: toSafeText(
          asString(meaningRecord.partOfSpeech) || asString(meaningRecord.pos),
          LEN_POS,
        ),
        labels: [],
        senses,
      });

      if (posBlocks.length >= POS_BLOCKS_LIMIT) {
        break;
      }
    }

    if (posBlocks.length >= 8) {
      break;
    }
  }

  const pronunciations = [...pronunciationSet].slice(0, PRONUNCIATIONS_LIMIT);
  const senses = posBlocks.flatMap((block) => block.senses).slice(0, SENSES_LIMIT);
  const fallbackText = toSafeText(
    senses[0]?.definitionEn || senses[0]?.definitionZh || null,
    LEN_MEANING,
  );
  const pos = posBlocks.find((block) => block.pos)?.pos ?? null;

  if (senses.length === 0 && pronunciations.length === 0 && !resolvedHeadword) {
    return null;
  }

  return {
    headword: resolvedHeadword,
    pos,
    pronunciations,
    audioUrls: [...audioUrlSet].slice(0, AUDIO_URLS_LIMIT),
    posBlocks,
    senses,
    fallbackText,
  };
}

function parseEntryPayload(headword: string, payload: DictEntryResponse): DictEntryDetail {
  const returnedHeadword = payload.data?.headword?.trim() || headword;
  const dictId = payload.data?.dict_id?.trim() || "";
  const contentType = payload.data?.content_type || "";
  const content = payload.data?.content;

  const parsedDictionaryApiContent = parseDictionaryApiDevContent(content);
  if (parsedDictionaryApiContent) {
    return {
      headword: parsedDictionaryApiContent.headword || returnedHeadword,
      meaning: pickPrimaryMeaningFromSenses(
        parsedDictionaryApiContent.posBlocks,
        parsedDictionaryApiContent.senses,
        parsedDictionaryApiContent.fallbackText,
      ),
      pos: parsedDictionaryApiContent.pos,
      pronunciations: parsedDictionaryApiContent.pronunciations,
      audioUrls: parsedDictionaryApiContent.audioUrls,
      posBlocks: parsedDictionaryApiContent.posBlocks,
      senses: parsedDictionaryApiContent.senses,
      idioms: [],
      fallbackText: parsedDictionaryApiContent.fallbackText,
      contentType: contentType || "application/json",
    };
  }

  if (typeof content === "string") {
    const fallbackText = toSafeText(
      contentType.includes("html") ? stripHtml(content) : content,
      LEN_FALLBACK,
    );

    return {
      headword: returnedHeadword,
      meaning: toSafeText(fallbackText, LEN_MEANING),
      pos: null,
      pronunciations: [],
      audioUrls: [],
      posBlocks: [],
      senses: [],
      idioms: [],
      fallbackText,
      contentType,
    };
  }

  const parsed = parseStructuredEntry(content);

  return {
    headword: returnedHeadword,
    meaning: pickPrimaryMeaningFromSenses(
      parsed.posBlocks,
      parsed.senses,
      parsed.fallbackText,
    ),
    pos: parsed.pos,
    pronunciations: parsed.pronunciations,
    audioUrls: [],
    posBlocks: parsed.posBlocks,
    senses: parsed.senses,
    idioms: parsed.idioms,
    fallbackText: parsed.fallbackText,
    contentType: contentType || (dictId ? "application/json" : ""),
  };
}

async function requestDictWithConfig(
  config: DictConfig,
  path: string,
  searchParams: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`dict api ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.json();
}

async function requestSuggestByDict(
  config: DictConfig,
  q: string,
  limit: number,
  dictId: string,
): Promise<DictSuggestItem[]> {
  const payload = (await requestDictWithConfig(config, "/suggest", {
    dict_id: dictId,
    q,
    limit: Math.min(Math.max(limit, 1), 50),
    mode: "mixed",
  })) as DictSuggestResponse;

  return (payload.data?.items ?? [])
    .map((item) => ({
      headword: item.headword?.trim() || "",
      score: typeof item.score === "number" ? item.score : 0,
    }))
    .filter((item) => item.headword.length > 0);
}

async function lookupEntryDetailByDict(
  config: DictConfig,
  headword: string,
  dictId: string,
): Promise<DictEntryDetail> {
  const payload = (await requestDictWithConfig(
    config,
    `/entries/${encodeURIComponent(headword)}`,
    {
      dict_id: dictId,
      format: "json",
    },
  )) as DictEntryResponse;

  return parseEntryPayload(headword, payload);
}

export function isDictApiConfigured(): boolean {
  return getConfig() !== null;
}

export async function suggestHeadwords(
  q: string,
  limit: number = 8,
): Promise<DictSuggestItem[]> {
  const config = getConfig();
  if (!config) {
    return [];
  }

  const primaryItems = await requestSuggestByDict(config, q, limit, config.dictId);
  if (primaryItems.length > 0 || !shouldUseFallbackDict(config.dictId)) {
    return primaryItems;
  }

  if (normalizeDictId(config.dictId) === normalizeDictId(FALLBACK_DICT_ID)) {
    return primaryItems;
  }

  try {
    const fallbackItems = await requestSuggestByDict(
      config,
      q,
      limit,
      FALLBACK_DICT_ID,
    );
    if (fallbackItems.length === 0) {
      return primaryItems;
    }

    const seen = new Set(primaryItems.map((item) => item.headword.toLowerCase()));
    const merged = [...primaryItems];
    for (const item of fallbackItems) {
      const key = item.headword.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
    }
    return merged;
  } catch (error) {
    if (isLikelyNotFoundError(error) || isTimeoutError(error)) {
      return primaryItems;
    }
    throw error;
  }
}

// ---- In-process entry cache -------------------------------------------
// Prevents repeated network calls for the same headword within a single
// server process lifetime. Entries expire after 10 minutes.
const entryDetailCache = new Map<string, { detail: DictEntryDetail; expiresAt: number }>();
const ENTRY_CACHE_TTL_MS = 10 * 60 * 1000;

function getCachedEntry(key: string): DictEntryDetail | null {
  const cached = entryDetailCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    entryDetailCache.delete(key);
    return null;
  }
  return cached.detail;
}

function setCachedEntry(key: string, detail: DictEntryDetail): void {
  entryDetailCache.set(key, { detail, expiresAt: Date.now() + ENTRY_CACHE_TTL_MS });
  // Prune expired entries when the cache grows large.
  if (entryDetailCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of entryDetailCache) {
      if (now > v.expiresAt) entryDetailCache.delete(k);
    }
  }
}

async function fetchEntryDetail(config: DictConfig, headword: string): Promise<DictEntryDetail> {
  const canFallback =
    shouldUseFallbackDict(config.dictId) &&
    normalizeDictId(config.dictId) !== normalizeDictId(FALLBACK_DICT_ID);

  let primaryDetail: DictEntryDetail | null = null;

  try {
    primaryDetail = await lookupEntryDetailByDict(config, headword, config.dictId);
  } catch (error) {
    if (!canFallback || (!isLikelyNotFoundError(error) && !isTimeoutError(error))) {
      throw error;
    }
  }

  if (primaryDetail && (!canFallback || hasMeaningfulEntry(primaryDetail))) {
    // Even when primary dict has meaning (e.g. Oxford), it may not provide audio.
    // Best-effort: fetch dictionaryapi.dev and merge audioUrls.
    if (canFallback && (primaryDetail.audioUrls?.length ?? 0) === 0) {
      try {
        const fallbackDetail = await lookupEntryDetailByDict(
          config,
          headword,
          FALLBACK_DICT_ID,
        );
        if (fallbackDetail.audioUrls.length > 0) {
          return {
            ...primaryDetail,
            audioUrls: fallbackDetail.audioUrls,
          };
        }
      } catch {
        // ignore audio fallback errors
      }
    }

    return primaryDetail;
  }

  if (!canFallback) {
    return primaryDetail ?? emptyEntryDetail(headword);
  }

  try {
    const fallbackDetail = await lookupEntryDetailByDict(
      config,
      headword,
      FALLBACK_DICT_ID,
    );
    if (hasMeaningfulEntry(fallbackDetail)) {
      return fallbackDetail;
    }
    return primaryDetail ?? fallbackDetail;
  } catch (error) {
    if (isLikelyNotFoundError(error) || isTimeoutError(error)) {
      return primaryDetail ?? emptyEntryDetail(headword);
    }
    throw error;
  }
}

export async function lookupEntryDetail(headword: string): Promise<DictEntryDetail> {
  const config = getConfig();
  if (!config) {
    return emptyEntryDetail(headword);
  }

  const cacheKey = `${normalizeDictId(config.dictId)}:${headword.trim().toLowerCase()}`;
  const cached = getCachedEntry(cacheKey);
  if (cached) return cached;

  const result = await fetchEntryDetail(config, headword);
  setCachedEntry(cacheKey, result);
  return result;
}

export async function lookupMeaning(
  headword: string,
): Promise<{ headword: string; meaning: string | null }> {
  const detail = await lookupEntryDetail(headword);
  return {
    headword: detail.headword,
    meaning: detail.meaning,
  };
}
