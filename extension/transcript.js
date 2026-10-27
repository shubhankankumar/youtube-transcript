// Pure helpers shared by the service worker and popup. No chrome.* here so Node tests can import it.

const PREFERRED_LANGS = ["en", "hi"];
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const SRV3_LINE = /<p\b[^>]*\bt="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
const CLASSIC_LINE = /<text\b[^>]*\bstart="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;

export function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    const v = u.searchParams.get("v");
    if (/^[\w-]{11}$/.test(v)) return v;
    return u.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// First preferred language wins (any region variant, e.g. en-GB); human captions beat auto-generated.
export function pickTrack(tracks = []) {
  for (const lang of PREFERRED_LANGS) {
    const matches = tracks.filter(
      (t) => t.languageCode === lang || t.languageCode?.startsWith(lang + "-"),
    );
    if (matches.length) return matches.find((t) => t.kind !== "asr") ?? matches[0];
  }
  return null;
}

// Handles srv3 (<p t="ms">, the default) and classic (<text start="s">) timedtext formats.
export function parseCaptions(xml) {
  const segments = [];
  for (const [, ms, body] of xml.matchAll(SRV3_LINE)) {
    push(segments, ms / 1000, decode(body.replace(/<[^>]+>/g, "")));
  }
  if (segments.length) return segments;
  for (const [, seconds, body] of xml.matchAll(CLASSIC_LINE)) {
    push(segments, Number(seconds), decode(decode(body))); // classic format is double-escaped
  }
  return segments;
}

function push(segments, start, text) {
  text = text.replace(/\s+/g, " ").trim();
  if (text) segments.push({ start, text });
}

// Single pass, so "&amp;lt;" correctly becomes "&lt;" and not "<".
export function decode(s) {
  return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] !== "#") return ENTITIES[e] ?? m;
    const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
}

export function formatTranscript(segments) {
  return segments.map(({ start, text }) => `${timestamp(start)} - ${text}`).join("\n");
}

function timestamp(seconds) {
  const secs = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${Math.floor(seconds / 60)}:${secs}`;
}
