import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { AppContext } from './context.js';
import { AnnotationManager } from './lib/AnnotationManager.js';
import { GitHubSync } from './lib/GitHubSync.js';
import { filterListings, sortListings } from './lib/filters.js';
import { getCommuteMins, getListingUrl, parseMediaUrls } from './lib/utils.js';
import { Header } from './components/Header.jsx';
import { MetricsBar } from './components/MetricsBar.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { ListingsPane } from './components/ListingsPane.jsx';
import { MapPane } from './components/MapPane.jsx';
import { MobileNav } from './components/MobileNav.jsx';
import { Toast } from './components/Toast.jsx';
import { CompareModal } from './components/CompareModal.jsx';
import { StatsModal } from './components/StatsModal.jsx';
import { SyncModal } from './components/SyncModal.jsx';
import { AddListingModal } from './components/AddListingModal.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

// Lazy-load DetailModal since it's the largest component
let DetailModal = null;
const loadDetailModal = () => import('./components/DetailModal.jsx').then(m => { DetailModal = m.DetailModal; });

export function App() {
  // Core state
  const [campaignData, setCampaignData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filterState, setFilterState] = useState(FilterBar.defaultState);
  const [viewMode, setViewMode] = useState('cards');
  const [comparedIds, setComparedIds] = useState(new Set());
  const [activeListingId, setActiveListingId] = useState(null);
  const [mobileTab, setMobileTab] = useState('list');
  const [mobileSheetItem, setMobileSheetItem] = useState(null);
  const [toast, setToast] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null); // { type, props }

  // Refs for non-reactive state
  const gitHubSyncRef = useRef(new GitHubSync());
  const annotationManagerRef = useRef(null);
  const mapPaneRef = useRef(null);

  // Version counter to force re-renders when annotations change
  const [annotationVersion, setAnnotationVersion] = useState(0);

  // Fetch campaign data on mount
  useEffect(() => {
    (async () => {
      try {
        const cacheBust = `?t=${Date.now()}`;
        let resp = await fetch(`./data/campaign_data.json${cacheBust}`).catch(() => null);
        if (!resp || !resp.ok) {
          resp = await fetch(`./public/data/campaign_data.json${cacheBust}`).catch(() => null);
        }
        if (!resp || !resp.ok) throw new Error('Failed to load campaign data');
        const data = await resp.json();
        setCampaignData(data);

        // Wire up repo coordinates
        if (data.repo) {
          gitHubSyncRef.current.setRepoFromBundle(data.repo);
        }
      } catch (e) {
        setLoadError(e.message);
      }
    })();
    // Preload DetailModal
    loadDetailModal();
  }, []);

  // Initialize annotation manager when campaign data loads
  useEffect(() => {
    if (!campaignData) return;
    const mgr = new AnnotationManager(campaignData.campaign.id, () => {
      setAnnotationVersion(v => v + 1);
    });
    mgr.mergeInitial(campaignData.annotations);
    annotationManagerRef.current = mgr;
    setAnnotationVersion(v => v + 1);
  }, [campaignData]);

  // Derived state
  const annotationManager = annotationManagerRef.current;
  const primaryDestId = campaignData?.campaign?.target_destinations?.[0]
    || campaignData?.destinations?.[0]?.id
    || '';

  // Merged listings with annotation overrides applied
  const mergedListings = useMemo(() => {
    if (!campaignData || !annotationManager) return [];
    return annotationManager.applyOverridesAndUnits(campaignData.listings);
  }, [campaignData, annotationManager, annotationVersion]);

  // Filtered & sorted listings
  const filteredListings = useMemo(() => {
    if (!mergedListings.length || !annotationManager) return [];
    const filtered = filterListings(
      mergedListings,
      filterState,
      (id) => annotationManager.get(id),
      primaryDestId
    );
    return sortListings(filtered, filterState.sortBy || 'rent_asc', primaryDestId);
  }, [mergedListings, filterState, annotationManager, primaryDestId, annotationVersion]);

  // Rating counts for layer drawer
  const ratingCounts = useMemo(() => {
    if (!annotationManager || !mergedListings.length) return { top: 0, strong: 0, backup: 0, low: 0, pass: 0 };
    const counts = { top: 0, strong: 0, backup: 0, low: 0, pass: 0 };
    for (const item of mergedListings) {
      const ann = annotationManager.get(item.id);
      const rating = ann.rating || '';
      if (rating === 'Top') counts.top++;
      else if (rating === '1') counts.strong++;
      else if (rating === '2') counts.backup++;
      else if (rating === 'Pass' || rating === '0') counts.pass++;
      else counts.low++;
    }
    return counts;
  }, [mergedListings, annotationManager, annotationVersion]);

  // --- Callbacks ---

  const handleSelectListing = useCallback((listingId, fromMap = false) => {
    setActiveListingId(listingId);
    if (!annotationManager || !campaignData) return;

    const listings = annotationManager.applyOverridesAndUnits(campaignData.listings);
    const item = listings.find(l => l.id === listingId);
    if (!item) return;

    // On mobile map view, show bottom sheet instead of modal
    if (window.innerWidth < 768 && mobileTab === 'map') {
      setMobileSheetItem(item);
      return;
    }

    setModal({ type: 'detail', props: { item } });
  }, [annotationManager, campaignData, mobileTab]);

  const handleToggleCompare = useCallback((listingId, checked) => {
    setComparedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= 4) {
          alert('You can compare up to 4 properties simultaneously.');
          return prev;
        }
        next.add(listingId);
      } else {
        next.delete(listingId);
      }
      return next;
    });
  }, []);

  const handleToggleHide = useCallback((listingId) => {
    if (!annotationManager) return;
    const isNowHidden = annotationManager.toggleHidden(listingId);

    const item = campaignData.listings.find(l => l.id === listingId)
      || annotationManager.customUnits.find(u => u.id === listingId);
    const titleOverride = annotationManager.get(listingId).custom_overrides?.title;
    const itemTitle = titleOverride || item?.title || item?.property_name || 'Listing';

    if (isNowHidden) {
      setToast({
        message: `🚫 "${itemTitle}" hidden from main view.`,
        actionLabel: '↩️ Undo',
        onAction: () => handleToggleHide(listingId),
        secondaryLabel: `View All Hidden (${annotationManager.getHiddenCount()})`,
        onSecondary: () => setFilterState(prev => ({ ...prev, status: 'hidden' })),
        duration: 6000,
      });
    } else {
      setToast({ message: `👁️ "${itemTitle}" restored to active search.`, duration: 3500 });
    }
  }, [annotationManager, campaignData]);

  const handleHighlightListing = useCallback((listingId) => {
    mapPaneRef.current?.highlightProperty(listingId);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  }, []);

  const handleMobileTab = useCallback((tab) => {
    setMobileTab(tab);
    if (tab === 'stats') {
      setModal({ type: 'stats' });
    } else if (tab === 'filters') {
      document.querySelector('.filter-wrapper')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // --- Context value ---
  const contextValue = useMemo(() => ({
    campaign: campaignData?.campaign || {},
    campaignData,
    listings: mergedListings,
    annotationManager,
    gitHubSync: gitHubSyncRef.current,
    primaryDestId,
  }), [campaignData, mergedListings, annotationManager, primaryDestId, annotationVersion]);

  // --- Loading / Error states ---
  if (loadError) {
    return (
      <div className="app-container">
        <div className="empty-state" style={{ height: '100vh' }}>
          <h3>Unable to load campaign data</h3>
          <p>Please make sure the dataset is compiled and available at <code>data/campaign_data.json</code>.</p>
        </div>
      </div>
    );
  }

  if (!campaignData || !annotationManager) {
    return (
      <div className="app-container">
        <div className="loading-state" style={{ height: '100vh' }}>
          <div className="spinner" />
          <p>Loading candidate listings...</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <AppContext.Provider value={contextValue}>
      <div className={`app-container ${mobileTab === 'map' ? 'mobile-view-map' : ''}`} id="app">
        <Header
          onAddListing={() => setModal({ type: 'addListing' })}
          onSync={() => setModal({ type: 'sync' })}
          onExport={() => annotationManager.exportJson()}
          onImport={(data) => annotationManager.importJson(data)}
          onToggleTheme={toggleTheme}
        />

        <MetricsBar
          onViewHidden={() => setFilterState(prev => ({ ...prev, status: 'hidden' }))}
        />

        <ErrorBoundary>
          <main className="workspace-layout">
            <section id="listings-pane" className="listings-pane">
            <FilterBar
              filterState={filterState}
              onChange={setFilterState}
              hiddenCount={annotationManager.getHiddenCount()}
            />
            <ListingsPane
              filteredListings={filteredListings}
              viewMode={viewMode}
              onSetViewMode={setViewMode}
              comparedIds={comparedIds}
              onSelectListing={handleSelectListing}
              onToggleCompare={handleToggleCompare}
              onHighlightListing={handleHighlightListing}
              onToggleHide={handleToggleHide}
              onViewCompare={() => {
                const items = mergedListings.filter(l => comparedIds.has(l.id));
                setModal({ type: 'compare', props: { items } });
              }}
              filterStatus={filterState.status}
              onRestoreAllHidden={() => {
                const count = annotationManager.restoreAllHidden();
                setFilterState(prev => ({ ...prev, status: 'all' }));
                setToast({ message: `Restored ${count} listing${count === 1 ? '' : 's'} to your active search.`, duration: 3500 });
              }}
              onExitHiddenView={() => setFilterState(prev => ({ ...prev, status: 'all' }))}
            />
          </section>

          <MapPane
            ref={mapPaneRef}
            filteredListings={filteredListings}
            activeListingId={activeListingId}
            onSelectListing={handleSelectListing}
            ratingCounts={ratingCounts}
          />
          </main>
        </ErrorBoundary>

        <MobileNav activeTab={mobileTab} onTabChange={handleMobileTab} />

        {mobileSheetItem && window.innerWidth < 768 && mobileTab === 'map' && (
          <div className="mobile-sheet-preview" style={{ position: 'fixed', bottom: '60px', left: 0, right: 0, backgroundColor: 'var(--bg-panel)', padding: '1rem', borderTop: '1px solid var(--border)', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{mobileSheetItem.title}</h4>
                  <a href={getListingUrl(mobileSheetItem)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>Zillow ↗</a>
                  {parseMediaUrls(annotationManager.get(mobileSheetItem.id).media_album_url || '')[0] && (
                    <a href={parseMediaUrls(annotationManager.get(mobileSheetItem.id).media_album_url || '')[0]} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#34d399', textDecoration: 'underline', fontWeight: 700 }}>📸 Media ↗</a>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                  {mobileSheetItem.street_address ? `${mobileSheetItem.street_address}, ` : ''}{mobileSheetItem.city}
                </div>
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {mobileSheetItem.rent_display}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                className="btn-primary btn-sm" 
                style={{ flex: 1 }}
                onClick={() => {
                  const item = mobileSheetItem;
                  setMobileSheetItem(null);
                  setModal({ type: 'detail', props: { item } });
                }}
              >
                View Details & Notes
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setMobileSheetItem(null)}>Close</button>
            </div>
          </div>
        )}

        {/* Modals */}
        {modal?.type === 'detail' && DetailModal && (
          <DetailModal item={modal.props.item} onClose={() => setModal(null)} />
        )}
        {modal?.type === 'compare' && (
          <CompareModal items={modal.props.items} onClose={() => setModal(null)} />
        )}
        {modal?.type === 'stats' && (
          <StatsModal onClose={() => setModal(null)} />
        )}
        {modal?.type === 'sync' && (
          <SyncModal onClose={() => setModal(null)} />
        )}
        {modal?.type === 'addListing' && (
          <AddListingModal onClose={() => setModal(null)} />
        )}

        {/* Toast */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </AppContext.Provider>
  );
}


