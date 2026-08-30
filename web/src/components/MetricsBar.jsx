import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../context.js';
import { getCommuteMins } from '../lib/utils.js';

/**
 * Sub-header metrics ribbon showing aggregate stats.
 */
export function MetricsBar({ onViewHidden }) {
  const { listings, annotationManager, primaryDestId } = useContext(AppContext);

  const metrics = useMemo(() => {
    const total = listings.length;
    const rents = listings.map(l => l.rent_min).filter(Boolean);
    const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : 0;
    const minRent = rents.length ? Math.min(...rents) : 0;
    const maxRent = rents.length ? Math.max(...rents) : 0;

    const commutes = listings.map(l => getCommuteMins(l, primaryDestId)).filter(c => c != null);
    const avgCommute = commutes.length ? Math.round(commutes.reduce((a, b) => a + b, 0) / commutes.length) : null;

    let visited = 0;
    let shortlisted = 0;
    for (const item of listings) {
      const ann = annotationManager.get(item.id);
      if (ann.visit_status === 'visited') visited++;
      if (ann.rating && ann.rating !== 'Pass' && ann.rating !== '0') shortlisted++;
    }

    const hiddenCount = annotationManager.getHiddenCount();

    return { total, avgRent, minRent, maxRent, avgCommute, visited, shortlisted, hiddenCount };
  }, [listings, annotationManager, primaryDestId]);

  return (
    <section className="metrics-bar">
      <div className="metric-pill">
        <span className="label">Properties</span>
        <span className="val">{metrics.total}</span>
      </div>
      <div className="metric-pill">
        <span className="label">Avg Rent</span>
        <span className="val">${metrics.avgRent.toLocaleString()}</span>
      </div>
      <div className="metric-pill">
        <span className="label">Range</span>
        <span className="val">${metrics.minRent.toLocaleString()} – ${metrics.maxRent.toLocaleString()}</span>
      </div>
      {metrics.avgCommute != null && (
        <div className="metric-pill">
          <span className="label">Avg Commute</span>
          <span className="val">{metrics.avgCommute} min</span>
        </div>
      )}
      <div className="metric-pill">
        <span className="label">Visited</span>
        <span className="val">{metrics.visited}</span>
      </div>
      <div className="metric-pill">
        <span className="label">Shortlisted</span>
        <span className="val">{metrics.shortlisted}</span>
      </div>
      {metrics.hiddenCount > 0 && (
        <div className="metric-pill" style={{ cursor: 'pointer' }} onClick={onViewHidden}>
          <span className="label">Hidden</span>
          <span className="val" style={{ color: '#64748b' }}>{metrics.hiddenCount}</span>
        </div>
      )}
    </section>
  );
}
