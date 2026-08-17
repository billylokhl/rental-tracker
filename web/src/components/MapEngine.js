/**
 * Leaflet Multi-Layer Map Engine.
 * Manages spatial layers: Candidate Properties, Work Destinations, Superfund Hazard Zones, Transit, and POIs.
 */

export class MapEngine {
  constructor(elementId, campaignConfig, onMarkerClick) {
    this.elementId = elementId;
    this.campaignConfig = campaignConfig;
    this.onMarkerClick = onMarkerClick;
    
    this.map = null;
    this.propertyLayer = null;
    this.destinationLayer = null;
    this.hazardLayer = null;
    this.hazardBufferLayer = null;
    this.transitLayer = null;
    this.groceryLayer = null;
    
    this.markerMap = new Map(); // listingId -> L.Marker
    this.initMap();
  }

  initMap() {
    const center = this.campaignConfig.map?.default_center || [37.3688, -121.996];
    const zoom = this.campaignConfig.map?.default_zoom || 11;

    // Initialize Leaflet map
    this.map = window.L.map(this.elementId, {
      center: center,
      zoom: zoom,
      zoomControl: false
    });

    // Add Zoom Control top-left
    window.L.control.zoom({ position: 'topleft' }).addTo(this.map);

    // Dark theme CartoDB / OpenStreetMap tile layer
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Initialize Layer Groups
    this.propertyLayer = window.L.layerGroup().addTo(this.map);
    this.destinationLayer = window.L.layerGroup().addTo(this.map);
    this.transitLayer = window.L.layerGroup().addTo(this.map);
    this.groceryLayer = window.L.layerGroup().addTo(this.map);

    // Hazard and Odor layers (Off by default)
    this.hazardLayer = window.L.layerGroup();
    this.hazardBuffer1MiLayer = window.L.layerGroup();
    this.hazardBuffer2MiLayer = window.L.layerGroup();
    this.odorFacilityLayer = window.L.layerGroup();
    this.odorStrongLayer = window.L.layerGroup();
    this.odorMildLayer = window.L.layerGroup();

    // Spiderfy / Spring-Up Layer for multi-unit clusters
    this.spiderfyLayer = window.L.layerGroup().addTo(this.map);
    this.clusterGroups = new Map();
    this.activeSpiderfyKey = null;

    // Custom Layer Panes for explicit stacking order (Rental Properties always strictly on top)
    this.map.createPane('hazardBufferPane');
    this.map.getPane('hazardBufferPane').style.zIndex = 405;

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
  }

