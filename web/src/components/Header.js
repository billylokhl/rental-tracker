/**
 * Header and MetricsBar components with Cloud Sync support.
 */

export function renderHeader(container, campaignConfig, onAddListing, onSync, onExport, onImport, onThemeToggle) {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  
  container.innerHTML = `
    <div class="header-brand">
      <div class="brand-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div>
        <span class="brand-title">${campaignConfig.title || 'Rental Tracker'}</span>
        <span class="brand-badge">${campaignConfig.year || 2026}</span>
      </div>
    </div>
    <div class="header-actions">
      <button id="add-listing-btn" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #10b981, #059669); font-weight: 700;" title="Ingest new rental listing from URL">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>+ Add Listing</span>
      </button>
      <button id="sync-github-btn" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #0284c7, #0ea5e9);" title="Sync changes directly to GitHub">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
        <span>☁️ Sync to GitHub</span>
      </button>
      <button id="export-notes-btn" class="btn-secondary btn-sm" title="Export Annotations to JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Export</span>
      </button>
      <label class="btn-secondary btn-sm" style="cursor: pointer;" title="Import Notes JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>Import</span>
        <input type="file" id="import-notes-input" accept=".json" style="display: none;">
      </label>
      <button id="theme-toggle-btn" class="btn-icon" title="Toggle Dark/Light Mode" aria-label="Toggle theme">
        ${isLight ? '🌙' : '☀️'}
      </button>
    </div>
  `;

  document.getElementById('add-listing-btn')?.addEventListener('click', onAddListing);
  document.getElementById('sync-github-btn')?.addEventListener('click', onSync);
  document.getElementById('export-notes-btn')?.addEventListener('click', onExport);
  document.getElementById('import-notes-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => onImport(ev.target?.result);
      reader.readAsText(file);
    }
  });
  document.getElementById('theme-toggle-btn')?.addEventListener('click', onThemeToggle);
}

export function renderMetricsBar(container, listings = [], annotations = {}) {
  const total = listings.length;
  const rents = listings.map(l => l.rent_min).filter(Boolean);
  const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : 0;
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;

  const commutes = listings.map(l => l.commute?.intel_sc2?.avg_min).filter(Boolean);
  const avgCommute = commutes.length ? Math.round(commutes.reduce((a, b) => a + b, 0) / commutes.length) : 0;

  const shortlisted = Object.values(annotations).filter(a => a.rating && a.rating !== '0').length;
  const visited = Object.values(annotations).filter(a => a.visit_status === 'visited').length;

  container.innerHTML = `
    <div class="metric-pill">
      <span class="label">Properties:</span>
      <span class="val">${total}</span>
    </div>
    <div class="metric-pill">
      <span class="label">Rent Range:</span>
      <span class="val">$${minRent.toLocaleString()} - $${maxRent.toLocaleString()}</span>
    </div>
    <div class="metric-pill">
      <span class="label">Avg Rent:</span>
      <span class="val" style="color: #38bdf8;">$${avgRent.toLocaleString()}/mo</span>
    </div>
    <div class="metric-pill">
      <span class="label">Avg SC2 Commute:</span>
      <span class="val" style="color: #34d399;">${avgCommute} min</span>
    </div>
    <div class="metric-pill">
      <span class="label">Shortlisted:</span>
      <span class="val" style="color: #fbbf24;">${shortlisted}</span>
    </div>
    <div class="metric-pill">
      <span class="label">Visited:</span>
      <span class="val">${visited}</span>
    </div>
  `;
}
