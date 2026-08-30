import { useState, useCallback, useEffect, useRef } from 'preact/hooks';

/**
 * Config-driven map layer drawer.
 * Generates layer checkboxes from campaign.hazard_layers and campaign.poi_layers
 * instead of hardcoding layer names. The three triplicated sync closures from the
 * old codebase are replaced by a single generic LayerGroup component.
 */

/** A collapsible layer group with master toggle and sub-options. */
function LayerGroup({ label, icon, defaultOn, children, onMasterChange }) {
  const [enabled, setEnabled] = useState(defaultOn ?? false);

  const handleToggle = useCallback((e) => {
    const val = e.target.checked;
    setEnabled(val);
    onMasterChange?.(val);
  }, [onMasterChange]);

  return (
    <div className="layer-nested-group">
      <label className="layer-checkbox-item">
        <input type="checkbox" checked={enabled} onChange={handleToggle} />
        <span><strong>{icon} {label}</strong></span>
      </label>
      <div className={`nested-sub-options ${enabled ? '' : 'disabled'}`}>
        {children}
      </div>
    </div>
  );
}

/** A single checkbox layer item (non-nested). */
function LayerCheckbox({ label, icon, defaultOn, onChange }) {
  const [checked, setChecked] = useState(defaultOn ?? true);

  const handleChange = useCallback((e) => {
    const val = e.target.checked;
    setChecked(val);
    onChange?.(val);
  }, [onChange]);

  return (
    <label className="layer-checkbox-item">
      <input type="checkbox" checked={checked} onChange={handleChange} />
      <span>{icon} {label}</span>
    </label>
  );
}

