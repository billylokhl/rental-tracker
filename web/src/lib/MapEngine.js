/**
 * Leaflet Multi-Layer Map Engine.
 * Manages spatial layers: Candidate Properties, Work Destinations, Superfund Hazard Zones, Transit, and POIs.
 */

import L from 'leaflet';
import { getCommuteMins } from './utils.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Single source of truth for pin color thresholds and rating tier emoji,
// consumed by getPinColorClass, cluster rendering, spiderfy pins, and the legend.
const RENT_TIER = { low: 2800, mid: 3300 };
const COMMUTE_TIER = { fast: 15, mod: 25 };
const TIER_PREFIX = { top: '⭐ ', strong: '🔷 ', backup: '🔶 ', pass: '✕ ' };

export class MapEngine {
  constructor(elementId, campaignConfig, onMarkerClick) {
    this.elementId = elementId;
    this.campaignConfig = campaignConfig;
    this.onMarkerClick = onMarkerClick;
    this.primaryDestId = campaignConfig.target_destinations?.[0] || '';

    this.map = null;
    this.propertyLayer = null;
    this.destinationLayer = null;
    this.hazardLayer = null;
    this.transitLayer = null;
    this.groceryLayer = null;
    this.crimeLayer = null;
    this.markerMap = new Map(); // listingId -> L.Marker
    this.pinColorMode = 'rating'; // 'rating' | 'commute' | 'rent'
    this.ratingVisibility = {
      top: true,
      strong: true,
      backup: true,
      low: true,
      unrated: true,
      pass: false
    };
    this.cachedListings = [];
    this.cachedAnnotations = {};
    this.cachedActiveListingId = null;

    this.initMap();
  }

