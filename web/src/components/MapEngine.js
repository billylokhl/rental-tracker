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
    this.hazardLayer = window.L.layerGroup().addTo(this.map);
    this.hazardBufferLayer = window.L.layerGroup().addTo(this.map);
    this.transitLayer = window.L.layerGroup().addTo(this.map);
    this.groceryLayer = window.L.layerGroup().addTo(this.map);
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

      const marker = window.L.marker([dest.lat, dest.lng], { icon })
        .bindPopup(`
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

  renderHazards(hazards = [], showBuffers = true) {
    this.hazardLayer.clearLayers();
    this.hazardBufferLayer.clearLayers();

    hazards.forEach(h => {
      if (!h.lat || !h.lng) return;

      // Hazard Marker
      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-hazard" title="${h.name}">⚠️</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = window.L.marker([h.lat, h.lng], { icon })
        .bindPopup(`
          <div style="font-family: var(--font-sans); padding: 4px;">
            <span style="background: #fee2e2; color: #991b1b; font-size: 10px; font-weight: 700; padding: 2px 5px; border-radius: 3px;">EPA SUPERFUND SITE</span>
            <h4 style="margin: 6px 0 2px; color: #0f172a; font-size: 13px;">${h.name}</h4>
            <p style="margin: 0; color: #64748b; font-size: 11px;">Source: ${h.precision || 'EPA SEMS'}</p>
          </div>
        `);
      this.hazardLayer.addLayer(marker);

      // 0.75 mile buffer circle
      if (showBuffers) {
        const circle = window.L.circle([h.lat, h.lng], {
          radius: 1207, // ~0.75 miles in meters
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '4, 4'
        });
        this.hazardBufferLayer.addLayer(circle);
      }
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

      const marker = window.L.marker([poi.lat, poi.lng], { icon })
        .bindPopup(`
          <div style="font-family: var(--font-sans); padding: 4px;">
            <strong style="color: #0f172a; font-size: 13px;">${iconSymbol} ${poi.name}</strong>
            <p style="margin: 2px 0 0; color: #64748b; font-size: 11px; text-transform: capitalize;">Category: ${poi.category}</p>
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
    this.markerMap.clear();

    listings.forEach(item => {
      const loc = item.location;
      if (!loc || !loc.lat || !loc.lng) return;

      const rentStr = item.rent_min ? `$${(item.rent_min / 1000).toFixed(1)}k` : '$?';
      const isActive = item.id === activeListingId;

      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="custom-pin-price ${isActive ? 'active' : ''}" data-id="${item.id}">${rentStr}</div>`,
        iconSize: [44, 24],
        iconAnchor: [22, 12]
      });

      const marker = window.L.marker([loc.lat, loc.lng], { icon });

      marker.on('click', () => {
        if (this.onMarkerClick) {
          this.onMarkerClick(item.id);
        }
      });

      this.propertyLayer.addLayer(marker);
      this.markerMap.set(item.id, marker);
    });
  }

  highlightProperty(listingId) {
    // Reset previous pins
    document.querySelectorAll('.custom-pin-price.active').forEach(el => el.classList.remove('active'));

    const marker = this.markerMap.get(listingId);
    if (marker) {
      const el = marker.getElement();
      if (el) {
        const pin = el.querySelector('.custom-pin-price');
        if (pin) pin.classList.add('active');
      }
      this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
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
        if (visible) {
          this.map.addLayer(this.hazardLayer);
          this.map.addLayer(this.hazardBufferLayer);
        } else {
          this.map.removeLayer(this.hazardLayer);
          this.map.removeLayer(this.hazardBufferLayer);
        }
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
