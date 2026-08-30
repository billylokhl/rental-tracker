import { useRef, useEffect, useContext, useCallback } from 'preact/hooks';
import { AppContext } from '../context.js';
import { MapEngine } from '../lib/MapEngine.js';
import { LayerDrawer } from './LayerDrawer.jsx';

/**
 * Map pane component. Bridges Preact rendering with the imperative Leaflet MapEngine.
 * The map is initialized once via a ref and never re-rendered by Preact.
 */
export function MapPane({ filteredListings, activeListingId, onSelectListing, ratingCounts }) {
  const { campaignData, annotationManager } = useContext(AppContext);
  const mapElRef = useRef(null);
  const engineRef = useRef(null);

  // Initialize map engine once
  useEffect(() => {
    if (!mapElRef.current || !campaignData || engineRef.current) return;

    const { campaign, destinations, hazards, pois, odor_zones, crime_data } = campaignData;
    const engine = new MapEngine('map-element', campaign, (listingId) => {
      onSelectListing(listingId);
    });

    engine.renderDestinations(destinations);
    engine.renderHazards(hazards, true);
    engine.renderPois(pois);
    engine.renderOdorZone(odor_zones);
    engine.renderCrimeZones(crime_data);

    engineRef.current = engine;

    // Cleanup on unmount
    return () => {
      if (engineRef.current?.map) {
        engineRef.current.map.remove();
        engineRef.current = null;
      }
    };
  }, [campaignData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update property markers when filtered listings change
  useEffect(() => {
    if (!engineRef.current || !filteredListings) return;
    engineRef.current.renderProperties(
      filteredListings,
      activeListingId,
      annotationManager.annotations
    );
    engineRef.current.updateMapLegend();
  }, [filteredListings, activeListingId, annotationManager.annotations]);

  // Expose highlightProperty for card hover
  const highlightProperty = useCallback((listingId) => {
    engineRef.current?.highlightProperty(listingId);
  }, []);

  // Invalidate map size when pane becomes visible (mobile tab switch)
  const invalidateSize = useCallback(() => {
    setTimeout(() => engineRef.current?.map?.invalidateSize(), 200);
  }, []);

  return (
    <section id="map-pane" className="map-pane">
      <div id="map-element" className="leaflet-map" ref={mapElRef} />

      {campaignData && (
        <LayerDrawer
          campaign={campaignData.campaign}
          mapEngine={engineRef.current}
          ratingCounts={ratingCounts}
        />
      )}

      {/* Mobile bottom-sheet preview placeholder — rendered by App when needed */}
      <div id="mobile-sheet-preview" className="mobile-sheet-preview hidden" />
    </section>
  );
}

// Export the ref-based methods for parent component use
MapPane.getEngine = (ref) => ref.current;
