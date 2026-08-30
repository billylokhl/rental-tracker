import { useContext } from 'preact/hooks';
import { AppContext } from '../context.js';
import { getListingUrl, isSafeGrade, getCommute, getCommuteMins, formatUnitBadge } from '../lib/utils.js';

/**
 * Table view of listings. Each row is clickable to open detail modal.
 */
export function TableView({ listings, comparedIds, onSelect, onToggleCompare, onToggleHide }) {
  const { annotationManager, primaryDestId } = useContext(AppContext);

  if (!listings.length) {
    return (
      <div className="empty-state">
        <h3>No listings match your filters</h3>
        <p>Try clearing some filters.</p>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>⇄</th>
            <th>Property</th>
            <th>Rent</th>
            <th>Specs</th>
            <th>Commute</th>
            <th>Safety</th>
            <th>Rating</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {listings.map(item => {
            const ann = annotationManager.get(item.id);
            const sfMi = item.hazard_proximity?.superfund_mi;
            const sfGrade = item.hazard_proximity?.superfund_grade;
            return (
              <tr key={item.id} onClick={() => onSelect(item.id)} style={{ cursor: 'pointer' }}>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={comparedIds.has(item.id)}
                    onChange={(e) => onToggleCompare(item.id, e.target.checked)}
                  />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.street_address && `${item.street_address}, `}{item.city}
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                  {item.rent_display || '—'}
                </td>
                <td style={{ fontSize: '0.75rem' }}>{formatUnitBadge(item)}</td>
                <td>{getCommute(item, primaryDestId)}</td>
                <td>
                  {sfMi != null && (
                    <span style={{ color: isSafeGrade(sfGrade) ? 'var(--text-muted)' : '#f87171' }}>
                      {sfMi.toFixed(1)} mi {sfGrade && `(${sfGrade})`}
                    </span>
                  )}
                </td>
                <td>{ann.rating || '—'}</td>
                <td>
                  {ann.visit_status === 'visited' && '✅'}
                  {ann.hidden && '🚫'}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-secondary btn-sm btn-row-hide"
                    style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                    onClick={() => onToggleHide(item.id)}
                  >
                    {ann.hidden ? '👁️' : '🚫'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
