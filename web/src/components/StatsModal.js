/**
 * Insights & Analytics Modal Component.
 */

export function showStatsModal(listings, annotations, onClose) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  // City breakdown
  const cityCounts = {};
  listings.forEach(l => {
    const c = l.city || 'Unknown';
    cityCounts[c] = (cityCounts[c] || 0) + 1;
  });

  const cityListHtml = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([city, count]) => `
      <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.8125rem;">
        <span>${city}</span>
        <span style="font-weight: 700; font-family: var(--font-mono); color: #38bdf8;">${count} listings</span>
      </div>
    `).join('');

  // Superfund proximity breakdown
  let safeCount = 0; // >= 1.5 mi
  let cautionCount = 0; // 1.0 - 1.5 mi
  let closeCount = 0; // < 1.0 mi

  listings.forEach(l => {
    const d = l.hazard_proximity?.superfund_mi;
    if (d !== undefined && d !== null) {
      if (d >= 1.5) safeCount++;
      else if (d >= 1.0) cautionCount++;
      else closeCount++;
    }
  });

  container.innerHTML = `
    <div class="modal-header">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Housing Search Insights</h2>
        <p style="font-size: 0.8125rem; color: var(--text-muted);">Overview of ${listings.length} tracked candidates</p>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md);">
        <h4 style="font-size: 0.875rem; color: #38bdf8; margin-bottom: 0.5rem;">Listings by City</h4>
        ${cityListHtml}
      </div>

      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md);">
        <h4 style="font-size: 0.875rem; color: #38bdf8; margin-bottom: 0.5rem;">Superfund Safety Distribution</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8125rem;">
          <div style="display: flex; justify-content: space-between;">
            <span>🛡️ Safe (&gt; 1.5 mi):</span>
            <span style="color: #34d399; font-weight: 700;">${safeCount} properties</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>⚠️ Moderate (1.0 - 1.5 mi):</span>
            <span style="color: #fbbf24; font-weight: 700;">${cautionCount} properties</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>🚨 Close (&lt; 1.0 mi):</span>
            <span style="color: #f87171; font-weight: 700;">${closeCount} properties</span>
          </div>
        </div>
      </div>
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