  renderDestinations(destinations = []) {
    this.destinationLayer.clearLayers();
    destinations.forEach(dest => {
      if (!dest.lat || !dest.lng) return;

      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-destination" title="${dest.name}">★</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = window.L.marker([dest.lat, dest.lng], {
        icon,
        pane: 'destinationMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <strong style="color: #0f172a; font-size: 14px;">★ ${dest.name}</strong>
          <p style="margin: 4px 0 0; color: #475569; font-size: 12px;">${dest.address || 'Target Office'}</p>
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

    const radius1MiMeters = 1.0 * 1609.344;
    const radius2MiMeters = 2.0 * 1609.344;

    hazards.forEach(h => {
      if (!h.lat || !h.lng) return;

      // Hazard Pin Marker
      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-hazard" title="${h.name}">⚠️</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = window.L.marker([h.lat, h.lng], {
        icon,
        pane: 'poiMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px;">
          <span style="background: #fee2e2; color: #991b1b; font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 3px;">EPA SUPERFUND SITE</span>
          <h4 style="margin: 6px 0 2px; color: #0f172a; font-size: 13px;">${h.name}</h4>
          <p style="margin: 0; color: #64748b; font-size: 11px;">Source: ${h.precision || 'EPA SEMS'}</p>
          <p style="margin: 4px 0 0; color: #dc2626; font-size: 11px; font-weight: 600;">Warning buffers: 1.0 mi (Red) & 2.0 mi (Amber)</p>
        </div>
      `);
      this.hazardLayer.addLayer(marker);

      // 1.0 Mile Warning Buffer Circle (Red)
      const circle1Mi = window.L.circle([h.lat, h.lng], {
        radius: radius1MiMeters,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.09,
        weight: 1.5,
        dashArray: '4, 4',
        pane: 'hazardBufferPane'
      });
      this.hazardBuffer1MiLayer.addLayer(circle1Mi);

      // 2.0 Mile Advisory Buffer Circle (Amber)
      const circle2Mi = window.L.circle([h.lat, h.lng], {
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

      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background: ${bg}; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${iconSymbol}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = window.L.marker([poi.lat, poi.lng], {
        icon,
        pane: 'poiMarkerPane'
      }).bindPopup(`
        <div style="font-family: var(--font-sans); padding: 4px; min-width: 180px;">
          <strong style="color: #0f172a; font-size: 13px; display: block;">${iconSymbol} ${poi.name}</strong>
          ${poi.subcategory ? `<span style="font-size: 10px; background: ${isTransit ? '#ede9fe' : '#d1fae5'}; color: ${isTransit ? '#6b21a8' : '#065f46'}; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 3px;">${poi.subcategory}</span>` : ''}
          ${poi.address ? `<p style="margin: 4px 0 0; color: #475569; font-size: 11px;">📍 ${poi.address}</p>` : ''}
        </div>
      `);

      if (isTransit) {
        this.transitLayer.addLayer(marker);
      } else {
        this.groceryLayer.addLayer(marker);
      }
    });
  }

  renderProperties(listings = [], activeListingId = null) {
    this.propertyLayer.clearLayers();
    this.spiderfyLayer.clearLayers();
    this.markerMap.clear();
    this.clusterGroups = new Map();
    this.activeSpiderfyKey = null;

    // Group listings by coordinate (~1 meter precision)
    const groups = new Map();
    listings.forEach(item => {
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

      // Commute-based color coding
      const commuteMins = lowestItem.commute?.intel_sc2?.avg_min;
      let commuteColorClass = 'commute-unknown';
      if (commuteMins !== undefined && commuteMins !== null) {
        if (commuteMins <= 15) commuteColorClass = 'commute-fast';
        else if (commuteMins <= 25) commuteColorClass = 'commute-mod';
        else commuteColorClass = 'commute-heavy';
      }

      const isMulti = grp.items.length > 1;
      const badgeHtml = isMulti ? `<span class="cluster-count-badge" title="${grp.items.length} units available">${grp.items.length}</span>` : '';

      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-price ${commuteColorClass} ${isMulti ? 'has-cluster' : ''} ${isGroupActive ? 'active' : ''}" data-cluster="${key}" data-id="${lowestItem.id}" title="${lowestItem.title} • ${isMulti ? `${grp.items.length} units • From ` : ''}${rentStr}">${rentStr}${badgeHtml}</div>`,
        iconSize: isMulti ? [58, 26] : [50, 24],
        iconAnchor: isMulti ? [29, 13] : [25, 12]
      });

      const marker = window.L.marker([grp.lat, grp.lng], {
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
      this.clusterGroups.set(key, { centerLatLng: [grp.lat, grp.lng], items: grp.items, marker });
    });

    if (activeListingId) {
      this.highlightProperty(activeListingId);
    }
  }

  expandSpiderfy(key, grp, activeListingId = null) {
    this.collapseSpiderfy();
    this.activeSpiderfyKey = key;

    const count = grp.items.length;
    const centerLatLng = window.L.latLng(grp.lat, grp.lng);
    const centerPoint = this.map.latLngToLayerPoint(centerLatLng);

    // Completely hide the center price label so only the location dot and surrounding unit labels show
    if (grp.marker) {
      if (grp.marker.setOpacity) grp.marker.setOpacity(0);
      const el = grp.marker.getElement();
      if (el) {
        el.classList.add('spiderfied-hidden');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      }
    }

    // Add a neat circular center anchor marker
    const centerDotIcon = window.L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="custom-pin-center-dot" title="Click to collapse cluster"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const centerDotMarker = window.L.marker(centerLatLng, {
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
      const targetPoint = window.L.point(
        centerPoint.x + radius * Math.cos(angle),
        centerPoint.y + radius * Math.sin(angle)
      );
      const targetLatLng = this.map.layerPointToLatLng(targetPoint);

      // Connecting guide line
      const line = window.L.polyline([centerLatLng, targetLatLng], {
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

      const commuteMins = item.commute?.intel_sc2?.avg_min;
      let commuteColorClass = 'commute-unknown';
      if (commuteMins !== undefined && commuteMins !== null) {
        if (commuteMins <= 15) commuteColorClass = 'commute-fast';
        else if (commuteMins <= 25) commuteColorClass = 'commute-mod';
        else commuteColorClass = 'commute-heavy';
      }

      const sprungIcon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="custom-pin-price sprung ${commuteColorClass} ${isItemActive ? 'active' : ''}" data-id="${item.id}" title="${item.title} • ${unitNum} • ${unitRentStr}">
            ${unitNum ? `<span class="sprung-unit-tag">${unitNum}</span>` : ''}
            <span>${unitRentStr}</span>
            ${beds ? `<span class="sprung-bed-tag">${beds}</span>` : ''}
          </div>
        `,
        iconSize: [64, 26],
        iconAnchor: [32, 13]
      });

      const sprungMarker = window.L.marker(targetLatLng, {
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
    this.propertyLayer.eachLayer(m => {
      if (m.setOpacity) m.setOpacity(1);
      const el = m.getElement && m.getElement();
      if (el) {
        el.classList.remove('spiderfied-hidden');
        el.style.display = '';
        el.style.opacity = '';
        el.style.visibility = '';
      }
    });
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
      this.map.panTo(targetGroup.centerLatLng, { animate: true, duration: 0.4 });
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
      const polygon = window.L.polygon(strongZone.polygon, {
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
            <strong style="color: #6b21a8; font-size: 13px;">💨 ${strongZone.name || 'High Impact Odor Zone'}</strong>
          </div>
          <p style="margin: 4px 0 0; color: #475569; font-size: 11px; line-height: 1.4;">${strongZone.description || 'Areas directly adjacent to Newby Island Landfill and Alviso waste facilities with frequent strong odors.'}</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;"><em>Source: ${odorData.source || 'BAAQMD / GoMilpitas'}</em></p>
        </div>
      `);
      this.odorStrongLayer.addLayer(polygon);
    }

    // 2. Mild / Intermittent Advisory Zone (Amber / Orange)
    const mildZone = odorData.mild_zone;
    if (mildZone && mildZone.polygon && mildZone.polygon.length > 0) {
      const polygon = window.L.polygon(mildZone.polygon, {
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
            <strong style="color: #b45309; font-size: 13px;">💨 ${mildZone.name || 'Mild Odor Advisory Zone'}</strong>
          </div>
          <p style="margin: 4px 0 0; color: #475569; font-size: 11px; line-height: 1.4;">${mildZone.description || 'Extended downwind area with intermittent weak odors during evening Bay breezes (includes South Main St / 1101 S Main St).'}</p>
          <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8;"><em>Source: Field Observation & BAAQMD Data</em></p>
        </div>
      `);
      this.odorMildLayer.addLayer(polygon);
    }

    // 3. Facility Emission Pins
    if (odorData.facilities && odorData.facilities.length > 0) {
      odorData.facilities.forEach(fac => {
        if (!fac.lat || !fac.lng) return;
        const icon = window.L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background: #6d28d9; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.25);" title="${fac.name}">🏭</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = window.L.marker([fac.lat, fac.lng], {
          icon,
          pane: 'poiMarkerPane'
        }).bindPopup(`
          <div style="font-family: var(--font-sans); padding: 4px; min-width: 200px;">
            <strong style="color: #5b21b6; font-size: 13px;">🏭 ${fac.name}</strong>
            <p style="margin: 2px 0 0; color: #374151; font-size: 11px; font-weight: 500;">Operator: ${fac.operator || 'N/A'}</p>
            ${fac.address ? `<p style="margin: 2px 0 0; color: #6b7280; font-size: 11px;">📍 ${fac.address}</p>` : ''}
            ${fac.details ? `<p style="margin: 4px 0 0; color: #4b5563; font-size: 11px; line-height: 1.3;">${fac.details}</p>` : ''}
          </div>
        `);
        this.odorFacilityLayer.addLayer(marker);
      });
    }
  }

  toggleLayer(layerName, visible) {
    switch (layerName) {
      case 'properties':
        visible ? this.map.addLayer(this.propertyLayer) : this.map.removeLayer(this.propertyLayer);
        break;
      case 'destinations':
        visible ? this.map.addLayer(this.destinationLayer) : this.map.removeLayer(this.destinationLayer);
        break;
      case 'hazards':
        visible ? this.map.addLayer(this.hazardLayer) : this.map.removeLayer(this.hazardLayer);
        break;
      case 'hazard_1mi':
        visible ? this.map.addLayer(this.hazardBuffer1MiLayer) : this.map.removeLayer(this.hazardBuffer1MiLayer);
        break;
      case 'hazard_2mi':
        visible ? this.map.addLayer(this.hazardBuffer2MiLayer) : this.map.removeLayer(this.hazardBuffer2MiLayer);
        break;
      case 'transit':
        visible ? this.map.addLayer(this.transitLayer) : this.map.removeLayer(this.transitLayer);
        break;
      case 'grocery':
        visible ? this.map.addLayer(this.groceryLayer) : this.map.removeLayer(this.groceryLayer);
        break;
    }
  }
}
