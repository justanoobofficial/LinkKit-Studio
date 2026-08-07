/* ==========================================================================
   api.js — talks to the analysis backend and normalizes whatever shape the
   server returns into the app's canonical "kit" object.

   Canonical kit shape produced by normalizeKit():
   {
     url,                      // the URL we analyzed
     screenshotDataUrl,        // <img>-ready screenshot (data: or http URL)
     tagline,                  // one-liner headline
     summary:  [paragraph],    // array of paragraphs
     highlights: [string],     // optional key points
     whatsapp,                 // broadcast message text
     captions: { instagram, facebook, x },
     hashtags: [string]
   }
   ========================================================================== */

import { CONFIG } from './config.js';

/**
 * POST { url } to CONFIG.API_URL and resolve with a normalized kit.
 * Throws on network failure, non-2xx response, or invalid JSON —
 * the caller decides how to surface the error.
 */
export async function analyzeUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Server responded with HTTP ${res.status}${res.statusText ? ` (${res.statusText})` : ''}`);
    }

    const payload = await res.json();
    return normalizeKit(payload, url);
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------------
   Tolerant field extraction: the backend may wrap data under `data`,
   name fields differently, or omit optional ones. Each getter tries several
   plausible keys so the frontend survives API contract drift.
   ------------------------------------------------------------------------ */

/** First non-empty value among the given candidates. */
function first(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

/** Coerce a value into an array of non-empty strings. */
function asArray(value) {
  if (Array.isArray(value)) return value.filter((v) => String(v ?? '').trim() !== '').map(String);
  if (typeof value === 'string' && value.trim()) {
    // "a, b  #c" -> ["a","b","#c"] (split on commas, newlines or spaces)
    return value.split(/[\n,]+|\s+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Coerce summary (string | string[] | { paragraphs: [...] }) into paragraphs. */
function asParagraphs(value) {
  if (typeof value === 'string' && value.trim()) return value.trim().split(/\n{2,}/).map((s) => s.trim());
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const inner = value.paragraphs ?? value.body ?? value.text;
    if (inner) return asParagraphs(inner);
  }
  const arr = asArray(value);
  return arr.length ? arr : [];
}

/** Pull the screenshot out of whatever shape the payload uses. */
function extractScreenshot(data) {
  return first(
    data.screenshot,
    data.image,
    data.screenshot_base64,
    data.screenshotUrl,
    data.data?.screenshot,
  );
}

/** Normalize an arbitrary backend payload into the canonical kit object. */
export function normalizeKit(raw, url) {
  // Allow payloads like { data: {...} } as well as flat payloads.
  const data = raw && typeof raw === 'object' ? (raw.data ?? raw) : {};
  const copy = data.copy ?? data.marketing ?? data.generated ?? data.content ?? {};

  // Captions may be nested (copy.captions.instagram) or flat (copy.instagram).
  const captions = copy.captions ?? {};
  const captionFor = (platform, flatKey) =>
    first(captions[platform], captions[flatKey], copy[platform], copy[flatKey]);

  return {
    url,
    screenshotDataUrl: toDataUrlSafe(extractScreenshot(data)),
    tagline: first(copy.tagline, copy.headline, copy.title, copy.slogan) || 'Your link, decoded.',
    summary: asParagraphs(first(copy.summary, copy.executive_summary, copy.description, copy.overview)),
    highlights: asArray(first(copy.highlights, copy.key_points, copy.points, copy.bullets)),
    whatsapp: first(copy.whatsapp, copy.whatsapp_message, copy.whatsapp_broadcast, copy.broadcast),
    captions: {
      instagram: captionFor('instagram', 'instagram_caption'),
      facebook: captionFor('facebook', 'facebook_caption'),
      x: captionFor('x', 'twitter') || captionFor('twitter', 'twitter_caption'),
    },
    hashtags: asArray(first(copy.hashtags, copy.tags, copy.captions?.hashtags)),
  };
}

/** Local re-export so api.js doesn't import utils (keeps dependency one-way). */
function toDataUrlSafe(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[A-Za-z0-9+/=]+$/.test(s)) return `data:image/png;base64,${s}`;
  return '';
}
