/**
 * Header and MetricsBar components with Adaptive Responsive Layout and Cloud Sync.
 */

import { getCommuteMins } from './utils.js?v=45';

export function renderHeader(container, campaignConfig, onAddListing, onSync, onExport, onImport, onThemeToggle) {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const regionTag = campaignConfig.region ? campaignConfig.region.toUpperCase() : 'SOUTH BAY';
  const yearTag = campaignConfig.year || 2026;
  
  container.innerHTML = `
    <div class="header-brand">
      <div class="brand-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div class="brand-text-block">
        <div class="brand-subtitle">${regionTag} ${yearTag}</div>
        <div class="brand-title">Rental Tracker</div>
      </div>
    </div>
    <div class="header-actions">
      <button id="add-listing-btn" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #10b981, #059669); font-weight: 700;" title="Ingest new rental listing from URL">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span class="btn-label-desktop">Add Listing</span>
        <span class="btn-label-mobile">Add</span>
      </button>
      <button id="sync-github-btn" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #0284c7, #0ea5e9);" title="Sync changes directly to GitHub">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
        <span class="btn-label-desktop">Sync to GitHub</span>
        <span class="btn-label-mobile">Sync</span>
      </button>
      <button id="export-notes-btn" class="btn-secondary btn-sm desktop-only-action" title="Export Annotations to JSON">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Export</span>
      </button>
      <label class="btn-secondary btn-sm desktop-only-action" style="cursor: pointer;" title="Import Notes JSON">
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

export function renderMetricsBar(container, listings = [], annotations = {}, onHiddenClick = null) {
  const hiddenCount = Object.values(annotations).filter(a => !!a.hidden).length;
  // Compute metrics on active (non-hidden) listings if available, otherwise on passed listings
  const activeListings = listings.filter(l => !annotations[l.id]?.hidden);
  const targetListings = activeListings.length > 0 ? activeListings : listings;

  const total = targetListings.length;
  const rents = targetListings.map(l => l.rent_min).filter(Boolean);
  const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : 0;
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;
  const maxRentDisplay = maxRent ? `$${maxRent.toLocaleString()}` : '$0';
  const minRentDisplay = minRent ? `$${minRent.toLocaleString()}` : '$0';

  // A 0-minute commute is a real value — filter(Boolean) would drop it and skew the average
  const commutes = targetListings.map(l => getCommuteMins(l)).filter(v => v !== null);
  const avgCommute = commutes.length ? Math.round(commutes.reduce((a, b) => a + b, 0) / commutes.length) : 0;

  const shortlisted = Object.values(annotations).filter(a => a.rating && a.rating !== '0' && !a.hidden).length;
  const visited = Object.values(annotations).filter(a => a.visit_status === 'visited' && !a.hidden).length;

  container.innerHTML = `
    <div class="metric-pill">
      <span class="label">Active Properties:</span>
      <span class="val">${total}</span>
    </div>
    <div class="metric-pill">
      <span class="label">Rent Range:</span>
      <span class="val">${minRentDisplay} - ${maxRentDisplay}</span>
    </div>
    <div class="metric-pill">
      <span class="label">Avg Rent:</span>
      <span class="val" style="color: #38bdf8;">$${avgRent.toLocaleString()}/mo</span>
    </div>
    <div class="metric-pill">
      <span class="label">Avg Work Commute:</span>
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
    ${hiddenCount > 0 ? `
      <div class="metric-pill metric-pill-clickable" id="metrics-hidden-pill" style="cursor: pointer; background: rgba(100, 116, 139, 0.25); border: 1px solid rgba(148, 163, 184, 0.4); transition: all 0.15s ease;" title="Click to view hidden / dismissed listings">
        <span class="label">🚫 Hidden:</span>
        <span class="val" style="color: #38bdf8; font-weight: 700; text-decoration: underline;">${hiddenCount} (Click to View)</span>
      </div>
    ` : ''}
  `;

  if (onHiddenClick) {
    document.getElementById('metrics-hidden-pill')?.addEventListener('click', onHiddenClick);
  }
}
