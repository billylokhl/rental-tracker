/**
 * Pure filter and sort logic for listings.
 * Extracted from the App class for testability.
 */

import { getCommuteMins } from './utils.js';

/**
 * Filter a list of listings based on filter state and annotations.
 * @param {Array} listings - listings with overrides applied
 * @param {object} filterState - current filter bar state
 * @param {function} getAnnotation - (id) => annotation object
 * @param {string} primaryDestId - primary destination ID for commute calculations
 * @returns {Array} filtered listings
 */
export function filterListings(listings, filterState, getAnnotation, primaryDestId) {
  const searchLower = (filterState.search || '').toLowerCase().trim();

  return listings.filter(item => {
    const ann = getAnnotation(item.id);

    // Search match
    if (searchLower) {
      const text = `${item.title} ${item.street_address} ${item.city} ${item.zip} ${item.available_date || ''} ${item.amenities?.parking || ''} ${ann.highlights || ''} ${ann.lowlights || ''} ${ann.user_notes || ''}`.toLowerCase();
      if (!text.includes(searchLower)) return false;
    }

    // Max Rent
    if (filterState.maxRent && filterState.maxRent < 99999) {
      if (item.rent_min && item.rent_min > filterState.maxRent) return false;
    }

    // Max Commute
    if (filterState.maxCommute && filterState.maxCommute < 99) {
      const c = getCommuteMins(item, primaryDestId);
      if (c !== null && c > filterState.maxCommute) return false;
    }

    // Superfund minimum safe distance
    if (filterState.minSuperfundDist && filterState.minSuperfundDist > 0) {
      const sf = item.hazard_proximity?.superfund_mi;
      if (sf !== undefined && sf !== null && sf < filterState.minSuperfundDist) return false;
    }

    // Bedrooms
    if (filterState.bedrooms && filterState.bedrooms !== 'all') {
      const targetBeds = parseFloat(filterState.bedrooms);
      if (targetBeds === 2) {
        if (item.bedrooms < 2) return false;
      } else if (item.bedrooms !== targetBeds) {
        return false;
      }
    }

    // In-Unit Laundry
    if (filterState.inUnitLaundry) {
      if (item.amenities?.laundry !== 'in-unit') return false;
    }

    // A/C
    if (filterState.hasAC) {
      if (!item.amenities?.cooling) return false;
    }

    // Pet Friendly
    if (filterState.petFriendly) {
      if (!item.pets?.allowed) return false;
    }

    // Has Tour Media
    if (filterState.hasMedia) {
      const media = ann.media_album_url || item.media_album_url;
      if (!media) return false;
    }

    // Hide / Dismiss filter
    const isHidden = !!ann.hidden;
    if (filterState.status === 'hidden') {
      if (!isHidden) return false;
    } else {
      if (isHidden) return false;
    }

    // Status
    if (filterState.status && filterState.status !== 'all' && filterState.status !== 'hidden') {
      if (filterState.status === 'shortlisted') {
        if (!ann.rating || ann.rating === 'Pass' || ann.rating === '0') return false;
      } else if (filterState.status === 'visited') {
        if (ann.visit_status !== 'visited') return false;
      }
    }

    return true;
  });
}

/**
 * Sort listings by the given sort key.
 * @param {Array} listings - filtered listings
 * @param {string} sortBy - sort key
 * @param {string} primaryDestId - primary destination ID
 * @returns {Array} sorted copy
 */
export function sortListings(listings, sortBy, primaryDestId) {
  return [...listings].sort((a, b) => {
    switch (sortBy) {
      case 'newest': {
        const aTime = a.created_at ? (new Date(a.created_at).getTime() || 0) : 0;
        const bTime = b.created_at ? (new Date(b.created_at).getTime() || 0) : 0;
        return bTime - aTime;
      }
      case 'rent_asc':
        return (a.rent_min || 99999) - (b.rent_min || 99999);
      case 'rent_desc':
        return (b.rent_min || 0) - (a.rent_min || 0);
      case 'commute_asc':
        return (getCommuteMins(a, primaryDestId) ?? 999) - (getCommuteMins(b, primaryDestId) ?? 999);
      case 'superfund_desc':
        return (b.hazard_proximity?.superfund_mi || 0) - (a.hazard_proximity?.superfund_mi || 0);
      case 'sqft_desc':
        return (b.sqft || 0) - (a.sqft || 0);
      default:
        return 0;
    }
  });
}
