/**
 * ListingCard Component for Visual Card Feed with Live Tour Photos, Media, and Expanded Specs.
 */

import { escapeHtml, getListingUrl, parseMediaUrls, isSafeGrade, getCommute } from './utils.js?v=45';

export function formatUnitBadge(unit) {
  if (!unit) return '';
  const trimmed = unit.trim();
  const withoutUnit = trimmed.replace(/^unit\s+/i, '');
  if (/^(apt|#|plan|suite)/i.test(withoutUnit)) {
    return withoutUnit;
  }
  return `Unit ${withoutUnit}`;
}

export function createListingCard(item, annotation, isCompared, onCardClick, onCompareToggle, onCardHover, onHideToggle) {
  const card = document.createElement('div');
  card.className = 'listing-card';
  card.id = `card-${item.id}`;
  card.setAttribute('data-id', item.id);

  const isHidden = !!annotation.hidden;

  // Commute pill color (0 minutes is a real value, so compare against null/undefined)
  const commute = getCommute(item);
  const commuteMins = commute?.avg_min;
  const hasCommute = commuteMins !== undefined && commuteMins !== null;
  let commuteClass = 'badge-commute';
  if (commuteMins > 25) commuteClass += ' heavy';
  else if (commuteMins > 15) commuteClass += ' moderate';

  // Superfund pill (0 miles is the MOST hazardous case — must not hide the badge)
  const sfDist = item.hazard_proximity?.superfund_mi;
  const hasSfDist = sfDist !== undefined && sfDist !== null;
  const isSfSafe = hasSfDist && sfDist >= 1.5;

  // Crime pill
  const crime = item.crime_safety;
  let crimePill = '';
  if (crime) {
    const crimeClass = isSafeGrade(crime.overall_safety_grade) ? 'badge-safe' : 'badge-warn';
    crimePill = `<span class="badge ${crimeClass}" title="Violent: ${escapeHtml(crime.violent_grade)} | Property: ${escapeHtml(crime.property_grade)}">🛡️ ${escapeHtml(crime.overall_safety_grade)}</span>`;
  }

  // Price / Sqft
  const pricePerSqft = (item.rent_min && item.sqft) ? `$${(item.rent_min / item.sqft).toFixed(2)}/sf` : '';

  // Notes snippet
  const notesText = annotation.highlights || annotation.lowlights || annotation.user_notes;

  // Bed & Bath display
  const bedStr = item.bedrooms === 0 ? 'Studio' : `${escapeHtml(item.bedrooms)} Bed`;
  const bathStr = `${escapeHtml(item.bathrooms)} Bath`;
  const sqftStr = item.sqft ? `${escapeHtml(item.sqft)} sf` : '';

  // Available Date
  const availDate = item.available_date || '';

  // Parking
  const hasParking = !!item.amenities?.parking;
  const parkingInfo = item.amenities?.parking || '';

  // Fees
  const appFee = item.application?.fee;
  const deposit = item.deposit;

  // Listing direct URL
  const listingUrl = getListingUrl(item);

  // Media Album URLs & Photos
  const mediaStr = annotation.media_album_url || item.media_album_url || '';
  const mediaUrls = parseMediaUrls(mediaStr);
  const firstMediaUrl = mediaUrls[0];
  const photos = item.photos || [];
  const coverPhoto = item.cover_photo || photos[0];

  // Check if created within last 72h
  const isNew = item.created_at && (Date.now() - new Date(item.created_at).getTime() < 72 * 3600 * 1000);

  card.innerHTML = `
    ${coverPhoto ? `
      <div style="position: relative; width: 100%; height: 160px; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 0.75rem; background: var(--bg-surface-2);">
        <img src="${escapeHtml(coverPhoto)}" alt="${escapeHtml(item.title)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: #34d399; display: flex; align-items: center; gap: 4px;">
          <span>📸 Tour Photo (${photos.length})</span>
        </div>
      </div>
    ` : ''}

    <div class="card-top-row">
      <div class="card-title-group">
        <div style="display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap;">
          <h3 class="property-title">${escapeHtml(item.title)}</h3>
          ${item.status === 'off-market' ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🛑 Off Market</span>` : ''}
          ${item.unit_number ? `<span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${escapeHtml(formatUnitBadge(item.unit_number))}</span>` : ''}
          ${isNew ? `<span style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">✨ New</span>` : ''}
          <a href="${escapeHtml(listingUrl)}" target="_blank" rel="noopener noreferrer" class="listing-external-link" title="Open original listing" onclick="event.stopPropagation();" style="display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.75rem; color: #38bdf8; text-decoration: underline; font-weight: 600;">
            <span>Listing ↗</span>
          </a>
        </div>
        <p class="property-address">${item.street_address ? `${escapeHtml(item.street_address)}, ` : ''}${escapeHtml(item.city)} ${escapeHtml(item.zip)}</p>
      </div>
      <div class="card-price-group">
        <div class="price-main">${escapeHtml(item.rent_display)}</div>
        <div class="price-sqft">${pricePerSqft}</div>
      </div>
    </div>

    <div class="card-badges-row">
      <span class="badge badge-spec">${bedStr} • ${bathStr} ${sqftStr ? `• ${sqftStr}` : ''}</span>
      ${crimePill}
      ${hasCommute ? `<span class="badge ${commuteClass}">⚡ ${escapeHtml(commuteMins)}m Work (${escapeHtml(commute.range || '')})</span>` : ''}
      ${hasSfDist ? `<span class="badge badge-hazard ${isSfSafe ? 'safe' : ''}">⚠️ ${escapeHtml(sfDist)} mi Superfund</span>` : ''}
      ${availDate ? `<span class="badge badge-spec" style="color: #fbbf24;">📅 ${escapeHtml(availDate)}</span>` : ''}
      ${hasParking ? `<span class="badge badge-spec" style="color: #a78bfa;">🚗 ${escapeHtml(parkingInfo)}</span>` : ''}
      ${appFee ? `<span class="badge badge-spec">💵 App: ${escapeHtml(appFee)}</span>` : ''}
      ${deposit ? `<span class="badge badge-spec">🔒 Dep: ${escapeHtml(deposit)}</span>` : ''}
      ${firstMediaUrl ? `
        <a href="${escapeHtml(firstMediaUrl)}" target="_blank" rel="noopener noreferrer" class="badge" onclick="event.stopPropagation();" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; text-decoration: none; cursor: pointer;">
          📸 Tour Album (${mediaUrls.length}) ↗
        </a>
      ` : ''}
      ${item.amenities?.laundry === 'in-unit' ? '<span class="badge badge-spec" style="color: #38bdf8;">🧺 In-Unit W/D</span>' : ''}
      ${item.amenities?.cooling ? '<span class="badge badge-spec">❄️ ' + escapeHtml(item.amenities.cooling) + '</span>' : ''}
      ${item.pets?.allowed ? '<span class="badge badge-spec">🐾 Pets OK</span>' : ''}
    </div>

    ${notesText ? `<div class="card-notes-preview"><strong>Notes:</strong> ${escapeHtml(notesText)}</div>` : ''}

    <div class="card-footer-row">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
          ⭐ ${escapeHtml(annotation.rating || 'Unrated')}
        </span>
        <span style="text-transform: capitalize; color: ${annotation.visit_status === 'visited' ? '#34d399' : 'var(--text-dim)'};">
          ● ${escapeHtml(annotation.visit_status || 'Unvisited')}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <button class="btn-hide-toggle" data-id="${item.id}" title="${isHidden ? 'Restore to main view' : 'Hide / Dismiss this listing'}" style="background: ${isHidden ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isHidden ? 'rgba(56,189,248,0.3)' : 'var(--border-subtle)'}; color: ${isHidden ? '#38bdf8' : 'var(--text-dim)'}; border-radius: var(--radius-sm); font-size: 0.6875rem; padding: 2px 7px; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; transition: all 0.15s ease;">
          <span>${isHidden ? '👁️ Restore' : '🚫 Hide'}</span>
        </button>
        <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;" onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${isCompared ? 'checked' : ''}>
          <span>Compare</span>
        </label>
      </div>
    </div>
  `;

  card.addEventListener('click', () => onCardClick(item.id));
  card.addEventListener('mouseenter', () => onCardHover && onCardHover(item.id));

  const chk = card.querySelector('.compare-checkbox');
  chk?.addEventListener('change', (e) => onCompareToggle(item.id, e.target.checked));

  const hideBtn = card.querySelector('.btn-hide-toggle');
  hideBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    onHideToggle && onHideToggle(item.id);
  });

  return card;
}
