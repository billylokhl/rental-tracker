/**
 * Shared utility helpers.
 * All functions are pure — no module-level mutable state.
 */

/** Returns the canonical listing URL from a listing object. */
export function getListingUrl(item) {
  return item.url || item.listing_url || '#';
}

/** Parses a media album URL string into an array of URLs (comma or newline separated). */
export function parseMediaUrls(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return [];
  return rawStr.split(/[,\n]+/).map(u => u.trim()).filter(Boolean);
}

/** Returns true if the superfund proximity grade is considered safe (B or better). */
export function isSafeGrade(grade) {
  if (!grade) return true;
  const g = grade.toUpperCase();
  return g === 'A+' || g === 'A' || g === 'B' || g === 'A-' || g === 'B+';
}

/**
 * Returns commute minutes to the primary destination.
 * @param {object} item - listing object
 * @param {string} primaryDestId - destination id from campaign config
 * @returns {number|null}
 */
export function getCommuteMins(item, primaryDestId) {
  const commutes = item.commute_times || {};
  const entry = commutes[primaryDestId];
  if (entry && entry.drive_minutes != null) return entry.drive_minutes;
  // Fallback: first available destination
  const keys = Object.keys(commutes);
  if (keys.length > 0 && commutes[keys[0]].drive_minutes != null) {
    return commutes[keys[0]].drive_minutes;
  }
  return null;
}

/**
 * Returns a human-readable commute string.
 * @param {object} item - listing object
 * @param {string} primaryDestId - destination id from campaign config
 * @returns {string}
 */
export function getCommute(item, primaryDestId) {
  const mins = getCommuteMins(item, primaryDestId);
  if (mins === null) return 'N/A';
  return `${Math.round(mins)} min`;
}

/** Format a unit badge label from bedrooms and unit number. */
export function formatUnitBadge(item) {
  const parts = [];
  if (item.bedrooms != null) {
    parts.push(item.bedrooms === 0 ? 'Studio' : `${item.bedrooms}BR`);
  }
  if (item.bathrooms != null) parts.push(`${item.bathrooms}BA`);
  if (item.sqft) parts.push(`${item.sqft.toLocaleString()} sqft`);
  return parts.join(' · ');
}
