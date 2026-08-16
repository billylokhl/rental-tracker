/**
 * Side-by-Side Comparison Matrix Modal Component.
 */

export function showCompareModal(comparedListings, annotations, onClose) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  if (comparedListings.length === 0) {
    alert('Please select at least 1 or 2 properties using the "Compare" checkbox first!');
    return;
  }

  const columnsHtml = comparedListings.map(item => {
    const ann = annotations[item.id] || {};
    const sfDist = item.hazard_proximity?.superfund_mi ?? 'N/A';
    const commute = item.commute?.intel_sc2?.avg_min ? `${item.commute.intel_sc2.avg_min}m (${item.commute.intel_sc2.range || ''})` : 'N/A';
    const priceSqft = (item.rent_min && item.sqft) ? `$${(item.rent_min / item.sqft).toFixed(2)}/sf` : 'N/A';

    return `
      <div style="flex: 1; min-width: 200px; background: var(--bg-surface-2); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
        <div>
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); line-height: 1.3;">${item.title}</h4>
          <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px;">${item.city}, CA ${item.zip}</p>
        </div>

        <div style="background: var(--bg-surface-1); padding: 0.5rem; border-radius: var(--radius-sm);">
          <div style="font-size: 1.125rem; font-weight: 800; font-family: var(--font-mono); color: #38bdf8;">${item.rent_display}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${priceSqft}</div>
        </div>

        <div style="font-size: 0.8125rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <div><strong>⚡ SC2 Commute:</strong> <span style="color: #34d399;">${commute}</span></div>
          <div><strong>🛡️ Superfund:</strong> <span style="color: #f87171;">${sfDist} mi</span></div>
          <div><strong>📐 Layout:</strong> ${item.bedrooms}bd / ${item.bathrooms}ba (${item.sqft ? `${item.sqft} sf` : 'N/A'})</div>
          <div><strong>🧺 Laundry:</strong> ${item.amenities?.laundry || 'N/A'}</div>
          <div><strong>❄️ Cooling:</strong> ${item.amenities?.cooling || 'None'}</div>
          <div><strong>🚗 Parking:</strong> ${item.amenities?.parking || 'Unspecified'}</div>
          <div><strong>🐾 Pets:</strong> ${item.pets?.allowed ? `Yes (${item.pets?.monthly_fee || 'fees apply'})` : 'No'}</div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.5rem; font-size: 0.75rem;">
          <div><strong>Rating:</strong> ⭐ ${ann.rating || 'Unrated'}</div>
          <div style="margin-top: 2px;"><strong>Status:</strong> ${ann.visit_status || 'Unvisited'}</div>
          ${ann.highlights ? `<div style="margin-top: 4px; color: #34d399;"><strong>Pros:</strong> ${ann.highlights}</div>` : ''}
          ${ann.lowlights ? `<div style="margin-top: 2px; color: #f87171;"><strong>Cons:</strong> ${ann.lowlights}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="modal-header">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Side-by-Side Comparison</h2>
        <p style="font-size: 0.8125rem; color: var(--text-muted);">Comparing ${comparedListings.length} candidate properties</p>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <div style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem;">
      ${columnsHtml}
    </div>
  `;

  backdrop.classList.remove('hidden');
  container.classList.remove('hidden');

  const closeFn = () => {
    backdrop.classList.add('hidden');
    container.classList.add('hidden');
    onClose && onClose();
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', closeFn);
  backdrop.onclick = closeFn;
}
