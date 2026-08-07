/* ==========================================================================
   config.js — central configuration: API endpoint, UX timing, phases,
   and the built-in sample (demo) kit used when the backend is unreachable.
   ========================================================================== */

export const CONFIG = {
  /** Backend endpoint the app POSTs { url } to. */
  API_URL: '/api/analyze',

  /** Abort the fetch after this long (ms) so the UI never hangs forever. */
  REQUEST_TIMEOUT_MS: 45000,

  /** Keep the loading state visible at least this long so the animated
      phases are perceivable even when the API responds instantly. */
  MIN_LOADING_MS: 1800,

  /** How long each "phase" stays highlighted before moving to the next. */
  PHASE_INTERVAL_MS: 2400,

  /** The ordered processing steps shown in the loading checklist.
      `icon` keys map to entries in icons.js. */
  PHASES: [
    { id: 'screenshot', label: 'Capturing screenshot',      icon: 'screenshot' },
    { id: 'analyze',    label: 'Analyzing content',         icon: 'zap' },
    { id: 'copy',       label: 'Writing marketing copy',    icon: 'fileText' },
    { id: 'assemble',   label: 'Assembling your kit',       icon: 'layers' },
  ],
};

/**
 * Sample kit — mirrors the exact normalized shape produced by `normalizeKit`
 * in api.js. Used by the "Preview with sample data" fallback so the full UI
 * (including a real downloadable screenshot) is demoable without a backend.
 */
export const DEMO = {
  url: 'https://aurorafitness.ng',
  tagline: 'Train hard. Live loud.',
  summary: [
    'Aurora Fitness is Lagos\u2019 boldest boutique gym, tucked into Victoria Island with a cult following of 12,000+ members. It blends high-energy HIIT, strength and yoga into one space — no mirrors, no judgement, just loud music and louder results.',
    'The brand voice is punchy, confident and unapologetically local: it celebrates Nigerian hustle culture, drops new classes every week and treats every member like a regular. This kit captures that energy for your next campaign.',
  ],
  highlights: [
    'Boutique gym in Victoria Island, Lagos',
    'HIIT \u00b7 Strength \u00b7 Yoga \u00b7 Mobility',
    'Certified coaches, capped 15-person classes',
    'Open 7 days a week, 6am \u2013 10pm',
  ],
  whatsapp: '🏋️‍♀️ *AURORA FITNESS — THIS WEEK AT THE CLUB*\n\nHey {FirstName}! Fresh classes just dropped, and they are moving fast:\n\n🔥 *Saturday Sunrise HIIT* — 7:00 AM\n💪 *Strength Circuit* — Tue & Thu, 6:30 PM\n🧘 *Mobility Reset* — Sunday, 5:00 PM\n\n🎁 First-timers get *2 FREE sessions* with code *FIRST2*.\n\n👉 Reply *START* to book your spot, or check aurorafitness.ng for the full timetable.\n\nSee you at the bar! — The Aurora Team',
  captions: {
    instagram: 'New week, new energy 🔥\n\nWe just dropped our freshest class lineup at Aurora Fitness — Sunrise HIIT on Saturdays, Strength Circuit on Tuesdays & Thursdays, and a Sunday Mobility Reset to keep you injury-free.\n\nFirst-timers train FREE with code FIRST2.\n\nTag your workout partner — you know they need this. 👟',
    facebook: 'Aurora Fitness just dropped a brand-new class schedule 🏋️‍♀️\n\nStarting this week: Saturday Sunrise HIIT, Strength Circuit (Tue & Thu evenings) and a Sunday Mobility Reset. Every class is capped at 15 people so you get real coaching, real fast.\n\nFirst session is FREE for new members — reply or visit aurorafitness.ng to claim your spot. See you on the floor!',
    x: 'New week. New classes. Same loud gym energy. 🏋️‍♀️🔥\n\nSunrise HIIT Sat 7am · Strength Circuit Tue/Thu · Mobility Reset Sun 5pm\n\nFirst session free with code FIRST2 → aurorafitness.ng',
  },
  hashtags: ['#AuroraFitness', '#LagosFitness', '#VictoriaIsland', '#HIITLagos', '#TrainHardLiveLoud', '#FitNigerian', '#NoExcuses'],
};
