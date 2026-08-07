export function validateUrl(value) {
  if (typeof value !== 'string') {
    return { valid: false, error: 'A valid http(s) URL is required.' };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { valid: false, error: 'A valid http(s) URL is required.' };
  }

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only http(s) URLs are supported.' };
    }

    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, error: 'Please provide a valid http(s) URL.' };
  }
}