export function LayerDrawer({ campaign, mapEngine, ratingCounts }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pinColorMode, setPinColorMode] = useState('rating');
  const drawerRef = useRef(null);

  // Close drawer when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isOpen]);

  const hazardLayers = campaign.hazard_layers || [];
  const poiLayers = campaign.poi_layers || [];

  // Rating sublayer visibility state
  const [ratingSublayers, setRatingSublayers] = useState({
    top: true, strong: true, backup: true, low: true, pass: false,
  });

  const handleRatingSublayer = useCallback((tier, checked) => {
    setRatingSublayers(prev => ({ ...prev, [tier]: checked }));
    if (tier === 'low') {
      mapEngine?.setRatingSublayerVisibility('low', checked);
      mapEngine?.setRatingSublayerVisibility('unrated', checked);
    } else {
      mapEngine?.setRatingSublayerVisibility(tier, checked);
    }
  }, [mapEngine]);

  const handlePinColorChange = useCallback((mode) => {
    setPinColorMode(mode);
    mapEngine?.setPinColorMode(mode);
  }, [mapEngine]);

  // POI layer icon mapping
  const poiIcons = {
    transit: '🚆',
    grocery: '🛒',
    park: '🌳',
    school: '🏫',
    hospital: '🏥',
  };

  return (
    <div className="map-layer-drawer" ref={drawerRef}>
      <button
        className="layer-fab"
        title="Map Layers"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span className="fab-label">Layers</span>
      </button>

      {isOpen && (
        <div className="layer-menu-popup">
          <div className="layer-header">
            <h4>Map Layers</h4>
            <button className="btn-icon" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Rental Properties & Rating Sublayers */}
            <div className="layer-nested-group" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', marginBottom: '8px' }}>
              <LayerCheckbox
                label="Rental Properties"
                icon="🏠"
                defaultOn={true}
                onChange={(on) => mapEngine?.toggleLayer('properties', on)}
              />
              <div className="nested-sub-options">
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', margin: '4px 0 2px', letterSpacing: '0.5px' }}>
                  Color Pins By
                </div>
                {[
                  { value: 'rating', label: '⭐ Rating / Priority' },
                  { value: 'commute', label: '🚗 Work Commute Speed' },
                  { value: 'rent', label: '💵 Rent Price Level' },
                ].map(opt => (
                  <label key={opt.value} className="layer-checkbox-subitem">
                    <input
                      type="radio"
                      name="pin-color-mode"
                      value={opt.value}
                      checked={pinColorMode === opt.value}
                      onChange={() => handlePinColorChange(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}

                <div style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', margin: '8px 0 2px', letterSpacing: '0.5px' }}>
                  Rating Sublayers
                </div>
                {[
                  { tier: 'top', label: '⭐ Top Choice', count: ratingCounts?.top || 0 },
                  { tier: 'strong', label: '🔷 1 - Strong', count: ratingCounts?.strong || 0 },
                  { tier: 'backup', label: '🔶 2 - Backup', count: ratingCounts?.backup || 0 },
                  { tier: 'low', label: '◽ 3 - Low & Unrated', count: ratingCounts?.low || 0 },
                  { tier: 'pass', label: '✕ Pass / Rejected', count: ratingCounts?.pass || 0 },
                ].map(({ tier, label, count }) => (
                  <label key={tier} className="layer-checkbox-subitem">
                    <input
                      type="checkbox"
                      checked={ratingSublayers[tier]}
                      onChange={(e) => handleRatingSublayer(tier, e.target.checked)}
                    />
                    <span>{label} ({count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Work Destination */}
            <LayerCheckbox
              label="Work Destination"
              icon="★"
              defaultOn={true}
              onChange={(on) => mapEngine?.toggleLayer('destinations', on)}
            />

            {/* Crime & Safety Overlay */}
            <CrimeLayerGroup mapEngine={mapEngine} />

            {/* Hazard layers — generated from campaign config */}
            {hazardLayers.map(layer => (
              <HazardLayerGroup key={layer.id} layer={layer} mapEngine={mapEngine} />
            ))}

            {/* POI layers — generated from campaign config */}
            {poiLayers.map(layer => (
              <LayerCheckbox
                key={layer.id}
                label={layer.name}
                icon={poiIcons[layer.category] || '📍'}
                defaultOn={true}
                onChange={(on) => mapEngine?.toggleLayer(layer.category || layer.id, on)}
              />
            ))}

            {/* Odor zones (if present in data — not from config, detected at runtime) */}
            <OdorLayerGroup mapEngine={mapEngine} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Config-driven hazard layer group with buffer sub-options. */
function HazardLayerGroup({ layer, mapEngine }) {
  const warningRadius = layer.warning_radius_mi || 1.0;
  const advisoryRadius = warningRadius * 2;

  const [show1Mi, setShow1Mi] = useState(true);
  const [show2Mi, setShow2Mi] = useState(true);

  const syncState = useCallback((enabled, s1, s2) => {
    mapEngine?.setSuperfundState({ enabled, show1Mi: s1, show2Mi: s2 });
  }, [mapEngine]);

  return (
    <LayerGroup
      label={layer.name}
      icon="⚠️"
      defaultOn={false}
      onMasterChange={(on) => syncState(on, show1Mi, show2Mi)}
    >
      <label className="layer-checkbox-subitem">
        <input
          type="checkbox"
          checked={show1Mi}
          onChange={(e) => { setShow1Mi(e.target.checked); syncState(true, e.target.checked, show2Mi); }}
        />
        <span>🔴 {warningRadius.toFixed(1)} mi Buffer (Caution)</span>
      </label>
      <label className="layer-checkbox-subitem">
        <input
          type="checkbox"
          checked={show2Mi}
          onChange={(e) => { setShow2Mi(e.target.checked); syncState(true, show1Mi, e.target.checked); }}
        />
        <span>🟡 {advisoryRadius.toFixed(1)} mi Buffer (Advisory)</span>
      </label>
    </LayerGroup>
  );
}

/** Crime & safety overlay group. */
function CrimeLayerGroup({ mapEngine }) {
  const [mode, setMode] = useState('property');

  const syncState = useCallback((enabled, crimeMode) => {
    mapEngine?.setCrimeState({ enabled, mode: crimeMode });
  }, [mapEngine]);

  return (
    <LayerGroup
      label="Crime & Safety Overlay"
      icon="🛡️"
      defaultOn={false}
      onMasterChange={(on) => syncState(on, mode)}
    >
      {[
        { value: 'property', label: '🚗 Vehicle & Property Crime' },
        { value: 'violent', label: '🚶 Violent Crime & Safety' },
        { value: 'overall', label: '🌐 Overall Safety Grade' },
      ].map(opt => (
        <label key={opt.value} className="layer-checkbox-subitem">
          <input
            type="radio"
            name="crime-mode"
            value={opt.value}
            checked={mode === opt.value}
            onChange={() => { setMode(opt.value); syncState(true, opt.value); }}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </LayerGroup>
  );
}

/** Odor zones group (Milpitas-specific but rendered generically). */
function OdorLayerGroup({ mapEngine }) {
  const [showStrong, setShowStrong] = useState(true);
  const [showMild, setShowMild] = useState(true);

  const syncState = useCallback((enabled, strong, mild) => {
    mapEngine?.setOdorState({ enabled, showStrong: strong, showMild: mild });
  }, [mapEngine]);

  return (
    <LayerGroup
      label="Odor / Air Quality Zones"
      icon="💨"
      defaultOn={false}
      onMasterChange={(on) => syncState(on, showStrong, showMild)}
    >
      <label className="layer-checkbox-subitem">
        <input
          type="checkbox"
          checked={showStrong}
          onChange={(e) => { setShowStrong(e.target.checked); syncState(true, e.target.checked, showMild); }}
        />
        <span>🟣 High Impact Zone</span>
      </label>
      <label className="layer-checkbox-subitem">
        <input
          type="checkbox"
          checked={showMild}
          onChange={(e) => { setShowMild(e.target.checked); syncState(true, showStrong, e.target.checked); }}
        />
        <span>🟠 Mild Advisory Zone</span>
      </label>
    </LayerGroup>
  );
}
