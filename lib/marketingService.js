import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer';

function fallbackSummary(title) {
  return `Welcome to ${title}! We serve authentic, delicious options prepared fresh daily. Visit us today or order online for fast, reliable delivery right to your door!`;
}

function fallbackTagline(title) {
  return `Fresh, Quality & Exceptional Flavours at ${title}`;
}

function fallbackHighlights(title) {
  return [
    `Authentic signature dishes at ${title}`,
    `Dine-in, takeaway & fast delivery options`,
    `Quality ingredients cooked fresh daily`
  ];
}

export function createFallbackMarketing(pageData = {}) {
  const title = pageData?.title?.trim() || 'our business';
  const location = pageData?.location?.trim() || '';

  return {
    tagline: fallbackTagline(title),
    summary: fallbackSummary(title),
    whatsappMessage: `Hungry for delicious meals from *${title}*? 🍲✨\n\nWe are serving up fresh, high-quality dishes made to order:\n\n✅ Fresh local specialties\n✅ Dine-in, takeaway & fast delivery\n📍 Location: ${location || 'Check menu for details'}\n\n📲 Order now: [Link]`,
    socialCaption: `Ready for an incredible meal with ${title}? 🍛✨\n\nFrom fresh quality ingredients to fast delivery, we have you covered.\n\n👇 Tap the link to view our full menu and place your order today!\n#${title.replace(/\s+/g, '')} #Foodies #OrderNow`,
    highlights: fallbackHighlights(title)
  };
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function extractJsonPayload(rawText) {
  if (!rawText) return null;

  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

export function validateMarketingOutput(payload) {
  let parsed = payload;
  if (typeof payload === 'string') {
    parsed = extractJsonPayload(payload);
    if (!parsed) {
      throw new Error('Failed to parse or extract JSON from string.');
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Marketing output must be a JSON object.');
  }

  const requiredKeys = ['tagline', 'summary', 'whatsappMessage', 'socialCaption', 'highlights'];
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`Marketing output is missing required key: ${key}`);
    }
  }

  const textFields = ['tagline', 'summary', 'whatsappMessage', 'socialCaption'];
  for (const key of textFields) {
    const value = parsed[key];
    if (typeof value !== 'string' || !sanitizeText(value).length) {
      throw new Error(`Marketing output field "${key}" must be a non-empty string.`);
    }
  }

  const highlights = parsed.highlights;
  if (!Array.isArray(highlights) || highlights.length < 2) {
    throw new Error('Marketing output highlights must be an array with at least 2 items.');
  }

  const invalidHighlights = highlights.some((entry) => typeof entry !== 'string' || !sanitizeText(entry).length);
  if (invalidHighlights) {
    throw new Error('Marketing output highlights must be non-empty strings.');
  }

  const blockedPhrases = [
    'hi team',
    'we analyzed',
    'we just looked at',
    'we evaluated',
    'the story is compelling',
    'a clear value proposition',
    'a polished brand story',
    'a strong call to action',
  ];
  const combinedText = [
    parsed.tagline,
    parsed.summary,
    parsed.whatsappMessage,
    parsed.socialCaption,
    ...highlights
  ]
    .join(' ')
    .toLowerCase();

  const matchedPhrase = blockedPhrases.find((phrase) => combinedText.includes(phrase));
  if (matchedPhrase) {
    throw new Error(`Marketing output contains blocked reviewer-style phrasing: ${matchedPhrase}`);
  }

  return parsed;
}

export function normalizeMarketingPayload(payload) {
  const fallback = createFallbackMarketing({ title: 'Your brand' });

  try {
    const validatedPayload = validateMarketingOutput(payload);
    const highlights = Array.isArray(validatedPayload.highlights)
      ? validatedPayload.highlights.filter(Boolean).map((entry) => sanitizeText(entry, '')).filter(Boolean).slice(0, 3)
      : [];

    return {
      tagline: sanitizeText(validatedPayload.tagline, fallback.tagline),
      summary: sanitizeText(validatedPayload.summary, fallback.summary),
      whatsappMessage: sanitizeText(validatedPayload.whatsappMessage ?? validatedPayload.whatsapp_message ?? validatedPayload.whatsapp, fallback.whatsappMessage),
      socialCaption: sanitizeText(validatedPayload.socialCaption ?? validatedPayload.social_caption ?? validatedPayload.caption, fallback.socialCaption),
      highlights: highlights.length ? highlights : fallback.highlights,
    };
  } catch (error) {
    console.warn('Rejected invalid marketing output and using fallback copy.', error.message);
    return fallback;
  }
}

