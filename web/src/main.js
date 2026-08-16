/**
 * Main Web Application Entry Point.
 * Orchestrates data loading, filter state, map synchronization, and responsive mobile/desktop UI.
 */

import { AnnotationManager } from './components/AnnotationManager.js';
import { MapEngine } from './components/MapEngine.js';
import { renderHeader, renderMetricsBar } from './components/Header.js';
import { FilterBar } from './components/FilterBar.js';
import { createListingCard } from './components/ListingCard.js';
import { renderTableView } from './components/TableView.js';
import { showDetailModal } from './components/DetailModal.js';
import { showCompareModal } from './components/CompareModal.js';
import { showStatsModal } from './components/StatsModal.js';

class App {
  constructor() {
    this.campaignData = null;
    this.annotationManager = null;
    this.mapEngine = null;
    this.filterBar = null;
    
    this.viewMode = 'cards'; // 'cards' | 'table'
    this.comparedIds = new Set();
    this.activeListingId = null;

    this.init();
  }

  async init() {
    try {
      // 1. Fetch compiled campaign bundle
      const resp = await fetch('./public/data/campaign_data.json').catch(() => fetch('./data/campaign_data.json'));
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      this.campaignData = await resp.json();
    } catch (e) {
      console.warn('Fallback: attempting direct campaign data fetch...', e);
      try {
        const resp2 = await fetch('./public/data/campaign_data.json');
        this.campaignData = await resp2.json();
      } catch (err) {
        document.getElementById('listings-container').innerHTML = `
          <div class="empty-state">
            <h3>Unable to load campaign data</h3>
            <p>Please make sure you have run <code>python -m pipeline.cli build</code> to generate the dataset.</p>
          </div>
        `;
        return;
      }
    }

    const { campaign, destinations, hazards, pois, listings, annotations } = this.campaignData;

    // 2. Initialize Annotation Manager
    this.annotationManager = new AnnotationManager(campaign.id);
    this.annotationManager.mergeInitial(annotations);

    // 3. Initialize Map Engine
    this.mapEngine = new MapEngine('map-element', campaign, (listingId) => {
      this.handleSelectListing(listingId, true);
    });

    this.mapEngine.renderDestinations(destinations);
    this.mapEngine.renderHazards(hazards, true);
    this.mapEngine.renderPois(pois);

    // 4. Setup Map Layer Drawer Options
    this.setupLayerDrawer(hazards, pois);

    // 5. Render Header & Metrics Bar
    this.renderHeaderAndMetrics();

    // 6. Initialize Filter Bar
    const filterContainer = document.getElementById('filter-container');
    this.filterBar = new FilterBar(filterContainer, () => this.applyFiltersAndRender());

    // 7. Setup View Controls & Mobile Nav
    this.setupGlobalControls();

    // 8. Initial Render of Listings & Map Pins
    this.applyFiltersAndRender();

    // Listen to annotation updates
    window.addEventListener('annotations-updated', () => {
      this.renderHeaderAndMetrics();
      this.applyFiltersAndRender();
    });
  }

  renderHeaderAndMetrics() {
    const headerContainer = document.getElementById('header-container');
    const metricsContainer = document.getElementById('metrics-bar');

    renderHeader(
      headerContainer,
      this.campaignData.campaign,
      () => this.annotationManager.exportJson(),
      (importedJson) => this.annotationManager.importJson(importedJson),
      () => this.toggleTheme()
    );

    renderMetricsBar(
      metricsContainer,
      this.campaignData.listings,
      this.annotationManager.annotations
    );
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.renderHeaderAndMetrics();
  }

