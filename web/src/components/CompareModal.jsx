import { useContext } from 'preact/hooks';
import { AppContext } from '../context.js';
import { Modal } from './Modal.jsx';
import { getCommute, getCommuteMins, isSafeGrade } from '../lib/utils.js';

/**
 * Side-by-side comparison modal for up to 4 listings.
 */
export function CompareModal({ items, onClose }) {
  const { annotationManager, primaryDestId } = useContext(AppContext);

  if (!items.length) {
    return (
      <Modal title="Compare Properties" onClose={onClose}>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
          No properties selected for comparison. Check the compare boxes on listing cards.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={`Compare ${items.length} Properties`} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: '1rem', overflowX: 'auto' }}>
        {items.map(item => {
          const ann = annotationManager.get(item.id);
          const sfMi = item.hazard_proximity?.superfund_mi;
          const sfGrade = item.hazard_proximity?.superfund_grade;
          const commute = getCommute(item, primaryDestId);

          return (
            <div key={item.id} style={{ background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {item.title}
                {item.unit_number && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> · {item.unit_number}</span>}
              </h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {item.street_address && `${item.street_address}, `}{item.city}
              </div>

              <CompareRow label="Rent" value={item.rent_display || '—'} highlight />
              <CompareRow label="Beds" value={item.bedrooms != null ? (item.bedrooms === 0 ? 'Studio' : `${item.bedrooms} BR`) : '—'} />
              <CompareRow label="Baths" value={item.bathrooms != null ? `${item.bathrooms} BA` : '—'} />
              <CompareRow label="Sqft" value={item.sqft ? item.sqft.toLocaleString() : '—'} />
              <CompareRow label="Commute" value={commute} />
              <CompareRow
                label="Superfund"
                value={sfMi != null ? `${sfMi.toFixed(1)} mi (${sfGrade || '?'})` : '—'}
                warn={sfGrade && !isSafeGrade(sfGrade)}
              />
              <CompareRow label="Laundry" value={item.amenities?.laundry || '—'} />
              <CompareRow label="Parking" value={item.amenities?.parking || '—'} />
              <CompareRow label="A/C" value={item.amenities?.cooling ? 'Yes' : '—'} />
              <CompareRow label="Pets" value={item.pets?.allowed ? `$${item.pets.deposit || 0} dep` : 'No'} />
              <CompareRow label="Rating" value={ann.rating || '—'} />
              <CompareRow label="Visit" value={ann.visit_status === 'visited' ? '✅ Visited' : '—'} />
              {ann.highlights && <CompareRow label="Pros" value={ann.highlights} />}
              {ann.lowlights && <CompareRow label="Cons" value={ann.lowlights} />}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function CompareRow({ label, value, highlight, warn }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontWeight: highlight ? 700 : 500,
        color: warn ? '#f87171' : (highlight ? '#38bdf8' : 'var(--text-main)'),
        fontFamily: highlight ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
