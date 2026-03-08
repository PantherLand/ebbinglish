const TRANCY_VOICES = {
  us: "en-US-JennyNeural",
  uk: "en-GB-AbbiNeural",
} as const;

type TrancyAccent = keyof typeof TRANCY_VOICES;
const DEFAULT_TRANCY_ACCENT: TrancyAccent = "uk";

function normalizeText(text: string): string {
  return text.trim();
}

function normalizeAudioUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function isTrancyAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "api.trancy.org" && parsed.pathname === "/1/dictvoice";
  } catch {
    return false;
  }
}

export function buildTrancyTtsUrl(text: string, accent: TrancyAccent = "us"): string | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }
  const params = new URLSearchParams({
    target: "en",
    text: normalized,
    name: TRANCY_VOICES[accent] || TRANCY_VOICES.us,
  });
  return `https://api.trancy.org/1/dictvoice?${params.toString()}`;
}

export function buildYoudaoTtsUrl(text: string, accent: "us" | "uk" = "us"): string | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }
  const type = accent === "us" ? "0" : "1";
  return `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(normalized)}`;
}

export function buildOxfordTtsUrl(text: string, accent: "us" | "uk" = "us"): string | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }
  const variant = accent === "us" ? "us_1" : "gb_1";
  return `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${normalized.toLowerCase()}--_${variant}.mp3`;
}

export function buildTrancyCompatibleAudioUrls(
  headword: string,
  existingAudioUrls: string[] = [],
  limit = 3,
): string[] {
  const preferred = [buildTrancyTtsUrl(headword, DEFAULT_TRANCY_ACCENT)];

  const out: string[] = [];
  const seen = new Set<string>();

  const append = (value: string | null | undefined) => {
    if (!value) {
      return;
    }
    const normalized = normalizeAudioUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  };

  for (const url of preferred) {
    append(url);
    if (out.length >= limit) {
      return out;
    }
  }

  for (const url of existingAudioUrls) {
    if (url && isTrancyAudioUrl(url)) {
      append(url);
    }
    if (out.length >= limit) {
      break;
    }
  }

  return out;
}
