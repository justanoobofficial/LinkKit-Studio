/* ==========================================================================
   app.js — application entry point (ES module).

   Orchestrates the whole flow:
     form submit → URL validation → loading/progress UI → POST /api/analyze
     → normalize → render dashboard → clipboard / download interactions.
   Handles failure gracefully (backend unreachable) with a retry path and a
   sample-data preview so the UI is always demonstrable.
   ========================================================================== */

import { CONFIG, DEMO } from './config.js';
import { analyzeUrl } from './api.js';
import { ui, buildDemoKit } from './ui.js';
import {
  isValidUrl,
  normalizeUrlInput,
  copyToClipboard,
  downloadDataUrl,
  hostFromUrl,
  sleep,
  scrollIntoView,
} from './utils.js';

/* --------------------------------------------------------------------------
   Module-level state
   ------------------------------------------------------------------------ */
const els = {
  form: document.getElementById('generateForm'),
  input: document.getElementById('urlInput'),
  urlRow: document.getElementById('urlRow'),
  urlError: document.getElementById('urlError'),
  urlErrorText: document.getElementById('urlErrorText'),
  generateBtn: document.getElementById('generateBtn'),
  btnLabel: document.querySelector('.btn__label'),
  btnSpinner: document.querySelector('.btn__spinner'),
  btnIcon: document.querySelector('.btn__icon'),
};

let lastUrl = '';       // used by the "Try again" action
let busy = false;       // guards against double submissions

/* --------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------ */
init();

function init() {
  ui.init();
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleGenerate(els.input.value);
  });

  // Clear the inline validation error as soon as the user types again.
  els.input.addEventListener('input', hideInlineError);

  // One delegated listener for all dynamic buttons (copy, tabs, actions,
  // sample chips) — no inline onclick handlers, survives re-renders.
  document.addEventListener('click', onDocumentClick);
}

/* --------------------------------------------------------------------------
   Core flow
   ------------------------------------------------------------------------ */

/**
 * Validate → show loading → call the backend → render the kit.
 * `sourceUrl` may be a raw user string; it is normalized + validated here.
 */
async function handleGenerate(rawUrl) {
  const url = normalizeUrlInput(rawUrl);
  hideInlineError();

  if (!url) {
    return showInlineError('Please paste a website URL first.');
  }
  if (!isValidUrl(url)) {
    return showInlineError('That doesn\u2019t look like a valid URL. Try something like https://example.com');
  }

  if (busy) return; // ignore submissions while a request is in flight
  busy = true;
  lastUrl = url;
  setFormBusy(true);

  ui.hideError();
  ui.hideDashboard();
  ui.showLoading(url);
  startPhaseCycle();

  try {
    // MIN_LOADING_MS guarantees the animated phases are visible even when the
    // backend answers instantly; the API call itself may take much longer.
    const [kit] = await Promise.all([analyzeUrl(url), sleep(CONFIG.MIN_LOADING_MS)]);
    finishPhaseCycle();
    ui.hideLoading();
    ui.renderDashboard(kit);
    ui.toast('Your marketing kit is ready \u2728');
    scrollIntoView(ui.els.dashboard, 84);
  } catch (err) {
    finishPhaseCycle();
    ui.hideLoading();
    const friendly = describeError(err);
    ui.showError({
      message: friendly,
      detail: `Endpoint: ${CONFIG.API_URL} \u00b7 URL: ${url}`,
    });
    scrollIntoView(ui.els.errorPanel, 84);
  } finally {
    setFormBusy(false);
    busy = false;
  }
}

/** Map common fetch errors to human-readable copy. */
function describeError(err) {
  if (err && err.name === 'AbortError') {
    return `The analysis took too long and timed out after ${CONFIG.REQUEST_TIMEOUT_MS / 1000}s. Try again, or check that the backend is healthy.`;
  }
  if (err && (err instanceof TypeError || err.message?.includes('fetch'))) {
    return `Couldn't reach the analysis engine at ${CONFIG.API_URL}. Make sure your backend is running, then hit "Try again" — or preview the full flow with sample data below.`;
  }
  return err?.message || 'Something went wrong while generating your kit. Please try again.';
}

/* --------------------------------------------------------------------------
   Phases
   ------------------------------------------------------------------------ */

