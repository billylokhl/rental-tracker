/**
 * ListingCard Component for Visual Card Feed.
 */

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

  card.innerHTML = `
    <div class="card-top-row">
      <div class="card-title-group">
        <h3 class="property-title">${item.title}</h3>
        <p class="property-address">${item.street_address}, ${item.city} ${item.zip}</p>
      </div>
      <div class="card-price-group">
        <div class="price-main">${item.rent_display}</div>
        <div class="price-sqft">${pricePerSqft}</div>
      </div>
    </div>

    <div class="card-badges-row">
      <span class="badge badge-spec">${bedStr} • ${bathStr} ${sqftStr ? `• ${sqftStr}` : ''}</span>
      ${commuteMins ? `<span class="badge ${commuteClass}">⚡ ${commuteMins}m SC2 (${item.commute.intel_sc2.range || ''})</span>` : ''}
      ${sfDist ? `<span class="badge badge-hazard ${isSfSafe ? 'safe' : ''}">🛡️ ${sfDist} mi Superfund</span>` : ''}
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
      <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;" onclick="event.stopPropagation();">
        <input type="checkbox" class="compare-checkbox" data-id="${item.id}" ${isCompared ? 'checked' : ''}>
        <span>Compare</span>
      </label>
    </div>
  `;

  card.addEventListener('click', () => onCardClick(item.id));
  card.addEventListener('mouseenter', () => onCardHover && onCardHover(item.id));
  
  const chk = card.querySelector('.compare-checkbox');
  chk?.addEventListener('change', (e) => onCompareToggle(item.id, e.target.checked));

  return card;
}
