import { useContext, useCallback } from 'preact/hooks';
import { AppContext } from '../context.js';
import { getListingUrl, parseMediaUrls, isSafeGrade, getCommute, getCommuteMins } from '../lib/utils.js';

/**
 * Individual listing card component.
 * Uses JSX auto-escaping — no manual escapeHtml needed.
 */
export function ListingCard({ item, isCompared, onSelect, onToggleCompare, onHighlight, onToggleHide }) {
  const { annotationManager, primaryDestId } = useContext(AppContext);
  const ann = annotationManager.get(item.id);

  const commuteMins = getCommuteMins(item, primaryDestId);
  const commuteStr = getCommute(item, primaryDestId);
  const commuteClass = commuteMins != null
    ? (commuteMins <= 15 ? '' : commuteMins <= 25 ? 'moderate' : 'heavy')
    : '';

  const sfMi = item.hazard_proximity?.superfund_mi;
  const sfGrade = item.hazard_proximity?.superfund_grade;
  const isSafe = isSafeGrade(sfGrade);

  const listingUrl = getListingUrl(item);
  const hasNotes = ann.highlights || ann.lowlights || ann.user_notes;
  const notesPreview = ann.highlights || ann.lowlights || ann.user_notes || '';

  const unitLabel = [];
  if (item.bedrooms != null) unitLabel.push(item.bedrooms === 0 ? 'Studio' : `${item.bedrooms}BR`);
  if (item.bathrooms != null) unitLabel.push(`${item.bathrooms}BA`);
  if (item.sqft) unitLabel.push(`${item.sqft.toLocaleString()} sqft`);

  const ratingLabel = ann.rating
    ? (ann.rating === 'Top' ? '⭐ Top' : ann.rating === 'Pass' ? '✕ Pass' : `#${ann.rating}`)
    : '';

  const handleCardClick = useCallback((e) => {
    // Don't trigger if clicking buttons/links/checkboxes
    if (e.target.closest('button, a, input')) return;
    onSelect(item.id);
  }, [item.id, onSelect]);

  return (
    <div
      className="listing-card"
      onClick={handleCardClick}
      onMouseEnter={() => onHighlight(item.id)}
    >
      <div className="card-top-row">
        <div className="card-title-group">
          <div className="property-title">
            {item.title || item.property_name || 'Untitled'}
            {item.unit_number && <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.85em' }}> · {item.unit_number}</span>}
          </div>
          <div className="property-address">
            {item.street_address && `${item.street_address}, `}{item.city}
          </div>
        </div>
        <div className="card-price-group">
          <div className="price-main">{item.rent_display || '—'}</div>
          {item.sqft && item.rent_min && (
            <div className="price-sqft">${(item.rent_min / item.sqft).toFixed(2)}/sqft</div>
          )}
        </div>
      </div>

      <div className="card-badges-row">
        {unitLabel.length > 0 && (
          <span className="badge badge-spec">{unitLabel.join(' · ')}</span>
        )}
        {commuteStr !== 'N/A' && (
          <span className={`badge badge-commute ${commuteClass}`}>🚗 {commuteStr}</span>
        )}
        {sfMi != null && (
          <span className={`badge badge-hazard ${isSafe ? 'safe' : ''}`}>
            {isSafe ? '✓' : '⚠️'} {sfMi.toFixed(1)} mi {sfGrade && `(${sfGrade})`}
          </span>
        )}
        {ratingLabel && (
          <span className="badge" style={{ background: 'var(--purple-light)', color: '#c084fc' }}>
            {ratingLabel}
          </span>
        )}
        {ann.visit_status === 'visited' && (
          <span className="badge" style={{ background: 'var(--success-light)', color: '#34d399' }}>
            ✅ Visited
          </span>
        )}
      </div>

      {hasNotes && (
        <div className="card-notes-preview">{notesPreview}</div>
      )}

      <div className="card-footer-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#38bdf8', fontSize: '0.75rem', textDecoration: 'underline' }}
            onClick={(e) => e.stopPropagation()}
          >
            View Listing ↗
          </a>
          {item.available_date && (
            <span>Avail: {item.available_date}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}>
            <input
              type="checkbox"
              checked={isCompared}
              onChange={(e) => onToggleCompare(item.id, e.target.checked)}
            />
            Compare
          </label>
          <button
            className="btn-secondary btn-sm btn-hide-toggle"
            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
            onClick={(e) => { e.stopPropagation(); onToggleHide(item.id); }}
          >
            {ann.hidden ? '👁️ Restore' : '🚫 Hide'}
          </button>
        </div>
      </div>
    </div>
  );
}
