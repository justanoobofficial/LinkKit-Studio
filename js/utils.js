/* ==========================================================================
   utils.js — framework-free helpers: URL validation/normalization, clipboard
   copy (with legacy fallback), base64/data-URL download, and HTML escaping.
   ========================================================================== */

/** True when `raw` parses as an http(s) URL. */
export function isValidUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Tidy a raw input value into a usable URL:
 *  - trims whitespace
 *  - auto-prepends `https://` when the user pasted a bare domain
 *    (e.g. "example.com/path") — friendly UX, still validated afterwards.
 */
export function normalizeUrlInput(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) {
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(value)) {
      value = 'https://' + value;
    }
  }
  return value;
}

/** "https://www.example.com/x" -> "example.com" (used for labels + filenames). */
export function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'site';
  }
}

/** Escape user/backend-supplied strings before injecting into HTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

/**
 * Copy text to the clipboard.
 * Prefers the async Clipboard API; falls back to the legacy execCommand
 * trick for non-secure contexts and sandboxed iframes where
 * navigator.clipboard is unavailable or denied.
 * Returns a Promise<boolean> — true when the copy likely succeeded.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  return legacyCopy(text);
}

/** Legacy copy: hidden textarea + document.execCommand('copy'). */
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);

  // Preserve the user's current selection while we hijack it for the copy.
  const selection = document.getSelection();
  const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  ta.select();
  ta.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  ta.remove();
  if (prevRange && selection) {
    selection.removeAllRanges();
    selection.addRange(prevRange);
  }
  return ok;
}

/**
 * Coerce a backend screenshot value into an <img>-safe URL.
 * Accepts: "data:image/png;base64,...", raw base64, or a plain http(s) URL.
 */
export function toDataUrl(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^data:image\//i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[A-Za-z0-9+/=]+$/.test(s)) return `data:image/png;base64,${s}`;
  return '';
}

/**
 * Trigger a browser download for a data URL / base64 screenshot.
 * Converts to a Blob object URL first (more reliable for large images),
 * with a graceful fallback to the raw data URL.
 */
export async function downloadDataUrl(dataUrl, filename) {
  let href = dataUrl;
  if (/^data:/i.test(dataUrl)) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      href = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(href), 5000);
    } catch {
      /* sandboxed environments may block fetch(data:); keep the data URL */
    }
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Promise-based sleep for minimum-loading-time UX. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scroll an element into view, respecting prefers-reduced-motion. */
export function scrollIntoView(el, offset = 0) {
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
}
