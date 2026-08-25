/**
 * Main Web Application Entry Point.
 * Orchestrates data loading, filter state, map synchronization, and responsive mobile/desktop UI.
 */

import { AnnotationManager } from './components/AnnotationManager.js?v=36';
import { MapEngine } from './components/MapEngine.js?v=36';
import { renderHeader, renderMetricsBar } from './components/Header.js?v=36';
import { FilterBar } from './components/FilterBar.js?v=36';
import { createListingCard } from './components/ListingCard.js?v=36';
import { renderTableView } from './components/TableView.js?v=36';
import { showDetailModal } from './components/DetailModal.js?v=36';
import { showCompareModal } from './components/CompareModal.js?v=36';
import { showStatsModal } from './components/StatsModal.js?v=36';
import { GitHubSync } from './components/GitHubSync.js?v=36';
import { showSyncModal } from './components/SyncModal.js?v=36';
import { showAddListingModal } from './components/AddListingModal.js?v=36';

class App {
  constructor() {
    this.campaignData = null;
    this.annotationManager = null;
    this.mapEngine = null;
    this.filterBar = null;
    this.gitHubSync = new GitHubSync();
    
    this.viewMode = 'cards'; // 'cards' | 'table'
    this.comparedIds = new Set();
    this.activeListingId = null;

    this.init();
  }

  async init() {
    try {
      // 1. Fetch compiled campaign bundle with cache busting
      const cacheBust = `?t=${Date.now()}`;
      let resp = await fetch(`./data/campaign_data.json${cacheBust}`).catch(() => null);
      if (!resp || !resp.ok) {
        resp = await fetch(`./public/data/campaign_data.json${cacheBust}`).catch(() => null);
      }
      if (!resp || !resp.ok) {
        throw new Error(`HTTP error fetching campaign data`);
      }
      this.campaignData = await resp.json();
    } catch (e) {
      console.error('Error loading campaign data:', e);
      document.getElementById('listings-container').innerHTML = `
        <div class="empty-state">
          <h3>Unable to load campaign data</h3>
          <p>Please make sure the dataset is compiled and available at <code>data/campaign_data.json</code>.</p>
        </div>
      `;
      return;
    }

    const { campaign, destinations, hazards, pois, odor_zones, listings, annotations } = this.campaignData;

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
    this.mapEngine.renderOdorZone(odor_zones);
    this.mapEngine.renderCrimeZones(this.campaignData.crime_data);

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
    const currentListings = this.annotationManager.applyOverridesAndUnits(this.campaignData.listings);

    renderHeader(
      headerContainer,
      this.campaignData.campaign,
      () => this.handleAddListing(),
      () => this.handleSyncToGitHub(),
      () => this.annotationManager.exportJson(),
      (importedJson) => this.annotationManager.importJson(importedJson),
      () => this.toggleTheme()
    );

    renderMetricsBar(
      metricsContainer,
      currentListings,
      this.annotationManager.annotations
    );
  }

  handleAddListing() {
    const campaignId = this.campaignData.campaign.id || '2026-south-bay';
    showAddListingModal(this.gitHubSync, campaignId, (url) => {
      console.log('Listing ingestion dispatched for URL:', url);
    });
  }

  handleSyncToGitHub() {
    showSyncModal(
      this.gitHubSync,
      async () => {
        const campaignId = this.campaignData.campaign.id || '2026-south-bay';
        await this.gitHubSync.syncAnnotations(campaignId, this.annotationManager.annotations);
      },
      () => {}
    );
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.renderHeaderAndMetrics();
  }

