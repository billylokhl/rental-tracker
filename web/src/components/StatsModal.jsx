import { useContext, useMemo } from 'preact/hooks';
import { AppContext } from '../context.js';
import { Modal } from './Modal.jsx';

/**
 * Stats/insights modal showing city breakdown and distribution.
 */
export function StatsModal({ onClose }) {
  const { listings, annotationManager } = useContext(AppContext);

  const stats = useMemo(() => {
    const cityMap = {};
    let totalRent = 0;
    let rentCount = 0;
    let visited = 0;
    let shortlisted = 0;
    const sfDistances = [];

    for (const item of listings) {
      const city = item.city || 'Unknown';
      if (!cityMap[city]) cityMap[city] = { count: 0, rents: [] };
      cityMap[city].count++;
      if (item.rent_min) {
        cityMap[city].rents.push(item.rent_min);
        totalRent += item.rent_min;
        rentCount++;
      }
      if (item.hazard_proximity?.superfund_mi != null) {
        sfDistances.push(item.hazard_proximity.superfund_mi);
      }
      const ann = annotationManager.get(item.id);
      if (ann.visit_status === 'visited') visited++;
      if (ann.rating && ann.rating !== 'Pass' && ann.rating !== '0') shortlisted++;
    }

    const cities = Object.entries(cityMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgRent: data.rents.length ? Math.round(data.rents.reduce((a, b) => a + b, 0) / data.rents.length) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const avgRent = rentCount ? Math.round(totalRent / rentCount) : 0;

    // Superfund distribution
    const sfBuckets = { under1: 0, '1to2': 0, '2to3': 0, over3: 0 };
    for (const d of sfDistances) {
      if (d < 1) sfBuckets.under1++;
      else if (d < 2) sfBuckets['1to2']++;
      else if (d < 3) sfBuckets['2to3']++;
      else sfBuckets.over3++;
    }

    return { cities, total: listings.length, avgRent, visited, shortlisted, sfBuckets, sfTotal: sfDistances.length };
  }, [listings, annotationManager]);

  return (
    <Modal title="Campaign Insights" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Avg Rent" value={`$${stats.avgRent.toLocaleString()}`} />
        <StatCard label="Visited" value={stats.visited} />
        <StatCard label="Shortlisted" value={stats.shortlisted} />
      </div>

      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
        📊 By City
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {stats.cities.map(city => (
          <div key={city.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 600 }}>{city.name}</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{city.count} listings</span>
              {city.avgRent > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                  avg ${city.avgRent.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {stats.sfTotal > 0 && (
        <>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
            ☢️ Superfund Distance Distribution
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            <DistBar label="< 1 mi" count={stats.sfBuckets.under1} total={stats.sfTotal} color="#ef4444" />
            <DistBar label="1-2 mi" count={stats.sfBuckets['1to2']} total={stats.sfTotal} color="#f59e0b" />
            <DistBar label="2-3 mi" count={stats.sfBuckets['2to3']} total={stats.sfTotal} color="#38bdf8" />
            <DistBar label="> 3 mi" count={stats.sfBuckets.over3} total={stats.sfTotal} color="#10b981" />
          </div>
        </>
      )}
    </Modal>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '0.75rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

function DistBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '0.25rem' }}>
        <div style={{ width: '24px', height: `${Math.max(pct, 5)}%`, background: color, borderRadius: '3px 3px 0 0' }} />
      </div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color }}>{count}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
