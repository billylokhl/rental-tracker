/**
 * Shared helpers used across all UI components.
 * Centralizes HTML escaping, listing URL fallbacks, media parsing,
 * safety-grade classification, and commute lookups so every view agrees.
 */

// Escape scraped/user-provided text before interpolating into innerHTML templates.
// Safe for both element content and quoted attribute values.
export function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Display-only fallback when a listing has no verified permalink.
export function getListingUrl(item) {
  return item.url || `https://www.zillow.com/homes/${encodeURIComponent(`${item.street_address || ''} ${item.city || ''} CA ${item.zip || ''}`.trim())}_rb/`;
}

// Tokenize the comma/newline-separated media album field into http(s) links.
export function parseMediaUrls(mediaStr) {
  return (mediaStr || '').split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
}

// Exact-match safe grades: letter grades B and above, or low crime-rate labels.
// Substring matching is unsafe here ('MODERATE'.includes('A') is true).
const SAFE_GRADES = new Set(['A', 'A+', 'A-', 'B', 'B+', 'VERY LOW', 'LOW']);
export function isSafeGrade(grade) {
  return SAFE_GRADES.has((grade || '').toString().toUpperCase().trim());
}

// The commute destination id comes from campaign config (target_destinations[0]),
// not a hardcoded key — campaigns created via init-campaign use different ids.
let primaryDestinationId = 'intel_sc2';

export function setPrimaryDestinationId(id) {
  if (id) primaryDestinationId = id;
}

export function getCommute(item) {
  return item?.commute?.[primaryDestinationId];
}