  destroy() {
    this.collapseSpiderfy();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  initMap() {
    const center = this.campaignConfig.map?.default_center || [37.3688, -121.996];
    const zoom = this.campaignConfig.map?.default_zoom || 11;

    // Initialize Leaflet map
    this.map = L.map(this.elementId, {
      center: center,
      zoom: zoom,
      zoomControl: false
    });

    // Add Zoom Control top-left
    L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Base layer: Native Google Maps Roadmap Tile Layer
    const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const keyParam = googleApiKey ? `&key=${googleApiKey}` : '';
    const googleTileUrl = `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}${keyParam}`;

    this.baseTileLayer = L.tileLayer(googleTileUrl, {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>'
    }).addTo(this.map);

    // Initialize Layer Groups
    this.propertyLayer = L.layerGroup().addTo(this.map);
    this.destinationLayer = L.layerGroup().addTo(this.map);
    this.transitLayer = L.layerGroup().addTo(this.map);
    this.groceryLayer = L.layerGroup().addTo(this.map);

    // Hazard and Odor layers (Off by default)
    this.hazardLayer = L.layerGroup();
    this.hazardBuffer1MiLayer = L.layerGroup();
    this.hazardBuffer2MiLayer = L.layerGroup();
    this.odorFacilityLayer = L.layerGroup();
    this.odorStrongLayer = L.layerGroup();
    this.odorMildLayer = L.layerGroup();
    this.crimeLayer = L.layerGroup();

    // Spiderfy / Spring-Up Layer for multi-unit clusters
    this.spiderfyLayer = L.layerGroup().addTo(this.map);
    this.clusterGroups = new Map();
    this.activeSpiderfyKey = null;

    // Custom Layer Panes for explicit stacking order (Rental Properties always strictly on top)
    this.map.createPane('hazardBufferPane');
    this.map.getPane('hazardBufferPane').style.zIndex = 405;

    this.map.createPane('crimeZonePane');
    this.map.getPane('crimeZonePane').style.zIndex = 408;

    this.map.createPane('odorZonePane');
    this.map.getPane('odorZonePane').style.zIndex = 410;

    this.map.createPane('poiMarkerPane');
    this.map.getPane('poiMarkerPane').style.zIndex = 550;

    this.map.createPane('destinationMarkerPane');
    this.map.getPane('destinationMarkerPane').style.zIndex = 580;

    this.map.createPane('spiderfyLinePane');
    this.map.getPane('spiderfyLinePane').style.zIndex = 640;

    this.map.createPane('propertyMarkerPane');
    this.map.getPane('propertyMarkerPane').style.zIndex = 650;

    this.map.createPane('spiderfyMarkerPane');
    this.map.getPane('spiderfyMarkerPane').style.zIndex = 670;

    // Collapse spiderfy on map interaction
    this.map.on('click', () => this.collapseSpiderfy());
    this.map.on('zoomstart', () => this.collapseSpiderfy());
    this.map.on('dragstart', () => this.collapseSpiderfy());

    // Initialize bottom-right floating crime legend
    this.initCrimeLegend();
  }

  renderDestinations(destinations = []) {
    this.destinationLayer.clearLayers();
    destinations.forEach(dest => {
      if (!dest.lat || !dest.lng) return;

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-destination" title="${escapeHtml(dest.name)}">★</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([dest.lat, dest.lng], {
        icon,
        pane: 'destinationMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <strong style="color: #0f172a; font-size: 14px;">★ ${escapeHtml(dest.name)}</strong>
          <p style="margin: 4px 0 0; color: #475569; font-size: 12px;">${escapeHtml(dest.address || 'Target Office')}</p>
          <div style="margin-top: 6px; font-size: 11px; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; display: inline-block;">
            Workplace Destination (Target arrival 9:00 AM)
          </div>
        </div>
      `);
      this.destinationLayer.addLayer(marker);
    });
  }

  renderHazards(hazards = []) {
    this.hazardLayer.clearLayers();
    this.hazardBuffer1MiLayer.clearLayers();
    this.hazardBuffer2MiLayer.clearLayers();

    const warningRadiusMi = this.campaignConfig.hazard_layers?.[0]?.warning_radius_mi || 1.0;
    const advisoryRadiusMi = 2 * warningRadiusMi;
    const radius1MiMeters = warningRadiusMi * 1609.344;
    const radius2MiMeters = advisoryRadiusMi * 1609.344;

    hazards.forEach(h => {
      if (!h.lat || !h.lng) return;

      // Hazard Pin Marker
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-hazard" title="${escapeHtml(h.name)}">⚠️</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([h.lat, h.lng], {
        icon,
        pane: 'poiMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <span style="background: #fee2e2; color: #991b1b; font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 3px;">EPA SUPERFUND SITE</span>
          <h4 style="margin: 6px 0 2px; color: #0f172a; font-size: 13px;">${escapeHtml(h.name)}</h4>
          <p style="margin: 0; color: #64748b; font-size: 11px;">Source: ${escapeHtml(h.precision || 'EPA SEMS')}</p>
          <p style="margin: 4px 0 0; color: #dc2626; font-size: 11px; font-weight: 600;">Warning buffers: ${warningRadiusMi} mi (Red) & ${advisoryRadiusMi} mi (Amber)</p>
        </div>
      `);
      this.hazardLayer.addLayer(marker);

      // Warning Buffer Circle (Red)
      const circle1Mi = L.circle([h.lat, h.lng], {
        radius: radius1MiMeters,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.09,
        weight: 1.5,
        dashArray: '4, 4',
        pane: 'hazardBufferPane'
      });
      this.hazardBuffer1MiLayer.addLayer(circle1Mi);

      // Advisory Buffer Circle (Amber)
      const circle2Mi = L.circle([h.lat, h.lng], {
        radius: radius2MiMeters,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.04,
        weight: 1,
        dashArray: '6, 6',
        pane: 'hazardBufferPane'
      });
      this.hazardBuffer2MiLayer.addLayer(circle2Mi);
    });
  }

