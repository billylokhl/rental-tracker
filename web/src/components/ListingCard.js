/**
 * ListingCard Component for Visual Card Feed with Live Tour Photos, Media, and Expanded Specs.
 */

export function formatUnitBadge(unit) {
  if (!unit) return '';
  const trimmed = unit.trim();
  const withoutUnit = trimmed.replace(/^unit\s+/i, '');
  if (/^(apt|#|plan|suite)/i.test(withoutUnit)) {
    return withoutUnit;
  }
  return `Unit ${withoutUnit}`;
}

export function createListingCard(item, annotation, isCompared, onCardClick, onCompareToggle, onCardHover) {
  const card = document.createElement('div');
  card.className = 'listing-card';
  card.id = `card-${item.id}`;
  card.setAttribute('data-id', item.id);

  // Commute pill color
  const commuteMins = item.commute?.intel_sc2?.avg_min;
  let commuteClass = 'badge-commute';
  if (commuteMins > 25) commuteClass += ' heavy';
  else if (commuteMins > 15) commuteClass += ' moderate';

  // Superfund pill
  const sfDist = item.hazard_proximity?.superfund_mi;
  const isSfSafe = sfDist && sfDist >= 1.5;

  // Price / Sqft
  const pricePerSqft = (item.rent_min && item.sqft) ? `$${(item.rent_min / item.sqft).toFixed(2)}/sf` : '';

  // Notes snippet
  const notesText = annotation.highlights || annotation.lowlights || annotation.user_notes;

  // Bed & Bath display
  const bedStr = item.bedrooms === 0 ? 'Studio' : `${item.bedrooms} Bed`;
  const bathStr = `${item.bathrooms} Bath`;
  const sqftStr = item.sqft ? `${item.sqft} sf` : '';

  // Available Date
  const availDate = item.available_date || '';

  // Parking
  const parkingInfo = item.amenities?.parking;
  const hasParking = parkingInfo && parkingInfo !== 'unspecified' && parkingInfo !== 'none';

  // Application fee & Deposit
  const appFee = item.application?.fee;
  const deposit = item.deposit;

  // Listing URL fallback
  const listingUrl = item.url || `https://www.zillow.com/homes/${encodeURIComponent(item.street_address + ' ' + item.city + ' CA ' + item.zip)}_rb/`;

  // Media Album URLs & Photos
  const mediaStr = annotation.media_album_url || item.media_album_url || '';
  const mediaUrls = mediaStr.split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
  const firstMediaUrl = mediaUrls[0];
  const photos = item.photos || [];
  const coverPhoto = item.cover_photo || photos[0];

  // Check if created within last 72h
  const isNew = item.created_at && (Date.now() - new Date(item.created_at).getTime() < 72 * 3600 * 1000);

  card.innerHTML = `
    ${coverPhoto ? `
      <div style="position: relative; width: 100%; height: 160px; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 0.75rem; background: var(--bg-surface-2);">
        <img src="${coverPhoto}" alt="${item.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;">
        <div style="position: absolute; bottom: 8px; left: 8px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: #34d399; display: flex; align-items: center; gap: 4px;">
          <span>📸 Tour Photo (${photos.length})</span>
        </div>
      </div>
    ` : ''}

    <div class="card-top-row">
      <div class="card-title-group">
        <div style="display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap;">
          <h3 class="property-title">${item.title}</h3>
          ${item.status === 'off-market' ? `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🛑 Off Market</span>` : ''}
          ${item.unit_number ? `<span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${formatUnitBadge(item.unit_number)}</span>` : ''}
          ${isNew ? `<span style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">✨ New</span>` : ''}
          <a href="${listingUrl}" target="_blank" rel="noopener noreferrer" class="listing-external-link" title="Open original listing on Zillow" onclick="event.stopPropagation();" style="display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.75rem; color: #38bdf8; text-decoration: underline; font-weight: 600;">
            <span>Zillow ↗</span>
          </a>
        </div>
        <p class="property-address">${item.street_address ? `${item.street_address}, ` : ''}${item.city} ${item.zip}</p>
      </div>
      <div class="card-price-group">
        <div class="price-main">${item.rent_display}</div>
        <div class="price-sqft">${pricePerSqft}</div>
      </div>
    </div>

    <div class="card-badges-row">
      <span class="badge badge-spec">${bedStr} • ${bathStr} ${sqftStr ? `• ${sqftStr}` : ''}</span>
      ${commuteMins ? `<span class="badge ${commuteClass}">⚡ ${commuteMins}m Work (${item.commute.intel_sc2.range || ''})</span>` : ''}
      ${sfDist ? `<span class="badge badge-hazard ${isSfSafe ? 'safe' : ''}">🛡️ ${sfDist} mi Superfund</span>` : ''}
      ${availDate ? `<span class="badge badge-spec" style="color: #fbbf24;">📅 ${availDate}</span>` : ''}
      ${hasParking ? `<span class="badge badge-spec" style="color: #a78bfa;">🚗 ${parkingInfo}</span>` : ''}
      ${appFee ? `<span class="badge badge-spec">💵 App: ${appFee}</span>` : ''}
      ${deposit ? `<span class="badge badge-spec">🔒 Dep: ${deposit}</span>` : ''}
      ${firstMediaUrl ? `
        <a href="${firstMediaUrl}" target="_blank" rel="noopener noreferrer" class="badge" onclick="event.stopPropagation();" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700; text-decoration: none; cursor: pointer;">
          📸 Tour Album (${mediaUrls.length}) ↗
        </a>
      ` : ''}
      ${item.amenities?.laundry === 'in-unit' ? '<span class="badge badge-spec" style="color: #38bdf8;">🧺 In-Unit W/D</span>' : ''}
      ${item.amenities?.cooling ? '<span class="badge badge-spec">❄️ ' + item.amenities.cooling + '</span>' : ''}
      ${item.pets?.allowed ? '<span class="badge badge-spec">🐾 Pets OK</span>' : ''}
    </div>

    ${notesText ? `<div class="card-notes-preview"><strong>Notes:</strong> ${notesText}</div>` : ''}

    <div class="card-footer-row">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
          ⭐ ${annotation.rating || 'Unrated'}
        </span>
        <span style="text-transform: capitalize; color: ${annotation.visit_status === 'visited' ? '#34d399' : 'var(--text-dim)'};">
          ● ${annotation.visit_status || 'Unvisited'}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
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

  return card;
}