/** Cycle the checklist every PHASE_INTERVAL_MS while the request is in flight. */
let phaseTimer = null;
function startPhaseCycle() {
  clearInterval(phaseTimer);
  phaseTimer = setInterval(() => {
    const next = (ui.state.phaseIndex + 1) % CONFIG.PHASES.length;
    ui.setPhase(next);
  }, CONFIG.PHASE_INTERVAL_MS);
}
function finishPhaseCycle() {
  if (phaseTimer) clearInterval(phaseTimer);
  phaseTimer = null;
}

/* --------------------------------------------------------------------------
   Form busy state
   ------------------------------------------------------------------------ */
function setFormBusy(value) {
  els.generateBtn.disabled = value;
  els.input.disabled = value;
  els.form.setAttribute('aria-busy', String(value));
  els.btnLabel.textContent = value ? 'Generating…' : 'Generate Marketing Kit';
  els.btnSpinner.hidden = !value;
  els.btnIcon.hidden = value;
}

/* --------------------------------------------------------------------------
   Inline URL validation UI
   ------------------------------------------------------------------------ */
function showInlineError(message) {
  els.urlErrorText.textContent = message;
  els.urlError.hidden = false;
  els.urlRow.classList.add('has-error');
  els.input.focus();
}
function hideInlineError() {
  els.urlError.hidden = true;
  els.urlRow.classList.remove('has-error');
}

/* --------------------------------------------------------------------------
   Delegated interactions (copy, tabs, actions, sample chips)
   ------------------------------------------------------------------------ */
async function onDocumentClick(e) {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) return handleCopy(copyBtn);

  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) return ui.setTab(tabBtn.dataset.tab);

  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) return handleAction(actionBtn.dataset.action);

  const sample = e.target.closest('[data-sample]');
  if (sample) {
    els.input.value = sample.dataset.sample;
    hideInlineError();
    els.input.focus();
  }
}

/** Copy a WhatsApp message or the active-tab caption (+ hashtags). */
async function handleCopy(btn) {
  const kit = ui.state.kit;
  if (!kit) return;

  let text = '';
  let label = '';

  if (btn.dataset.copy === 'whatsapp') {
    text = kit.whatsapp || '';
    label = 'WhatsApp message';
  } else if (btn.dataset.copy === 'caption') {
    const caption = kit.captions?.[ui.state.activeTab] || '';
    const tags = (kit.hashtags || []).join(' ');
    text = caption ? `${caption}${tags ? `\n\n${tags}` : ''}` : '';
    label = `${ui.state.activeTab} caption`;
  }

  if (!text.trim()) {
    ui.toast('Nothing to copy yet — the backend didn\u2019t provide this text.', 'error');
    return;
  }

  const ok = await copyToClipboard(text);
  if (ok) {
    ui.flashCopy(btn);
    ui.toast(`${label} copied to clipboard`);
  } else {
    ui.toast('Copy failed — please select and copy the text manually.', 'error');
  }
}

/** data-action buttons: retry, demo, reset, download. */
function handleAction(action) {
  if (action === 'retry') {
    if (lastUrl) handleGenerate(lastUrl);
    return;
  }
  if (action === 'demo') {
    runDemo();
    return;
  }
  if (action === 'reset') {
    ui.hideDashboard();
    ui.hideError();
    els.input.value = '';
    hideInlineError();
    scrollIntoView(document.querySelector('.hero'));
    els.input.focus();
    return;
  }
  if (action === 'download-shot') {
    const kit = ui.state.kit;
    if (!kit?.screenshotDataUrl) {
      ui.toast('No screenshot available to download.', 'error');
      return;
    }
    const filename = `screenshot-${hostFromUrl(kit.url)}.png`;
    downloadDataUrl(kit.screenshotDataUrl, filename)
      .then(() => ui.toast('Screenshot downloaded'))
      .catch(() => ui.toast('Download failed — please try again.', 'error'));
    return;
  }
}

/** Sample-data preview: full dashboard with a canvas-drawn screenshot. */
async function runDemo() {
  if (busy) return;
  busy = true;
  setFormBusy(true);
  ui.hideError();
  ui.hideDashboard();
  ui.showLoading(DEMO.url);
  startPhaseCycle();

  await sleep(900); // brief, realistic "generation" beat

  finishPhaseCycle();
  ui.hideLoading();
  ui.renderDashboard(buildDemoKit());
  ui.toast('Sample kit loaded — connect your backend for live data');
  scrollIntoView(ui.els.dashboard, 84);
  setFormBusy(false);
  busy = false;
}