  renderPois(pois = []) {
    this.transitLayer.clearLayers();
    this.groceryLayer.clearLayers();

    pois.forEach(poi => {
      if (!poi.lat || !poi.lng) return;

      const isTransit = poi.category === 'transit';
      const iconSymbol = isTransit ? '🚆' : '🛒';
      const bg = isTransit ? '#8b5cf6' : '#10b981';

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background: ${bg}; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${iconSymbol}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([poi.lat, poi.lng], {
        icon,
        pane: 'poiMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px; min-width: 180px;">
          <strong style="color: #0f172a; font-size: 13px; display: block;">${iconSymbol} ${escapeHtml(poi.name)}</strong>
          ${poi.subcategory ? `<span style="font-size: 10px; background: ${isTransit ? '#ede9fe' : '#d1fae5'}; color: ${isTransit ? '#6b21a8' : '#065f46'}; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px;">${escapeHtml(poi.subcategory)}</span>` : ''}
          ${poi.address ? `<p style="margin: 4px 0 0; color: #475569; font-size: 11px;">📍 ${escapeHtml(poi.address)}</p>` : ''}
        </div>
      `);

      if (isTransit) {
        this.transitLayer.addLayer(marker);
      } else {
        this.groceryLayer.addLayer(marker);
      }
    });
  }

  getRatingTier(ann = {}) {
    const r = (ann.rating || '').toString().toLowerCase().trim();
    if (r === 'top') return 'top';
    if (r === '1' || r.includes('strong')) return 'strong';
    if (r === '2' || r.includes('backup')) return 'backup';
    if (r === '3' || r.includes('low')) return 'low';
    if (r === 'pass' || r === '0') return 'pass';
    return 'unrated';
  }

  getClusterRatingTier(items = [], annotations = {}) {
    const tierPriority = { 'top': 6, 'strong': 5, 'backup': 4, 'low': 3, 'unrated': 2, 'pass': 1 };
    let bestTier = 'unrated';
    let bestScore = 0;
    for (const item of items) {
      const ann = annotations[item.id] || {};
      const tier = this.getRatingTier(ann);
      const score = tierPriority[tier] || 2;
      if (score > bestScore) {
        bestScore = score;
        bestTier = tier;
      }
    }
    return bestTier;
  }

  getPinColorClass(item, ann = {}) {
    if (this.pinColorMode === 'rating') {
      const tier = this.getRatingTier(ann);
      return `rating-${tier}`;
    } else if (this.pinColorMode === 'rent') {
      const rent = item.rent_min || 0;
      if (rent > 0 && rent <= RENT_TIER.low) return 'rent-low';
      if (rent <= RENT_TIER.mid) return 'rent-mid';
      return 'rent-high';
    } else {
      const commuteMins = getCommuteMins(item, this.primaryDestId);
      if (commuteMins !== null) {
        if (commuteMins <= COMMUTE_TIER.fast) return 'commute-fast';
        if (commuteMins <= COMMUTE_TIER.mod) return 'commute-mod';
        return 'commute-heavy';
      }
      return 'commute-unknown';
    }
  }

  setPinColorMode(mode) {
    this.pinColorMode = mode;
    this.renderProperties(this.cachedListings, this.cachedActiveListingId, this.cachedAnnotations);
    this.updateMapLegend();
  }

  setRatingSublayerVisibility(tier, isVisible) {
    this.ratingVisibility[tier] = isVisible;
    this.renderProperties(this.cachedListings, this.cachedActiveListingId, this.cachedAnnotations);
  }

  renderProperties(listings = [], activeListingId = null, annotations = {}) {
    this.cachedListings = listings;
    this.cachedActiveListingId = activeListingId;
    this.cachedAnnotations = annotations;

    this.propertyLayer.clearLayers();
    this.spiderfyLayer.clearLayers();
    this.markerMap.clear();
    this.clusterGroups = new Map();
    this.activeSpiderfyKey = null;

    // Filter listings by rating sublayer visibility
    const visibleListings = listings.filter(item => {
      const ann = annotations[item.id] || {};
      const tier = this.getRatingTier(ann);
      return this.ratingVisibility[tier] !== false;
    });

    // Group listings by coordinate (~1 meter precision)
    const groups = new Map();
    visibleListings.forEach(item => {
      const loc = item.location;
      if (!loc || !loc.lat || !loc.lng) return;
      const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          lat: loc.lat,
          lng: loc.lng,
          items: []
        });
      }
      groups.get(key).items.push(item);
    });

    groups.forEach((grp, key) => {
      // Sort units by lowest rent first
      grp.items.sort((a, b) => (a.rent_min || 0) - (b.rent_min || 0));
      const lowestItem = grp.items[0];
      const lowestRent = lowestItem.rent_min;
      const rentStr = lowestRent ? `$${Math.round(lowestRent)}` : '$?';

      const isGroupActive = grp.items.some(item => item.id === activeListingId);

      // Color coding based on active pinColorMode. Rating mode uses the best
      // tier across the cluster; rent/commute modes classify the lowest-rent item.
      let colorClass;
      let iconPrefix = '';
      if (this.pinColorMode === 'rating') {
        const clusterTier = this.getClusterRatingTier(grp.items, annotations);
        colorClass = `rating-${clusterTier}`;
        iconPrefix = TIER_PREFIX[clusterTier] || '';
      } else {
        colorClass = this.getPinColorClass(lowestItem, annotations[lowestItem.id] || {});
      }

      const isMulti = grp.items.length > 1;
      const badgeHtml = isMulti ? `<span class="cluster-count-badge" title="${grp.items.length} units available">${grp.items.length}</span>` : '';

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-price ${colorClass} ${isMulti ? 'has-cluster' : ''} ${isGroupActive ? 'active' : ''}" data-cluster="${key}" data-id="${lowestItem.id}" title="${escapeHtml(lowestItem.title)} • ${isMulti ? `${grp.items.length} units • From ` : ''}${rentStr}">${iconPrefix}${rentStr}${badgeHtml}</div>`,
        iconSize: isMulti ? [62, 26] : [54, 24],
        iconAnchor: isMulti ? [31, 13] : [27, 12]
      });

      const marker = L.marker([grp.lat, grp.lng], {
        icon,
        pane: 'propertyMarkerPane',
        zIndexOffset: isGroupActive ? 10000 : 1000
      });

      if (isMulti) {
        marker.on('click', (e) => {
          if (e && e.originalEvent) e.originalEvent.stopPropagation();
          if (this.activeSpiderfyKey === key) {
            this.collapseSpiderfy();
          } else {
            this.expandSpiderfy(key, grp, activeListingId);
          }
        });
      } else {
        marker.on('click', (e) => {
          if (e && e.originalEvent) e.originalEvent.stopPropagation();
          this.collapseSpiderfy();
          if (this.onMarkerClick) {
            this.onMarkerClick(lowestItem.id);
          }
        });
      }

      this.propertyLayer.addLayer(marker);
      grp.items.forEach(item => {
        this.markerMap.set(item.id, marker);
      });
      // Keep lat/lng on the stored group: highlightProperty passes these entries
      // into expandSpiderfy, which reads grp.lat/grp.lng.
      this.clusterGroups.set(key, { lat: grp.lat, lng: grp.lng, items: grp.items, marker });
    });

    if (activeListingId) {
      this.highlightProperty(activeListingId);
    }
  }