  setupLayerDrawer() {
    const toggleBtn = document.getElementById('layer-toggle-btn');
    const popup = document.getElementById('layer-menu-popup');
    const closeBtn = document.getElementById('close-layer-menu');
    const container = document.getElementById('layer-options-container');

    if (!toggleBtn || !popup) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.classList.toggle('hidden');
    });

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      popup.classList.add('hidden');
    });

    // Close when clicking outside popup
    document.addEventListener('click', (e) => {
      if (!popup.classList.contains('hidden') && !popup.contains(e.target) && e.target !== toggleBtn && !toggleBtn.contains(e.target)) {
        popup.classList.add('hidden');
      }
    });

    if (container) {
      container.innerHTML = `
        <label class="layer-checkbox-item">
          <input type="checkbox" id="layer-prop-chk" checked>
          <span>🏠 Rental Properties</span>
        </label>
        <label class="layer-checkbox-item">
          <input type="checkbox" id="layer-dest-chk" checked>
          <span>★ Work Destination</span>
        </label>

        <!-- Nested Crime Map Group -->
        <div class="layer-nested-group">
          <label class="layer-checkbox-item">
            <input type="checkbox" id="layer-crime-chk">
            <span><strong>🛡️ Crime & Safety Overlay</strong></span>
          </label>
          <div class="nested-sub-options disabled" id="crime-sub-options">
            <label class="layer-checkbox-subitem">
              <input type="radio" name="crime-mode" value="property" checked>
              <span>🚗 Vehicle & Property Crime</span>
            </label>
            <label class="layer-checkbox-subitem">
              <input type="radio" name="crime-mode" value="violent">
              <span>🚶 Violent Crime & Safety</span>
            </label>
            <label class="layer-checkbox-subitem">
              <input type="radio" name="crime-mode" value="overall">
              <span>🌐 Overall Safety Grade</span>
            </label>
          </div>
        </div>

        <!-- Nested Superfund Sites Group (Off by default) -->
        <div class="layer-nested-group">
          <label class="layer-checkbox-item">
            <input type="checkbox" id="layer-hazard-chk">
            <span><strong>⚠️ Superfund Sites</strong></span>
          </label>
          <div class="nested-sub-options disabled" id="superfund-sub-options">
            <label class="layer-checkbox-subitem">
              <input type="checkbox" id="layer-hazard-1mi-chk" checked>
              <span>🔴 1.0 mi Buffer (Caution)</span>
            </label>
            <label class="layer-checkbox-subitem">
              <input type="checkbox" id="layer-hazard-2mi-chk" checked>
              <span>🟡 2.0 mi Buffer (Advisory)</span>
            </label>
          </div>
        </div>

        <label class="layer-checkbox-item">
          <input type="checkbox" id="layer-transit-chk" checked>
          <span>🚆 Transit Stations</span>
        </label>
        <label class="layer-checkbox-item">
          <input type="checkbox" id="layer-grocery-chk" checked>
          <span>🛒 Grocery & Asian Markets</span>
        </label>
        <!-- Nested Odor Zones Group (Off by default) -->
        <div class="layer-nested-group">
          <label class="layer-checkbox-item">
            <input type="checkbox" id="layer-odor-chk">
            <span><strong>💨 Milpitas Odor Zones</strong></span>
          </label>
          <div class="nested-sub-options disabled" id="odor-sub-options">
            <label class="layer-checkbox-subitem">
              <input type="checkbox" id="layer-odor-strong-chk" checked>
              <span>🟣 High Impact Zone (Frequent)</span>
            </label>
            <label class="layer-checkbox-subitem">
              <input type="checkbox" id="layer-odor-mild-chk" checked>
              <span>🟠 Mild Advisory Zone (1101 Main)</span>
            </label>
          </div>
        </div>
      `;

      const hazardMasterChk = document.getElementById('layer-hazard-chk');
      const hazard1MiChk = document.getElementById('layer-hazard-1mi-chk');
      const hazard2MiChk = document.getElementById('layer-hazard-2mi-chk');
      const subOptionsContainer = document.getElementById('superfund-sub-options');

      const syncSuperfundLayers = () => {
        const isMasterOn = hazardMasterChk ? hazardMasterChk.checked : false;
        const is1MiOn = hazard1MiChk ? hazard1MiChk.checked : true;
        const is2MiOn = hazard2MiChk ? hazard2MiChk.checked : true;

        if (subOptionsContainer) {
          if (isMasterOn) {
            subOptionsContainer.classList.remove('disabled');
          } else {
            subOptionsContainer.classList.add('disabled');
          }
        }

        if (this.mapEngine?.setSuperfundState) {
          this.mapEngine.setSuperfundState({
            enabled: isMasterOn,
            show1Mi: is1MiOn,
            show2Mi: is2MiOn
          });
        }
      };

      const odorMasterChk = document.getElementById('layer-odor-chk');
      const odorStrongChk = document.getElementById('layer-odor-strong-chk');
      const odorMildChk = document.getElementById('layer-odor-mild-chk');
      const odorSubOptionsContainer = document.getElementById('odor-sub-options');

      const syncOdorLayers = () => {
        const isMasterOn = odorMasterChk ? odorMasterChk.checked : false;
        const isStrongOn = odorStrongChk ? odorStrongChk.checked : true;
        const isMildOn = odorMildChk ? odorMildChk.checked : true;

        if (odorSubOptionsContainer) {
          if (isMasterOn) {
            odorSubOptionsContainer.classList.remove('disabled');
          } else {
            odorSubOptionsContainer.classList.add('disabled');
          }
        }

        if (this.mapEngine?.setOdorState) {
          this.mapEngine.setOdorState({
            enabled: isMasterOn,
            showStrong: isStrongOn,
            showMild: isMildOn
          });
        }
      };

      const crimeMasterChk = document.getElementById('layer-crime-chk');
      const crimeModeRadios = document.querySelectorAll('input[name="crime-mode"]');
      const crimeSubOptionsContainer = document.getElementById('crime-sub-options');

      const syncCrimeLayers = () => {
        const isMasterOn = crimeMasterChk ? crimeMasterChk.checked : false;
        let selectedMode = 'property';
        crimeModeRadios.forEach(r => { if (r.checked) selectedMode = r.value; });

        if (crimeSubOptionsContainer) {
          if (isMasterOn) {
            crimeSubOptionsContainer.classList.remove('disabled');
          } else {
            crimeSubOptionsContainer.classList.add('disabled');
          }
        }

        if (this.mapEngine?.setCrimeState) {
          this.mapEngine.setCrimeState({
            enabled: isMasterOn,
            mode: selectedMode
          });
        }
      };


      document.getElementById('layer-prop-chk')?.addEventListener('change', (e) => {
        this.mapEngine?.toggleLayer('properties', e.target.checked);
      });
      document.getElementById('layer-dest-chk')?.addEventListener('change', (e) => {
        this.mapEngine?.toggleLayer('destinations', e.target.checked);
      });
      hazardMasterChk?.addEventListener('change', syncSuperfundLayers);
      hazard1MiChk?.addEventListener('change', syncSuperfundLayers);
      hazard2MiChk?.addEventListener('change', syncSuperfundLayers);

      document.getElementById('layer-transit-chk')?.addEventListener('change', (e) => {
        this.mapEngine?.toggleLayer('transit', e.target.checked);
      });
      document.getElementById('layer-grocery-chk')?.addEventListener('change', (e) => {
        this.mapEngine?.toggleLayer('grocery', e.target.checked);
      });

      odorMasterChk?.addEventListener('change', syncOdorLayers);
      odorStrongChk?.addEventListener('change', syncOdorLayers);
      odorMildChk?.addEventListener('change', syncOdorLayers);

      crimeMasterChk?.addEventListener('change', syncCrimeLayers);
      crimeModeRadios.forEach(r => r.addEventListener('change', syncCrimeLayers));
    }
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
      const currentListings = this.annotationManager.applyOverridesAndUnits(this.campaignData.listings);
      const selected = currentListings.filter(l => this.comparedIds.has(l.id));
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
          const currentListings = this.annotationManager.applyOverridesAndUnits(this.campaignData.listings);
          showStatsModal(currentListings, this.annotationManager.annotations, () => {});
        } else if (nav === 'filters') {
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
    const currentListings = this.annotationManager.applyOverridesAndUnits(this.campaignData.listings);

    let filtered = currentListings.filter(item => {
      const ann = this.annotationManager.get(item.id);

      // Search match
      if (searchLower) {
        const text = `${item.title} ${item.street_address} ${item.city} ${item.zip} ${item.available_date || ''} ${item.amenities?.parking || ''} ${ann.highlights} ${ann.lowlights} ${ann.user_notes}`.toLowerCase();
        if (!text.includes(searchLower)) return false;
      }

      // Max Rent
      if (filterState.maxRent && filterState.maxRent < 99999) {
        if (item.rent_min && item.rent_min > filterState.maxRent) return false;
      }

      // Max Commute
      if (filterState.maxCommute && filterState.maxCommute < 99) {
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

    // Update hidden count on FilterBar
    if (this.filterBar) {
      this.filterBar.setHiddenCount(this.annotationManager.getHiddenCount());
    }

    // Sorting
    const sort = filterState.sortBy || 'rent_asc';
    filtered.sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
      countEl.textContent = `Showing ${filtered.length} of ${currentListings.length} candidate properties`;
    }

    // Render Listings Pane
    const container = document.getElementById('listings-container');
    container.innerHTML = '';

    if (this.viewMode === 'cards') {
      if (!filtered.length) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <h3>No listings match your filters</h3>
            <p>Try clearing some filters or expanding your search radius.</p>
          </div>
        `;
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
            (id) => this.mapEngine.highlightProperty(id),
            (id) => this.handleToggleHide(id)
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
        (id, checked) => this.handleToggleCompare(id, checked),
        (id) => this.handleToggleHide(id)
      );
    }

    // Update map markers with filtered listings
    this.mapEngine.renderProperties(filtered, this.activeListingId);
  }

  handleToggleHide(listingId) {
    this.annotationManager.toggleHidden(listingId);
    this.renderMetrics();
    this.applyFiltersAndRender();
  }

  handleSelectListing(listingId, fromMap = false) {
    this.activeListingId = listingId;
    const currentListings = this.annotationManager.applyOverridesAndUnits(this.campaignData.listings);
    const item = currentListings.find(l => l.id === listingId);
    if (!item) return;

    // Highlight map marker
    this.mapEngine.highlightProperty(listingId);

    // If on mobile map view, show mobile sheet preview
    const mobileSheet = document.getElementById('mobile-sheet-preview');
    if (window.innerWidth < 768 && document.getElementById('app').classList.contains('mobile-view-map') && mobileSheet) {
      const ann = this.annotationManager.get(listingId);
      const listingUrl = item.url || `https://www.zillow.com/homes/${encodeURIComponent(item.street_address + ' ' + item.city + ' CA ' + item.zip)}_rb/`;
      const mediaUrls = (ann.media_album_url || '').split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
      const firstMedia = mediaUrls[0];

      mobileSheet.classList.remove('hidden');
      mobileSheet.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">${item.title}</h4>
              <a href="${listingUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #38bdf8; text-decoration: underline;">Zillow ↗</a>
              ${firstMedia ? `<a href="${firstMedia}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #34d399; text-decoration: underline; font-weight: 700;">📸 Media ↗</a>` : ''}
            </div>
            <div style="font-size: 0.8125rem; color: var(--text-dim);">${item.street_address ? `${item.street_address}, ` : ''}${item.city}</div>
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
        showDetailModal(
          item,
          ann,
          (id, data) => this.annotationManager.set(id, data),
          (id, overrides) => this.annotationManager.setOverrides(id, overrides),
          (parent, unitSpecs) => this.annotationManager.addCustomUnit(parent, unitSpecs),
          (id) => this.annotationManager.deleteListing(id),
          () => {}
        );
      });
      return;
    }

    // Show Detail Modal
    const ann = this.annotationManager.get(listingId);
    showDetailModal(
      item,
      ann,
      (id, data) => this.annotationManager.set(id, data),
      (id, overrides) => this.annotationManager.setOverrides(id, overrides),
      (parent, unitSpecs) => this.annotationManager.addCustomUnit(parent, unitSpecs),
      (id) => this.annotationManager.deleteListing(id),
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
