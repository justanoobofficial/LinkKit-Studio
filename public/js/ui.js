/* ==========================================================================
   ui.js — all DOM rendering for the app: loading checklist, the four
   deliverable cards, tabs, toast notifications, and the canvas-drawn demo
   screenshot used by the sample-data fallback.

   No framework: every section is rendered as a template string and attached
   to the DOM. All user/backend text is escaped via escapeHtml() before it
   touches innerHTML.
   ========================================================================== */

import { CONFIG, DEMO } from './config.js';
import { ICONS } from './icons.js';
import { escapeHtml, hostFromUrl } from './utils.js';

/** Tiny querySelector shorthand. */
const $ = (sel) => document.querySelector(sel);

export const ui = {
  els: {},
  state: {
    kit: null,             // the currently displayed (normalized) kit
    activeTab: 'instagram',// active social tab
    phaseTimer: null,      // phase-cycle interval handle
    phaseIndex: -1,
    toastTimer: null,
  },

  /* ---------------------------------------------------------- lifecycle */
  init() {
    this.els = {
      loadingPanel: $('#loadingPanel'),
      loadingUrl: $('#loadingUrl'),
      phaseList: $('#phaseList'),
      progressBar: $('#progressBar'),
      dashboard: $('#dashboard'),
      resultUrl: $('#resultUrl'),
      kitGrid: $('#kitGrid'),
      errorPanel: $('#errorPanel'),
      errorMessage: $('#errorMessage'),
      errorDetail: $('#errorDetail'),
      toast: $('#toast'),
    };
    // Build the phase checklist once (icons + labels come from config).
    this.els.phaseList.innerHTML = CONFIG.PHASES.map(
      (p) => `<li class="phase" id="phase-${p.id}" role="status">
                <span class="phase__icon">${ICONS[p.icon]}</span>
                <span class="phase__label">${escapeHtml(p.label)}…</span>
                <span class="phase__state"></span>
              </li>`
    ).join('');
  },

  /* --------------------------------------------------- loading / phases */
  showLoading(url) {
    this.els.loadingUrl.textContent = url;
    this.els.loadingPanel.hidden = false;
    this.setPhase(0);
    // Cycle phases every PHASE_INTERVAL_MS while loading.
    this.state.phaseTimer = setInterval(() => {
      const next = (this.state.phaseIndex + 1) % CONFIG.PHASES.length;
      this.setPhase(next);
    }, CONFIG.PHASE_INTERVAL_MS);
  },

  /** Highlight phase `index`: earlier = done ✓, current = active pulse. */
  setPhase(index) {
    this.state.phaseIndex = index;
    CONFIG.PHASES.forEach((p, i) => {
      const el = document.getElementById(`phase-${p.id}`);
      if (!el) return;
      el.classList.toggle('phase--done', i < index);
      el.classList.toggle('phase--active', i === index);
      const state = el.querySelector('.phase__state');
      state.innerHTML = i < index ? ICONS.checkCircle : '';
    });
    const pct = Math.min(100, Math.round(((index + 1) / CONFIG.PHASES.length) * 100));
    this.els.progressBar.style.width = `${pct}%`;
  },

  hideLoading() {
    if (this.state.phaseTimer) clearInterval(this.state.phaseTimer);
    this.state.phaseTimer = null;
    this.els.loadingPanel.hidden = true;
  },

  /* ---------------------------------------------------------- dashboard */
  hideDashboard() {
    this.els.dashboard.hidden = true;
  },

  /** Render all four deliverable cards from a normalized kit. */
  renderDashboard(kit) {
    this.state.kit = kit;
    this.state.activeTab = 'instagram';

    this.els.resultUrl.textContent = kit.url;
    this.els.kitGrid.innerHTML = [
      this.cardScreenshot(kit),
      this.cardSummary(kit),
      this.cardWhatsapp(kit),
      this.cardSocial(kit),
    ].join('');

    this.bindScreenshot(kit.screenshotDataUrl);
    this.refreshSocial(kit);
    this.els.dashboard.hidden = false;
  },

  /* ------------------------------------------------------- card builders */

  /** Card 1 — live screenshot preview + download. */
  cardScreenshot(kit) {
    const host = escapeHtml(hostFromUrl(kit.url));
    return `
      <article class="card deliverable">
        <header class="card__head">
          <span class="icon-tile tile-indigo">${ICONS.screenshot}</span>
          <div class="card__head-text">
            <h3>Live Screenshot</h3>
            <p>Captured from ${host}</p>
          </div>
        </header>
        <div class="card__body card__body--flush">
          <div class="shot" id="shotBox">
            <div class="shot__shimmer" aria-hidden="true"></div>
            <img id="screenshotImg" class="shot__img" alt="Screenshot of ${escapeHtml(kit.url)}" />
            <div class="shot__fallback" id="shotFallback" hidden>
              ${ICONS.screenshot}
              <span>No screenshot was returned for this URL.</span>
            </div>
          </div>
        </div>
        <footer class="card__foot">
          <button class="btn btn-primary btn-block" data-action="download-shot" type="button">
            ${ICONS.download} Download Screenshot
          </button>
        </footer>
      </article>`;
  },

  /** Card 2 — executive summary & tagline. */
  cardSummary(kit) {
    const paragraphs = kit.summary.length
      ? kit.summary.map((p) => `<p class="prose-p">${escapeHtml(p)}</p>`).join('')
      : `<p class="prose-p">The analysis engine didn't return a summary for this page.</p>`;

    const highlights = kit.highlights.length
      ? `<ul class="highlight-list">${kit.highlights
          .map((h) => `<li>${ICONS.check}<span>${escapeHtml(h)}</span></li>`)
          .join('')}</ul>`
      : '';

    return `
      <article class="card deliverable">
        <header class="card__head">
          <span class="icon-tile tile-violet">${ICONS.fileText}</span>
          <div class="card__head-text">
            <h3>Executive Summary &amp; Tagline</h3>
            <p>The story behind the link</p>
          </div>
        </header>
        <div class="card__body">
          <p class="tagline">“${escapeHtml(kit.tagline)}”</p>
          ${paragraphs}
          ${highlights}
        </div>
      </article>`;
  },

  /** Card 3 — WhatsApp broadcast kit, styled like a real chat thread. */
  cardWhatsapp(kit) {
    const host = hostFromUrl(kit.url);
    const siteName = host.replace(/^www\./, '').split('.')[0] || 'Your brand';
    const prettyName = siteName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <article class="card deliverable">
        <header class="card__head">
          <span class="icon-tile tile-emerald">${ICONS.whatsapp}</span>
          <div class="card__head-text">
            <h3>WhatsApp Broadcast Kit</h3>
            <p>Copy &amp; send straight to your list</p>
          </div>
        </header>
        <div class="card__body">
          <div class="chat">
            <div class="chat__head">
              <span class="chat__avatar" aria-hidden="true">${escapeHtml(prettyName.charAt(0))}</span>
              <span class="chat__meta">
                <strong>${escapeHtml(prettyName)}</strong>
                <small><i class="chat__dot"></i> online</small>
              </span>
              <span class="chat__brand">${ICONS.whatsapp}</span>
            </div>
            <div class="chat__body">
              <div class="chat__bubble">
                <pre class="chat__msg" id="whatsappMsg">${escapeHtml(kit.whatsapp)}</pre>
                <span class="chat__time">${now} <strong>✓✓</strong></span>
              </div>
            </div>
          </div>
        </div>
        <footer class="card__foot">
          <button class="btn btn-emerald btn-block" data-copy="whatsapp" type="button">
            ${ICONS.copy} Copy WhatsApp Message
          </button>
        </footer>
      </article>`;
  },

  /** Card 4 — social captions with Instagram / Facebook / X tabs + hashtags. */
  cardSocial(kit) {
    return `
      <article class="card deliverable">
        <header class="card__head">
          <span class="icon-tile tile-violet">${ICONS.share}</span>
          <div class="card__head-text">
            <h3>Social Media Captions</h3>
            <p>Instagram · Facebook · X</p>
          </div>
        </header>
        <div class="card__body">
          <div class="tabs" role="tablist" aria-label="Caption platform">
            <button class="tab is-active" role="tab" aria-selected="true" data-tab="instagram" type="button">${ICONS.instagram} Instagram</button>
            <button class="tab" role="tab" aria-selected="false" data-tab="facebook" type="button">${ICONS.facebook} Facebook</button>
            <button class="tab" role="tab" aria-selected="false" data-tab="x" type="button">${ICONS.x} X</button>
          </div>
          <pre class="caption-box" id="captionBox"></pre>
          <div class="hash-row" id="hashRow"></div>
        </div>
        <footer class="card__foot">
          <button class="btn btn-primary btn-block" data-copy="caption" type="button">
            ${ICONS.copy} Copy Caption
          </button>
        </footer>
      </article>`;
  },

  /* ------------------------------------------------------- card behaviour */

  /** Wire the screenshot image: shimmer → fade-in, or fallback on error. */
  bindScreenshot(src) {
    const box = $('#shotBox');
    const img = $('#screenshotImg');
    const fallback = $('#shotFallback');
    if (!src) {
      img.hidden = true;
      fallback.hidden = false;
      box.classList.add('is-loaded');
      return;
    }
    img.addEventListener('load', () => {
      box.classList.add('is-loaded');
    }, { once: true });
    img.addEventListener('error', () => {
      img.hidden = true;
      fallback.hidden = false;
      box.classList.add('is-loaded');
    }, { once: true });
    img.src = src;
  },

  /** Switch the active social tab and re-render caption + hashtags. */
  setTab(tab) {
    if (!this.state.kit || !['instagram', 'facebook', 'x'].includes(tab)) return;
    this.state.activeTab = tab;
    document.querySelectorAll('.tab').forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    this.refreshSocial(this.state.kit);
  },

  /** Fill the caption box + hashtag chips for the active tab. */
  refreshSocial(kit) {
    const box = $('#captionBox');
    const row = $('#hashRow');
    if (!box || !row) return;
    const caption = kit.captions?.[this.state.activeTab] || '';
    box.textContent = caption || 'No caption generated for this platform yet.';
    box.classList.toggle('caption-box--empty', !caption);
    row.innerHTML = kit.hashtags.length
      ? kit.hashtags.map((h) => `<span class="hash-chip">${escapeHtml(h)}</span>`).join('')
      : '';
  },

  /** Temporary "Copied!" state on the clicked copy button. */
  flashCopy(btn) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.classList.add('btn--copied');
    btn.innerHTML = `${ICONS.check} Copied!`;
    btn.setAttribute('disabled', '');
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(() => {
      btn.classList.remove('btn--copied');
      btn.innerHTML = original;
      btn.removeAttribute('disabled');
    }, 1800);
  },

  /* ------------------------------------------------------------- errors */
  showError({ message, detail }) {
    this.els.errorMessage.textContent = message;
    this.els.errorDetail.textContent = detail || '';
    this.els.errorPanel.hidden = false;
  },

  hideError() {
    this.els.errorPanel.hidden = true;
  },

  /* -------------------------------------------------------------- toast */
  toast(message, tone = 'success') {
    const el = this.els.toast;
    el.innerHTML = `${tone === 'error' ? ICONS.alert : ICONS.check} <span>${escapeHtml(message)}</span>`;
    el.className = `toast toast--${tone}`;
    // Force reflow so the transition re-runs on consecutive toasts.
    void el.offsetWidth;
    el.classList.add('toast--show');
    clearTimeout(this.state.toastTimer);
    this.state.toastTimer = setTimeout(() => el.classList.remove('toast--show'), 2400);
  },
};

/* ==========================================================================
   Demo screenshot — drawn to a <canvas> at runtime (no network, no asset
   files). Mimics a real browser screenshot of the sample site so the
   "Preview with sample data" flow still produces a downloadable PNG.
   ========================================================================== */

export function buildDemoKit() {
  return {
    url: DEMO.url,
    screenshotDataUrl: buildDemoScreenshot(),
    tagline: DEMO.tagline,
    summary: DEMO.summary,
    highlights: DEMO.highlights,
    whatsapp: DEMO.whatsapp,
    captions: DEMO.captions,
    hashtags: DEMO.hashtags,
  };
}

function buildDemoScreenshot() {
  const W = 1280;
  const H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Rounded-rect helper
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const uiFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // Page background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.55, '#1e1b4b');
  bg.addColorStop(1, '#0b1120');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow orbs
  const orb = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  orb(180, 150, 280, 'rgba(99,102,241,0.32)');
  orb(W - 160, 260, 320, 'rgba(139,92,246,0.28)');

  // Dot grid
  ctx.fillStyle = 'rgba(148,163,184,0.07)';
  for (let x = 0; x < W; x += 26) {
    for (let y = 0; y < H; y += 26) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.textBaseline = 'middle';

  // Browser chrome
  ctx.fillStyle = 'rgba(2,6,23,0.78)';
  rr(40, 26, W - 80, 64, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(51,65,85,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ['#f87171', '#fbbf24', '#34d399'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(72 + i * 22, 58, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(15,23,42,0.95)';
  rr(160, 42, 430, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 15px ${uiFont}`;
  ctx.fillText('\u{1F512}  aurorafitness.ng', 182, 59);
  ctx.fillStyle = 'rgba(148,163,184,0.8)';
  ctx.font = `600 14px ${uiFont}`;
  ['Classes', 'Coaching', 'About'].forEach((t, i) => ctx.fillText(t, W - 380 + i * 98, 59));
  ctx.fillStyle = '#6366f1';
  rr(W - 172, 44, 120, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Book Now', W - 146, 59);

  // Brand row
  ctx.fillStyle = '#8b5cf6';
  rr(52, 150, 64, 64, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${uiFont}`;
  ctx.fillText('A', 77, 193);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = `800 22px ${uiFont}`;
  ctx.fillText('Aurora Fitness', 134, 193);

  // Hero copy
  ctx.fillStyle = '#f1f5f9';
  ctx.font = `800 62px ${uiFont}`;
  ctx.fillText('Train hard. Live loud.', 52, 300);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 20px ${uiFont}`;
  ctx.fillText('Boutique gym · Victoria Island, Lagos', 52, 346);
  ctx.fillText('HIIT · Strength · Yoga · Mobility', 52, 376);

  // CTAs
  ctx.fillStyle = '#6366f1';
  rr(52, 412, 178, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 18px ${uiFont}`;
  ctx.fillText('Start free week', 82, 442);
  ctx.strokeStyle = 'rgba(148,163,184,0.6)';
  ctx.lineWidth = 1.5;
  rr(248, 412, 152, 52, 26);
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('View classes', 276, 442);

  // Stats
  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = `600 15px ${uiFont}`;
  ctx.fillText('12,000+ members', 52, 522);
  ctx.fillText('·', 250, 522);
  ctx.fillText('40 classes / wk', 282, 522);
  ctx.fillText('·', 488, 522);
  ctx.fillText('15:1 coach ratio', 520, 522);

  // Feature cards
  const cards = [
    ['\u{1F525}', 'HIIT', '45-min burners, 7 days a week'],
    ['\u{1F4AA}', 'Strength', 'Progressive lifting blocks'],
    ['\u{1F9D8}', 'Yoga & Mobility', 'Reset body and mind'],
  ];
  cards.forEach(([emoji, title, desc], i) => {
    const x = 52 + i * 340;
    ctx.fillStyle = 'rgba(30,41,59,0.85)';
    rr(x, 560, 310, 150, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99,102,241,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '30px sans-serif';
    ctx.fillText(emoji, x + 22, 598);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 19px ${uiFont}`;
    ctx.fillText(title, x + 22, 638);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 14.5px ${uiFont}`;
    ctx.fillText(desc, x + 22, 666);
  });

  // Footer bar
  ctx.fillStyle = 'rgba(2,6,23,0.7)';
  ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = '#64748b';
  ctx.font = `500 13px ${uiFont}`;
  ctx.textAlign = 'center';
  ctx.fillText('© 2026 Aurora Fitness · Victoria Island, Lagos · hello@aurorafitness.ng', W / 2, H - 20);

  return canvas.toDataURL('image/png');
}