  expandSpiderfy(key, grp, activeListingId = null) {
    this.collapseSpiderfy();
    this.activeSpiderfyKey = key;

    // Look up the stored cluster group which has the actual Leaflet marker reference
    const storedGrp = this.clusterGroups?.get(key);

    const count = grp.items.length;
    const centerLatLng = L.latLng(grp.lat, grp.lng);
    const centerPoint = this.map.latLngToLayerPoint(centerLatLng);

    // Physically remove the center price label marker from the map
    if (storedGrp?.marker && this.propertyLayer.hasLayer(storedGrp.marker)) {
      this.propertyLayer.removeLayer(storedGrp.marker);
    }

    // Add only a small clean circular center anchor marker
    const centerDotIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="custom-pin-center-dot" title="Click to collapse cluster"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const centerDotMarker = L.marker(centerLatLng, {
      icon: centerDotIcon,
      pane: 'spiderfyMarkerPane',
      zIndexOffset: 999
    });
    centerDotMarker.on('click', (e) => {
      if (e && e.originalEvent) e.originalEvent.stopPropagation();
      this.collapseSpiderfy();
    });
    this.spiderfyLayer.addLayer(centerDotMarker);

    // Radius in screen pixels for spring-up ring
    const radius = Math.max(55, 32 + count * 10);
    const angleStep = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2;

    grp.items.forEach((item, index) => {
      const angle = startAngle + index * angleStep;
      const targetPoint = L.point(
        centerPoint.x + radius * Math.cos(angle),
        centerPoint.y + radius * Math.sin(angle)
      );
      const targetLatLng = this.map.layerPointToLatLng(targetPoint);

      // Connecting guide line
      const line = L.polyline([centerLatLng, targetLatLng], {
        color: '#38bdf8',
        weight: 1.5,
        opacity: 0.7,
        dashArray: '3, 4',
        pane: 'spiderfyLinePane'
      });
      this.spiderfyLayer.addLayer(line);

      // Individual Unit Information (no commas in rent display)
      const unitRentStr = item.rent_min ? `$${Math.round(item.rent_min)}` : '$?';
      const unitNum = item.unit_number ? `#${item.unit_number}` : '';
      const beds = item.bedrooms ? `${item.bedrooms}b` : '';
      const isItemActive = item.id === activeListingId;

      const ann = this.cachedAnnotations[item.id] || {};
      const unitColorClass = this.getPinColorClass(item, ann);

      let unitIconPrefix = '';
      if (this.pinColorMode === 'rating') {
        unitIconPrefix = TIER_PREFIX[this.getRatingTier(ann)] || '';
      }

      const sprungIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="custom-pin-price sprung ${unitColorClass} ${isItemActive ? 'active' : ''}" data-id="${item.id}" title="${escapeHtml(item.title)} • ${escapeHtml(unitNum)} • ${unitRentStr}">
            ${unitNum ? `<span class="sprung-unit-tag">${escapeHtml(unitNum)}</span>` : ''}
            <span>${unitIconPrefix}${unitRentStr}</span>
            ${beds ? `<span class="sprung-bed-tag">${escapeHtml(beds)}</span>` : ''}
          </div>
        `,
        iconSize: [68, 26],
        iconAnchor: [34, 13]
      });

      const sprungMarker = L.marker(targetLatLng, {
        icon: sprungIcon,
        pane: 'spiderfyMarkerPane',
        zIndexOffset: isItemActive ? 20000 : 15000
      });

      sprungMarker.on('click', (e) => {
        if (e && e.originalEvent) e.originalEvent.stopPropagation();
        document.querySelectorAll('.custom-pin-price.sprung.active').forEach(el => el.classList.remove('active'));
        const el = sprungMarker.getElement();
        if (el) {
          const pin = el.querySelector('.custom-pin-price');
          if (pin) pin.classList.add('active');
        }
        if (this.onMarkerClick) {
          this.onMarkerClick(item.id);
        }
      });

      this.spiderfyLayer.addLayer(sprungMarker);
    });
  }

  collapseSpiderfy() {
    // Restore any cluster markers that were removed
    if (this.clusterGroups) {
      this.clusterGroups.forEach(grp => {
        if (grp.marker && !this.propertyLayer.hasLayer(grp.marker)) {
          this.propertyLayer.addLayer(grp.marker);
        }
      });
    }
    this.spiderfyLayer.clearLayers();
    this.activeSpiderfyKey = null;
  }

  highlightProperty(listingId) {
    // Reset previous pins
    document.querySelectorAll('.custom-pin-price.active').forEach(el => el.classList.remove('active'));
    this.markerMap.forEach(m => m.setZIndexOffset(1000));

    let targetGroupKey = null;
    let targetGroup = null;
    if (this.clusterGroups) {
      for (const [key, grp] of this.clusterGroups.entries()) {
        if (grp.items.some(it => it.id === listingId)) {
          targetGroupKey = key;
          targetGroup = grp;
          break;
        }
      }
    }

    if (targetGroup && targetGroup.items.length > 1) {
      // Expand cluster if not already expanded
      if (this.activeSpiderfyKey !== targetGroupKey) {
        this.expandSpiderfy(targetGroupKey, targetGroup, listingId);
      } else {
        document.querySelectorAll(`.custom-pin-price.sprung[data-id="${listingId}"]`).forEach(el => el.classList.add('active'));
      }
      this.map.panTo([targetGroup.lat, targetGroup.lng], { animate: true, duration: 0.4 });
    } else {
      this.collapseSpiderfy();
      const marker = this.markerMap.get(listingId);
      if (marker) {
        marker.setZIndexOffset(10000);
        const el = marker.getElement();
        if (el) {
          const pin = el.querySelector('.custom-pin-price');
          if (pin) pin.classList.add('active');
        }
        this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
      }
    }
  }

  setSuperfundState({ enabled = true, show1Mi = true, show2Mi = true } = {}) {
    if (!enabled) {
      this.map.removeLayer(this.hazardLayer);
      this.map.removeLayer(this.hazardBuffer1MiLayer);
      this.map.removeLayer(this.hazardBuffer2MiLayer);
    } else {
      if (!this.map.hasLayer(this.hazardLayer)) {
        this.map.addLayer(this.hazardLayer);
      }
      if (show1Mi) {
        if (!this.map.hasLayer(this.hazardBuffer1MiLayer)) {
          this.map.addLayer(this.hazardBuffer1MiLayer);
        }
      } else {
        this.map.removeLayer(this.hazardBuffer1MiLayer);
      }
      if (show2Mi) {
        if (!this.map.hasLayer(this.hazardBuffer2MiLayer)) {
          this.map.addLayer(this.hazardBuffer2MiLayer);
        }
      } else {
        this.map.removeLayer(this.hazardBuffer2MiLayer);
      }
    }
  }

  setOdorState({ enabled = true, showStrong = true, showMild = true } = {}) {
    if (!enabled) {
      this.map.removeLayer(this.odorFacilityLayer);
      this.map.removeLayer(this.odorStrongLayer);
      this.map.removeLayer(this.odorMildLayer);
    } else {
      if (!this.map.hasLayer(this.odorFacilityLayer)) {
        this.map.addLayer(this.odorFacilityLayer);
      }
      if (showStrong) {
        if (!this.map.hasLayer(this.odorStrongLayer)) {
          this.map.addLayer(this.odorStrongLayer);
        }
      } else {
        this.map.removeLayer(this.odorStrongLayer);
      }
      if (showMild) {
        if (!this.map.hasLayer(this.odorMildLayer)) {
          this.map.addLayer(this.odorMildLayer);
        }
      } else {
        this.map.removeLayer(this.odorMildLayer);
      }
    }
  }

  renderOdorZone(odorData) {
    this.odorFacilityLayer.clearLayers();
    this.odorStrongLayer.clearLayers();
    this.odorMildLayer.clearLayers();
    if (!odorData) return;

    // 1. High Impact / Strong Odor Zone (Purple)
    const strongZone = odorData.strong_zone || (odorData.boundary_polygon ? { polygon: odorData.boundary_polygon, name: odorData.zone_name } : null);
    if (strongZone && strongZone.polygon && strongZone.polygon.length > 0) {
      const polygon = L.polygon(strongZone.polygon, {
        color: strongZone.color || '#7c3aed',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.14,
        pane: 'odorZonePane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px; max-width: 250px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: #ede9fe; color: #6b21a8; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">HIGH IMPACT</span>
            <strong style="color: #6b21a8; font-size: 13px;">💨 ${escapeHtml(strongZone.name || 'High Impact Odor Zone')}</strong>
          </div>
          <p style="margin: 4px 0 0; color: #475569; font-size: 11px; line-height: 1.4;">${escapeHtml(strongZone.description || 'Areas directly adjacent to Newby Island Landfill and Alviso waste facilities with frequent strong odors.')}</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;"><em>Source: ${escapeHtml(odorData.source || 'BAAQMD / GoMilpitas')}</em></p>
        </div>
      `);
      this.odorStrongLayer.addLayer(polygon);
    }

    // 2. Mild / Intermittent Advisory Zone (Amber / Orange)
    const mildZone = odorData.mild_zone;
    if (mildZone && mildZone.polygon && mildZone.polygon.length > 0) {
      const polygon = L.polygon(mildZone.polygon, {
        color: mildZone.color || '#f59e0b',
        weight: 2,
        dashArray: '8, 8',
        fillColor: '#f59e0b',
        fillOpacity: 0.07,
        pane: 'odorZonePane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px; max-width: 250px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">ADVISORY</span>
            <strong style="color: #b45309; font-size: 13px;">💨 ${escapeHtml(mildZone.name || 'Mild Odor Advisory Zone')}</strong>
          </div>
          <p style="margin: 4px 0 0; color: #475569; font-size: 11px; line-height: 1.4;">${escapeHtml(mildZone.description || 'Extended downwind area with intermittent weak odors during evening Bay breezes (includes South Main St / 1101 S Main St).')}</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;"><em>Source: Field Observation & BAAQMD Data</em></p>
        </div>
      `);
      this.odorMildLayer.addLayer(polygon);
    }

    // 3. Facility Emission Pins
    if (odorData.facilities && odorData.facilities.length > 0) {
      odorData.facilities.forEach(fac => {
        if (!fac.lat || !fac.lng) return;
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background: #6d28d9; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.25);" title="${escapeHtml(fac.name)}">🏭</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([fac.lat, fac.lng], {
          icon,
          pane: 'poiMarkerPane'
        }).bindPopup(`
          <div style="font-family: var(--font-sans); padding: 4px; min-width: 200px;">
            <strong style="color: #5b21b6; font-size: 13px;">🏭 ${escapeHtml(fac.name)}</strong>
            <p style="margin: 2px 0 0; color: #374151; font-size: 11px; font-weight: 500;">Operator: ${escapeHtml(fac.operator || 'N/A')}</p>
            ${fac.address ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 11px;">📍 ${escapeHtml(fac.address)}</p>` : ''}
            ${fac.details ? `<p style="margin: 4px 0 0; color: #4b5563; font-size: 11px; line-height: 1.3;">${escapeHtml(fac.details)}</p>` : ''}
          </div>
        `);
        this.odorFacilityLayer.addLayer(marker);
      });
    }
  }

  initCrimeLegend() {
    this.crimeLegendControl = L.control({ position: 'bottomright' });
    this.crimeLegendControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-crime-legend hidden');
      div.id = 'map-crime-legend';
      return div;
    };
    this.crimeLegendControl.addTo(this.map);
  }

  updateMapLegend() {
    const el = document.getElementById('map-crime-legend');
    if (!el) return;

    if (this.map.hasLayer(this.crimeLayer)) {
      el.classList.remove('hidden');
      let title = "Property Crime (Vehicle/Theft)";
      let scaleRows = `
        <div class="legend-row"><span class="legend-dot" style="background:#10b981;"></span> Very Low (< 12/1k)</div>
        <div class="legend-row"><span class="legend-dot" style="background:#84cc16;"></span> Low (12–16/1k)</div>
        <div class="legend-row"><span class="legend-dot" style="background:#f59e0b;"></span> Moderate (16–25/1k)</div>
        <div class="legend-row"><span class="legend-dot" style="background:#ef4444;"></span> High (> 25/1k)</div>
      `;

      if (this.activeCrimeMode === 'violent') {
        title = "Violent Crime & Safety";
        scaleRows = `
          <div class="legend-row"><span class="legend-dot" style="background:#10b981;"></span> Very Low (< 2/1k)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#84cc16;"></span> Low (2–4/1k)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#f59e0b;"></span> Moderate (4–8/1k)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#ef4444;"></span> High (> 8/1k)</div>
        `;
      } else if (this.activeCrimeMode === 'overall') {
        title = "Overall Safety Grade";
        scaleRows = `
          <div class="legend-row"><span class="legend-dot" style="background:#10b981;"></span> Grade A / A+ (Safest)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#84cc16;"></span> Grade B / B+ (Low Crime)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#f59e0b;"></span> Grade C / C+ (Moderate)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#ef4444;"></span> Grade D / F (Elevated)</div>
        `;
      }

      el.innerHTML = `
        <div class="legend-header">🛡️ ${title}</div>
        <div class="legend-scale">${scaleRows}</div>
      `;
      return;
    }

    // Rating / Priority Legend
    if (this.pinColorMode === 'rating') {
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="legend-header">⭐ Pin Colors: Rating</div>
        <div class="legend-scale">
          <div class="legend-row"><span class="legend-dot" style="background:#10b981; border: 1.5px solid #f59e0b; box-shadow: 0 0 5px rgba(245,158,11,0.6);"></span> ⭐ Top Choice</div>
          <div class="legend-row"><span class="legend-dot" style="background:#0ea5e9; border: 1.5px solid #38bdf8;"></span> 🔷 1 (Strong Contender)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#f59e0b; border: 1.5px solid #fbbf24;"></span> 🔶 2 (Backup)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#64748b; border: 1.5px solid #94a3b8;"></span> ◽ 3 (Low Priority)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#334155; border: 1.5px solid #64748b;"></span> ⚪ Unrated</div>
          <div class="legend-row"><span class="legend-dot" style="background:#ef4444; border: 1px dashed #f87171;"></span> ✕ Pass (Dismissed)</div>
        </div>
      `;
      return;
    }

    if (this.pinColorMode === 'rent') {
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="legend-header">💵 Pin Colors: Rent Level</div>
        <div class="legend-scale">
          <div class="legend-row"><span class="legend-dot" style="background:#10b981;"></span> ≤ $${RENT_TIER.low.toLocaleString()}/mo (Value)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#38bdf8;"></span> $${(RENT_TIER.low + 1).toLocaleString()}–$${RENT_TIER.mid.toLocaleString()}/mo (Mid)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#a855f7;"></span> > $${RENT_TIER.mid.toLocaleString()}/mo (High)</div>
        </div>
      `;
      return;
    }

    if (this.pinColorMode === 'commute') {
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="legend-header">🚗 Pin Colors: Work Commute</div>
        <div class="legend-scale">
          <div class="legend-row"><span class="legend-dot" style="background:#10b981;"></span> Fast (≤ ${COMMUTE_TIER.fast} min)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#f59e0b;"></span> Moderate (${COMMUTE_TIER.fast + 1}–${COMMUTE_TIER.mod} min)</div>
          <div class="legend-row"><span class="legend-dot" style="background:#ef4444;"></span> Heavy (> ${COMMUTE_TIER.mod} min)</div>
        </div>
      `;
      return;
    }

    el.classList.add('hidden');
  }

  setCrimeState({ enabled = true, mode = 'property' } = {}) {
    this.activeCrimeMode = mode;
    if (!enabled) {
      if (this.map.hasLayer(this.crimeLayer)) {
        this.map.removeLayer(this.crimeLayer);
      }
    } else {
      if (!this.map.hasLayer(this.crimeLayer)) {
        this.map.addLayer(this.crimeLayer);
      }
      this.updateCrimeZones();
    }
    this.updateMapLegend();
  }

  renderCrimeZones(crimeData) {
    this.crimeData = crimeData;
    this.updateCrimeZones();
  }

  updateCrimeZones() {
    this.crimeLayer.clearLayers();
    if (!this.crimeData || !this.crimeData.features) return;

    // color scales
    const getColor = (grade) => {
        if (!grade) return '#94a3b8'; // default gray
        const g = grade.toUpperCase().trim();
        // Exact rate labels first — substring letter checks would misclassify
        // them ('MODERATE' contains 'A', which is why startsWith is used below).
        if (g === 'VERY LOW') return '#10b981';
        if (g === 'LOW') return '#84cc16';
        if (g === 'MODERATE') return '#f59e0b';
        if (g === 'HIGH') return '#ef4444';

        if (g.startsWith('A')) return '#10b981'; // green
        if (g.startsWith('B')) return '#84cc16'; // light green
        if (g.startsWith('C')) return '#f59e0b'; // orange
        if (g.startsWith('D')) return '#f97316'; // dark orange
        if (g.startsWith('F')) return '#ef4444'; // red

        return '#94a3b8';
    };

    L.geoJSON(this.crimeData, {
      pane: 'crimeZonePane',
      style: (feature) => {
        let val;
        if (this.activeCrimeMode === 'property') val = feature.properties.property_grade;
        else if (this.activeCrimeMode === 'violent') val = feature.properties.violent_grade;
        else val = feature.properties.overall_safety_grade;

        return {
          fillColor: getColor(val),
          weight: 2,
          opacity: 0.6,
          color: getColor(val),
          dashArray: '3',
          fillOpacity: 0.2
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindTooltip(`
          <div style="font-family: var(--font-sans); padding: 4px;">
            <strong style="font-size: 13px;">${escapeHtml(p.name)}</strong><br/>
            <span style="font-size: 11px; color: #475569;">Property Crime: ${escapeHtml(p.property_grade)} (${escapeHtml(p.property_crime_rate)}/1k)</span><br/>
            <span style="font-size: 11px; color: #475569;">Violent Crime: ${escapeHtml(p.violent_grade)} (${escapeHtml(p.violent_crime_rate)}/1k)</span><br/>
            <span style="font-size: 11px; font-weight: bold; color: #334155;">Overall Safety: ${escapeHtml(p.overall_safety_grade)}</span>
          </div>
        `, { sticky: true, className: 'crime-tooltip' });
      }
    }).addTo(this.crimeLayer);
  }

  toggleLayer(layerName, visible) {
    switch (layerName) {
      case 'properties':
        visible ? this.map.addLayer(this.propertyLayer) : this.map.removeLayer(this.propertyLayer);
        break;
      case 'destinations':
        visible ? this.map.addLayer(this.destinationLayer) : this.map.removeLayer(this.destinationLayer);
        break;
      // Hazard layers are toggled exclusively through setSuperfundState, which
      // owns the master/sub-checkbox choreography — no cases for them here.
      case 'transit':
        visible ? this.map.addLayer(this.transitLayer) : this.map.removeLayer(this.transitLayer);
        break;
      case 'grocery':
        visible ? this.map.addLayer(this.groceryLayer) : this.map.removeLayer(this.groceryLayer);
        break;
    }
  }
}
