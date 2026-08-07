import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl } from '../lib/validators.js';

test('rejects missing URLs', () => {
  const result = validateUrl('');
  assert.equal(result.valid, false);
  assert.match(result.error, /required/i);
});

test('accepts valid https URLs', () => {
  const result = validateUrl('https://example.com');
  assert.equal(result.valid, true);
  assert.equal(result.normalized, 'https://example.com/');
});

import { validateMarketingOutput } from '../lib/marketingService.js';

test('validateMarketingOutput - accepts valid payload object', () => {
  const validPayload = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection of quality products. Order from us now to get started.',
    whatsappMessage: 'Check out our amazing products and place your order today!',
    socialCaption: 'You deserve the best. Visit our site and see what we have for you.',
    highlights: ['Best quality', 'Low prices']
  };
  const result = validateMarketingOutput(validPayload);
  assert.deepEqual(result, validPayload);
});

test('validateMarketingOutput - parses and accepts valid JSON string', () => {
  const validJson = JSON.stringify({
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection of quality products. Order from us now to get started.',
    whatsappMessage: 'Check out our amazing products and place your order today!',
    socialCaption: 'You deserve the best. Visit our site and see what we have for you.',
    highlights: ['Best quality', 'Low prices']
  });
  const result = validateMarketingOutput(validJson);
  assert.equal(result.tagline, 'Get the best deal today!');
});

test('validateMarketingOutput - rejects missing required keys', () => {
  const invalidPayload = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    // socialCaption is missing
    highlights: ['Best quality', 'Low prices']
  };
  assert.throws(() => validateMarketingOutput(invalidPayload), /missing required key: socialCaption/i);
});

test('validateMarketingOutput - rejects empty required string fields', () => {
  const invalidPayload = {
    tagline: '  ',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['Best quality', 'Low prices']
  };
  assert.throws(() => validateMarketingOutput(invalidPayload), /must be a non-empty string/i);
});

test('validateMarketingOutput - rejects non-array or too short highlights', () => {
  const nonArrayHighlights = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: 'not an array'
  };
  assert.throws(() => validateMarketingOutput(nonArrayHighlights), /must be an array with at least 2 items/i);

  const shortHighlights = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['Only one highlight']
  };
  assert.throws(() => validateMarketingOutput(shortHighlights), /must be an array with at least 2 items/i);
});

test('validateMarketingOutput - rejects empty highlight strings', () => {
  const invalidPayload = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['First highlight', '   ']
  };
  assert.throws(() => validateMarketingOutput(invalidPayload), /must be non-empty strings/i);
});

test('validateMarketingOutput - rejects blocked analyst/reviewer phrases', () => {
  const blocked1 = {
    tagline: 'Hi team, get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['First highlight', 'Second highlight']
  };
  assert.throws(() => validateMarketingOutput(blocked1), /contains blocked reviewer-style phrasing: hi team/i);

  const blocked2 = {
    tagline: 'Get the best deal today!',
    summary: 'We analyzed your website content.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['First highlight', 'Second highlight']
  };
  assert.throws(() => validateMarketingOutput(blocked2), /contains blocked reviewer-style phrasing: we analyzed/i);

  const blocked3 = {
    tagline: 'Get the best deal today!',
    summary: 'A clear value proposition is present here.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'You deserve the best.',
    highlights: ['First highlight', 'Second highlight']
  };
  assert.throws(() => validateMarketingOutput(blocked3), /contains blocked reviewer-style phrasing: a clear value proposition/i);

  const blocked4 = {
    tagline: 'Get the best deal today!',
    summary: 'We offer the finest selection.',
    whatsappMessage: 'Check out our amazing products!',
    socialCaption: 'A polished brand story for everyone.',
    highlights: ['First highlight', 'Second highlight']
  };
  assert.throws(() => validateMarketingOutput(blocked4), /contains blocked reviewer-style phrasing: a polished brand story/i);
});

