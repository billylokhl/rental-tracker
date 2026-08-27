import { formatUnitBadge } from './ListingCard.js?v=42';

export function renderTableView(container, listings, annotations, comparedIds, onRowClick, onCompareToggle, onHideToggle) {
  if (!listings.length) {
    container.innerHTML = `<div class="empty-state"><p>No matching candidate properties found.</p></div>`;
    return;
  }

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'data-table-container';

  let rowsHtml = listings.map(item => {
    const ann = annotations[item.id] || {};
    const isComp = comparedIds.has(item.id);
    const isHidden = !!ann.hidden;
    const sfDist = item.hazard_proximity?.superfund_mi ?? '-';
    const commute = item.commute?.intel_sc2?.avg_min ? `${item.commute.intel_sc2.avg_min}m (${item.commute.intel_sc2.range || ''})` : '-';
    
    // Safety
    let safetyHtml = '-';
    if (item.crime_safety && item.crime_safety.overall_safety_grade) {
      const isSafe = ['A', 'A+', 'A-', 'B+', 'B', 'VERY LOW', 'LOW'].some(g => (item.crime_safety.overall_safety_grade?.toUpperCase() || '').includes(g));
      const color = isSafe ? '#34d399' : '#f87171';
      safetyHtml = `<span style="color: ${color}; font-weight: bold;" title="Property: ${item.crime_safety.property_grade} | Violent: ${item.crime_safety.violent_grade}">${item.crime_safety.overall_safety_grade}</span>`;
    }

    const bedBath = `${item.bedrooms}bd / ${item.bathrooms}ba`;
    const avail = item.available_date || '-';
    const parking = item.amenities?.parking || '-';
    const appFee = item.application?.fee || '-';
    const listingUrl = item.url || `https://www.zillow.com/homes/${encodeURIComponent(item.street_address + ' ' + item.city + ' CA ' + item.zip)}_rb/`;

    const mediaStr = ann.media_album_url || item.media_album_url || '';
    const mediaUrls = mediaStr.split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
    const firstMediaUrl = mediaUrls[0];

    return `
      <tr class="table-row" data-id="${item.id}" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="row-compare-chk" data-id="${item.id}" ${isComp ? 'checked' : ''}>
        </td>
        <td><strong>${ann.rating || '-'}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <div style="font-weight: 600; color: var(--text-main);">${item.title}</div>
            ${item.unit_number ? `<span style="font-size: 10px; background: rgba(2,132,199,0.2); color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-weight: 700;">${formatUnitBadge(item.unit_number)}</span>` : ''}
            <a href="${listingUrl}" target="_blank" rel="noopener noreferrer" title="Open listing" onclick="event.stopPropagation();" style="color: #38bdf8; font-size: 11px; text-decoration: underline;">
              Listing ↗
            </a>
            ${firstMediaUrl ? `
              <a href="${firstMediaUrl}" target="_blank" rel="noopener noreferrer" title="View tour album" onclick="event.stopPropagation();" style="color: #34d399; font-size: 11px; text-decoration: underline; font-weight: 700;">
                📸 Media (${mediaUrls.length}) ↗
              </a>
            ` : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">${item.street_address ? `${item.street_address}, ` : ''}${item.city}, ${item.zip}</div>
        </td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${item.rent_display}</td>
        <td>${bedBath}</td>
        <td style="font-family: var(--font-mono);">${item.sqft ? `${item.sqft} sf` : '-'}</td>
        <td style="font-weight: 600; color: #fbbf24;">${avail}</td>
        <td style="font-weight: 600; color: #34d399;">${commute}</td>
        <td>${safetyHtml}</td>
        <td style="color: ${typeof sfDist === 'number' && sfDist < 1.0 ? '#f87171' : 'inherit'};">${sfDist} mi</td>
        <td>${parking}</td>
        <td>${appFee}</td>
        <td>${item.amenities?.laundry || '-'}</td>
        <td>${item.pets?.allowed ? 'Yes' : 'No'}</td>
        <td style="text-transform: capitalize;">${item.status === 'off-market' ? '<span style="color: #f87171; font-weight: 700;">🛑 Off-Market</span>' : (ann.visit_status || 'unvisited')}</td>
        <td onclick="event.stopPropagation();">
          <button class="btn-row-hide" data-id="${item.id}" title="${isHidden ? 'Restore to main view' : 'Hide / Dismiss listing'}" style="background: ${isHidden ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.06)'}; border: 1px solid var(--border-subtle); color: ${isHidden ? '#38bdf8' : 'var(--text-dim)'}; font-size: 11px; padding: 2px 6px; border-radius: 3px; cursor: pointer;">
            ${isHidden ? '👁️ Restore' : '🚫 Hide'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tableWrapper.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Rating</th>
          <th>Property & Address</th>
          <th>Rent</th>
          <th>Beds/Baths</th>
          <th>Sqft</th>
          <th>Available</th>
          <th>Work Commute</th>
          <th>Safety</th>
          <th>Superfund</th>
          <th>Parking</th>
          <th>App Fee</th>
          <th>Laundry</th>
          <th>Pets</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  // Bind clicks
  tableWrapper.querySelectorAll('.table-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (id) onRowClick(id);
    });
  });

  tableWrapper.querySelectorAll('.row-compare-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = chk.getAttribute('data-id');
      if (id) onCompareToggle(id, e.target.checked);
    });
  });

  tableWrapper.querySelectorAll('.btn-row-hide').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) onHideToggle && onHideToggle(id);
    });
  });

  container.innerHTML = '';
  container.appendChild(tableWrapper);
}
