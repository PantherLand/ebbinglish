import type { AiDictEntry, AiDictPosBlock, AiDictSense } from "@/src/ai-dict";
import { buildTrancyCompatibleAudioUrls } from "@/src/pronunciation-sources";

const GOOGLE_DICT_TIMEOUT_MS = 1500;
const DICTIONARY_API_TIMEOUT_MS = 5000;

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const out = value.trim();
  return out || null;
}

function isDictionaryRows(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.some((row) => Array.isArray(row) && typeof row[0] === "string" && Array.isArray(row[1]));
}

function parseGoogleDictionaryPayload(headword: string, payload: unknown): AiDictEntry | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const translationChunks = Array.isArray(payload[0]) ? payload[0] : [];
  const translatedMeaning = translationChunks
    .map((chunk) => (Array.isArray(chunk) ? asString(chunk[0]) : null))
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .trim() || null;

  const dictionaryRows =
    payload.find((item) => isDictionaryRows(item)) as unknown[] | undefined;

  const posBlocks: AiDictPosBlock[] = [];
  const senses: AiDictSense[] = [];
  let resolvedHeadword = headword;

  if (dictionaryRows) {
    for (const row of dictionaryRows) {
      if (!Array.isArray(row)) {
        continue;
      }

      const pos = asString(row[0]);
      const defsRaw = Array.isArray(row[1]) ? row[1] : [];
      const rowHeadword = asString(row[2]);
      if (rowHeadword) {
        resolvedHeadword = rowHeadword;
      }

      const rowSenses: AiDictSense[] = [];
      for (let index = 0; index < defsRaw.length; index += 1) {
        const item = defsRaw[index];
        if (!Array.isArray(item)) {
          continue;
        }
        const definitionEn = asString(item[0]);
        if (!definitionEn) {
          continue;
        }
        rowSenses.push({
          num: String(index + 1),
          labels: [],
          definitionEn,
          definitionZh: null,
          examples: [],
          subsenses: [],
        });
      }

      if (rowSenses.length === 0) {
        continue;
      }

      posBlocks.push({
        pos,
        labels: [],
        senses: rowSenses,
      });
      senses.push(...rowSenses);
    }
  }

  const fallbackText =
    translatedMeaning ||
    senses[0]?.definitionEn ||
    null;

  if (!fallbackText && senses.length === 0) {
    return null;
  }

  return {
    headword: resolvedHeadword,
    meaning: senses[0]?.definitionEn || translatedMeaning || null,
    pos: posBlocks[0]?.pos || null,
    pronunciations: [],
    audioUrls: buildTrancyCompatibleAudioUrls(resolvedHeadword),
    posBlocks,
    senses,
    idioms: [],
    fallbackText,
  };
}

function parseDictionaryApiPayload(headword: string, payload: unknown): AiDictEntry | null {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const entry = payload.find((item) => typeof item === "object" && item !== null) as
    | Record<string, unknown>
    | undefined;
  if (!entry) {
    return null;
  }

  const resolvedHeadword = asString(entry.word) || headword;
  const phonetic = asString(entry.phonetic);
  const phoneticsRaw = Array.isArray(entry.phonetics) ? entry.phonetics : [];
  const pronunciations = [
    phonetic,
    ...phoneticsRaw
      .map((item) => (typeof item === "object" && item ? asString((item as Record<string, unknown>).text) : null)),
  ].filter((item, index, arr): item is string => Boolean(item) && arr.indexOf(item) === index);

  const audioUrls = phoneticsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return asString((item as Record<string, unknown>).audio);
    })
    .filter((item): item is string => Boolean(item));

  const meaningsRaw = Array.isArray(entry.meanings) ? entry.meanings : [];
  const posBlocks: AiDictPosBlock[] = [];
  const senses: AiDictSense[] = [];

  for (const meaning of meaningsRaw) {
    if (!meaning || typeof meaning !== "object") {
      continue;
    }
    const raw = meaning as Record<string, unknown>;
    const pos = asString(raw.partOfSpeech);
    const definitions = Array.isArray(raw.definitions) ? raw.definitions : [];
    const rowSenses: AiDictSense[] = [];
    for (let idx = 0; idx < definitions.length; idx += 1) {
      const def = definitions[idx];
      if (!def || typeof def !== "object") {
        continue;
      }
      const d = def as Record<string, unknown>;
      const definitionEn = asString(d.definition);
      if (!definitionEn) {
        continue;
      }
      const example = asString(d.example);
      rowSenses.push({
        num: String(idx + 1),
        labels: [],
        definitionEn,
        definitionZh: null,
        examples: example ? [{ en: example, zh: null }] : [],
        subsenses: [],
      });
    }

    if (rowSenses.length === 0) {
      continue;
    }

    posBlocks.push({
      pos,
      labels: [],
      senses: rowSenses,
    });
    senses.push(...rowSenses);
  }

  const primaryMeaning = senses[0]?.definitionEn || null;
  if (!primaryMeaning) {
    return null;
  }

  return {
    headword: resolvedHeadword,
    meaning: primaryMeaning,
    pos: posBlocks[0]?.pos || null,
    pronunciations,
    audioUrls: buildTrancyCompatibleAudioUrls(resolvedHeadword, audioUrls),
    posBlocks,
    senses,
    idioms: [],
    fallbackText: primaryMeaning,
  };
}

export type GoogleLookupResult = {
  entry: AiDictEntry;
  source: "google" | "dictionaryapi";
};

export async function lookupWordByGoogle(headword: string): Promise<GoogleLookupResult | null> {
  const word = headword.trim();
  if (!word) {
    return null;
  }

  try {
    const url = new URL("https://clients5.google.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", "zh-CN");
    url.searchParams.set("hl", "en");
    url.searchParams.set("dt", "t");
    url.searchParams.append("dt", "md");
    url.searchParams.set("q", word);

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(GOOGLE_DICT_TIMEOUT_MS),
    });

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const parsed = parseGoogleDictionaryPayload(word, payload);
      if (parsed) {
        return { entry: parsed, source: "google" };
      }
    }
  } catch {
    // Ignore and fallback to dictionaryapi.dev
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(DICTIONARY_API_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    const parsed = parseDictionaryApiPayload(word, payload);
    if (parsed) {
      return { entry: parsed, source: "dictionaryapi" };
    }
  } catch {
    // Ignore and fallback to AI.
  }

  return null;
}
