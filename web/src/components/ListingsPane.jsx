import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../context.js';
import { ListingCard } from './ListingCard.jsx';
import { TableView } from './TableView.jsx';

/**
 * Left pane containing filter results count, view toggles, and listing cards/table.
 */
export function ListingsPane({
  filteredListings,
  viewMode,
  onSetViewMode,
  comparedIds,
  onSelectListing,
  onToggleCompare,
  onHighlightListing,
  onToggleHide,
  onViewCompare,
  filterStatus,
  onRestoreAllHidden,
  onExitHiddenView,
}) {
  const { listings: allListings, annotationManager } = useContext(AppContext);

  return (
    <>
      {/* Meta row with count and view controls */}
      <div className="listings-meta-row">
        <div className="results-count">
          Showing {filteredListings.length} of {allListings.length} candidate properties
        </div>
        <div className="view-controls">
          <button
            className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
            title="Card View"
            onClick={() => onSetViewMode('cards')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Cards</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            title="Table View"
            onClick={() => onSetViewMode('table')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3z" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
            </svg>
            <span>Table</span>
          </button>
          <button
            className="btn-secondary btn-sm"
            title="Compare Selected"
            onClick={onViewCompare}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Compare ({comparedIds.size})</span>
          </button>
        </div>
      </div>

      {/* Listings scroll area */}
      <div className="listings-scroll-area">
        {/* Hidden view banner */}
        {filterStatus === 'hidden' && (
          <HiddenBanner
            count={filteredListings.length}
            onRestoreAll={onRestoreAllHidden}
            onExit={onExitHiddenView}
          />
        )}

        {viewMode === 'cards' ? (
          filteredListings.length === 0 ? (
            <EmptyState isHidden={filterStatus === 'hidden'} />
          ) : (
            filteredListings.map(item => (
              <ListingCard
                key={item.id}
                item={item}
                isCompared={comparedIds.has(item.id)}
                onSelect={onSelectListing}
                onToggleCompare={onToggleCompare}
                onHighlight={onHighlightListing}
                onToggleHide={onToggleHide}
              />
            ))
          )
        ) : (
          <TableView
            listings={filteredListings}
            comparedIds={comparedIds}
            onSelect={onSelectListing}
            onToggleCompare={onToggleCompare}
            onToggleHide={onToggleHide}
          />
        )}
      </div>
    </>
  );
}

function HiddenBanner({ count, onRestoreAll, onExit }) {
  return (
    <div className="hidden-view-banner">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🚫</span>
          <div>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>
              Viewing {count} Hidden / Dismissed Listing{count === 1 ? '' : 's'}
            </strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Click "👁️ Restore" on any listing below to return it to your active search.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {count > 0 && (
            <button
              className="btn-secondary btn-sm"
              style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
              onClick={onRestoreAll}
            >
              👁️ Restore All ({count})
            </button>
          )}
          <button className="btn-primary btn-sm" style={{ background: '#0284c7' }} onClick={onExit}>
            ↩️ Back to Active Listings
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ isHidden }) {
  return (
    <div className="empty-state">
      {isHidden ? (
        <>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <h3>No Hidden Listings</h3>
          <p>You haven't hidden or dismissed any listings yet.</p>
        </>
      ) : (
        <>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h3>No listings match your filters</h3>
          <p>Try clearing some filters or expanding your search radius.</p>
        </>
      )}
    </div>
  );
}