  setupLayerDrawer(hazards = [], pois = []) {
    const optionsContainer = document.getElementById('layer-options-container');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = `
      <label class="layer-checkbox-item">
        <input type="checkbox" id="layer-prop-chk" checked>
        <span>Candidate Properties (${this.campaignData.listings.length})</span>
      </label>
      <label class="layer-checkbox-item">
        <input type="checkbox" id="layer-dest-chk" checked>
        <span>Workplace / Intel SC2 (1)</span>
      </label>
      <label class="layer-checkbox-item">
        <input type="checkbox" id="layer-hazard-chk" checked>
        <span>Superfund Risk Zones (${hazards.length})</span>
      </label>
      <label class="layer-checkbox-item">
        <input type="checkbox" id="layer-transit-chk" checked>
        <span>Transit Stations (${pois.filter(p => p.category === 'transit').length})</span>
      </label>
      <label class="layer-checkbox-item">
        <input type="checkbox" id="layer-grocery-chk" checked>
        <span>Groceries & Stores (${pois.filter(p => p.category === 'grocery').length})</span>
      </label>
    `;

    document.getElementById('layer-toggle-btn')?.addEventListener('click', () => {
      document.getElementById('layer-menu-popup')?.classList.toggle('hidden');
    });

    document.getElementById('close-layer-menu')?.addEventListener('click', () => {
      document.getElementById('layer-menu-popup')?.classList.add('hidden');
    });

    // Checkbox toggles
    document.getElementById('layer-prop-chk')?.addEventListener('change', (e) => this.mapEngine.toggleLayer('properties', e.target.checked));
    document.getElementById('layer-dest-chk')?.addEventListener('change', (e) => this.mapEngine.toggleLayer('destinations', e.target.checked));
    document.getElementById('layer-hazard-chk')?.addEventListener('change', (e) => this.mapEngine.toggleLayer('hazards', e.target.checked));
    document.getElementById('layer-transit-chk')?.addEventListener('change', (e) => this.mapEngine.toggleLayer('transit', e.target.checked));
    document.getElementById('layer-grocery-chk')?.addEventListener('change', (e) => this.mapEngine.toggleLayer('grocery', e.target.checked));
  }