async function extractMetadata(page) {
  return page.evaluate(() => {
    const pickMeta = (name) => {
      const selector = `meta[name="${name}"]`;
      const fallbackSelector = `meta[property="${name}"]`;
      const element = document.querySelector(selector) || document.querySelector(fallbackSelector);
      return element?.getAttribute('content')?.trim() || '';
    };

    const cleanText = (value) => value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
    const headings = (selector) => Array.from(document.querySelectorAll(selector))
      .map((element) => element.textContent?.trim() || '')
      .filter(Boolean)
      .slice(0, 6);

    const bodyText = document.body ? document.body.innerText : '';

    return {
      title: document.title?.trim() || '',
      description: pickMeta('description'),
      h1: headings('h1'),
      h2: headings('h2'),
      bodyText: cleanText(bodyText).slice(0, 1500),
    };
  });
}

function buildGeminiPrompt(metadata, bodyText) {
  const pageData = {
    title: sanitizeText(metadata?.title, 'Website'),
    metaDesc: sanitizeText(metadata?.description, 'No description provided.'),
    headingText: `${metadata?.h1?.slice(0, 3).join(' | ') || 'No H1 found.'} | ${metadata?.h2?.slice(0, 3).join(' | ') || 'No H2 found.'}`,
    bodySnippet: (bodyText || '').slice(0, 1500)
  };

  return `
You are an elite direct-response sales copywriter. Your task is to write high-converting marketing copy directly FOR the business owner to publish and send to their potential customers.

WEBSITE DATA SCRAPED:
Title: ${pageData.title}
Meta Description: ${pageData.metaDesc}
Headings: ${pageData.headingText}
Content Snippet: ${pageData.bodySnippet}

STRICT COPYWRITING RULES:
1. PERSPECTIVE: Write directly TO the end customer (2nd person: "you/your") AS the business itself (1st person: "we/our").
2. ABSOLUTE BAN ON REVIEWER LANGUAGE: NEVER write phrases like "Hi team", "We analyzed", "We just looked at", "The story is compelling", or "Here is a draft".
3. NO GENERIC HIGHLIGHTS: In the 'highlights' array, NEVER output generic placeholders like "A clear value proposition", "A polished brand story", or "A strong call to action". Extract 3 actual, specific selling points from the website (e.g., "Authentic hot Nigerian dishes", "Convenient dine-in, takeaway & delivery", "Open 7 days a week").
4. CONVERSION STRUCTURE: Include a hook, real customer benefits, location/ordering info, and a direct Call to Action.

RETURN ONLY VALID JSON (NO MARKDOWN / NO BACKTICKS):
{
  "tagline": "A punchy, memorable 1-line headline capturing the business offer.",
  "summary": "A 2-3 sentence customer-facing intro highlighting specialties and ending with a clear command to visit or order.",
  "whatsappMessage": "A ready-to-send broadcast message with emojis, key benefits, location/order details, and a [Link] placeholder.",
  "socialCaption": "An engaging social caption with emojis, location info, CTA, and 3-5 relevant hashtags.",
  "highlights": [
    "Specific Benefit 1 from the site",
    "Specific Benefit 2 from the site",
    "Specific Benefit 3 from the site"
  ]
}
`;
}

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => typeof candidate === 'string' && fs.existsSync(candidate)) || null;
}

async function generateMarketingCopy(metadata) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return createFallbackMarketing(metadata);
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildGeminiPrompt(metadata, metadata.bodyText || '');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            tagline: { type: 'STRING' },
            summary: { type: 'STRING' },
            whatsappMessage: { type: 'STRING' },
            socialCaption: { type: 'STRING' },
            highlights: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['tagline', 'summary', 'whatsappMessage', 'socialCaption', 'highlights'],
        },
        temperature: 0.7,
      },
    });

    const responseText = response?.text
      ?? response?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('')
      ?? '';

    const validated = validateMarketingOutput(responseText);
    return normalizeMarketingPayload(validated);
  } catch (error) {
    console.warn('Gemini generation failed, falling back to deterministic copy.', error.message);
  }

  return createFallbackMarketing(metadata);
}

export async function analyzeUrl(url) {
  let browser;

  try {
    const executablePath = resolveBrowserExecutable();
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: executablePath || undefined,
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-features=Translate,BackForwardCache',
      ],
      timeout: 60000,
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const metadata = await extractMetadata(page);
    const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });
    const screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
    const marketing = await generateMarketingCopy(metadata);

    return {
      screenshot,
      marketing,
      metadata,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