  setupGlobalControls() {
    // View mode switchers
    const cardBtn = document.getElementById('view-cards-btn');
    const tableBtn = document.getElementById('view-table-btn');

    cardBtn?.addEventListener('click', () => {
      this.viewMode = 'cards';
      cardBtn.classList.add('active');
      tableBtn?.classList.remove('active');
      this.applyFiltersAndRender();
    });

    tableBtn?.addEventListener('click', () => {
      this.viewMode = 'table';
      tableBtn.classList.add('active');
      cardBtn?.classList.remove('active');
      this.applyFiltersAndRender();
    });

    // Compare button
    document.getElementById('view-compare-btn')?.addEventListener('click', () => {
      const selected = this.campaignData.listings.filter(l => this.comparedIds.has(l.id));
      showCompareModal(selected, this.annotationManager.annotations, () => {});
    });

    // Mobile Bottom Navigation Tabs
    document.querySelectorAll('.mobile-bottom-nav .nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mobile-bottom-nav .nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const nav = tab.getAttribute('data-nav');
        const appContainer = document.getElementById('app');

        if (nav === 'map') {
          appContainer.classList.add('mobile-view-map');
          setTimeout(() => this.mapEngine.map.invalidateSize(), 200);
        } else if (nav === 'list') {
          appContainer.classList.remove('mobile-view-map');
        } else if (nav === 'stats') {
          showStatsModal(this.campaignData.listings, this.annotationManager.annotations, () => {});
        } else if (nav === 'filters') {
          // Scroll to top of filters
          document.getElementById('filter-container')?.scrollIntoView({ behavior: 'smooth' });
          appContainer.classList.remove('mobile-view-map');
        }
      });
    });
  }

  applyFiltersAndRender() {
    if (!this.campaignData) return;

    const filterState = this.filterBar ? this.filterBar.getState() : {};
    const searchLower = (filterState.search || '').toLowerCase().trim();

    let filtered = this.campaignData.listings.filter(item => {
      const ann = this.annotationManager.get(item.id);

      // Search match
      if (searchLower) {
        const text = `${item.title} ${item.street_address} ${item.city} ${item.zip} ${ann.highlights} ${ann.lowlights} ${ann.user_notes}`.toLowerCase();
        if (!text.includes(searchLower)) return false;
      }

      // Max Commute
      if (filterState.maxCommute && filterState.maxCommute < 90) {
        const c = item.commute?.intel_sc2?.avg_min;
        if (c && c > filterState.maxCommute) return false;
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

      // Status
      if (filterState.status && filterState.status !== 'all') {
        if (filterState.status === 'shortlisted') {
          if (!ann.rating || ann.rating === 'Pass' || ann.rating === '0') return false;
        } else if (filterState.status === 'visited') {
          if (ann.visit_status !== 'visited') return false;
        }
      }

      return true;
    });

    // Sorting
    const sort = filterState.sortBy || 'rent_asc';
    filtered.sort((a, b) => {
      if (sort === 'rent_asc') return (a.rent_min || 99999) - (b.rent_min || 99999);
      if (sort === 'rent_desc') return (b.rent_min || 0) - (a.rent_min || 0);
      if (sort === 'commute_asc') return (a.commute?.intel_sc2?.avg_min || 999) - (b.commute?.intel_sc2?.avg_min || 999);
      if (sort === 'superfund_desc') return (b.hazard_proximity?.superfund_mi || 0) - (a.hazard_proximity?.superfund_mi || 0);
      if (sort === 'sqft_desc') return (b.sqft || 0) - (a.sqft || 0);
      return 0;
    });

    // Update results count
    const countEl = document.getElementById('results-count');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${this.campaignData.listings.length} candidate properties`;
    }

    // Render list or table
    const container = document.getElementById('listings-container');
    container.innerHTML = '';

    if (this.viewMode === 'cards') {
      if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No candidate properties match your active filters.</p></div>`;
      } else {
        filtered.forEach(item => {
          const ann = this.annotationManager.get(item.id);
          const isCompared = this.comparedIds.has(item.id);
          const card = createListingCard(
            item,
            ann,
            isCompared,
            (id) => this.handleSelectListing(id, false),
            (id, checked) => this.handleToggleCompare(id, checked),
            (id) => this.mapEngine.highlightProperty(id)
          );
          container.appendChild(card);
        });
      }
    } else {
      renderTableView(
        container,
        filtered,
        this.annotationManager.annotations,
        this.comparedIds,
        (id) => this.handleSelectListing(id, false),
        (id, checked) => this.handleToggleCompare(id, checked)
      );
    }

    // Update map markers with filtered listings
    this.mapEngine.renderProperties(filtered, this.activeListingId);
  }

  handleSelectListing(listingId, fromMap = false) {
    this.activeListingId = listingId;
    const item = this.campaignData.listings.find(l => l.id === listingId);
    if (!item) return;

    // Highlight map marker
    this.mapEngine.highlightProperty(listingId);

    // If on mobile map view, show mobile sheet preview
    const mobileSheet = document.getElementById('mobile-sheet-preview');
    if (window.innerWidth < 768 && document.getElementById('app').classList.contains('mobile-view-map') && mobileSheet) {
      const ann = this.annotationManager.get(listingId);
      mobileSheet.classList.remove('hidden');
      mobileSheet.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${item.title}</h4>
            <div style="font-size: 0.8125rem; color: var(--text-dim);">${item.street_address}, ${item.city}</div>
          </div>
          <div style="font-size: 1.125rem; font-weight: 800; font-family: var(--font-mono); color: #38bdf8;">${item.rent_display}</div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button id="mobile-sheet-details-btn" class="btn-primary btn-sm" style="flex: 1;">View Details & Notes</button>
          <button id="mobile-sheet-close-btn" class="btn-secondary btn-sm">Close</button>
        </div>
      `;
      document.getElementById('mobile-sheet-close-btn')?.addEventListener('click', () => mobileSheet.classList.add('hidden'));
      document.getElementById('mobile-sheet-details-btn')?.addEventListener('click', () => {
        showDetailModal(item, ann, (id, data) => this.annotationManager.set(id, data), () => {});
      });
      return;
    }

    // Show Detail Modal
    const ann = this.annotationManager.get(listingId);
    showDetailModal(
      item,
      ann,
      (id, data) => this.annotationManager.set(id, data),
      () => {}
    );
  }

  handleToggleCompare(listingId, checked) {
    if (checked) {
      if (this.comparedIds.size >= 4) {
        alert('You can compare up to 4 properties simultaneously.');
        this.applyFiltersAndRender();
        return;
      }
      this.comparedIds.add(listingId);
    } else {
      this.comparedIds.delete(listingId);
    }
    const countEl = document.getElementById('compare-count');
    if (countEl) countEl.textContent = this.comparedIds.size;
  }
}

// Instantiate App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
