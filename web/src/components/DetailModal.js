/**
 * Property Detail & Annotation Modal Component.
 */

export function showDetailModal(item, annotation, onSaveAnnotation, onClose) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  const sfDist = item.hazard_proximity?.superfund_mi ?? 'N/A';
  const commute = item.commute?.intel_sc2?.avg_min ? `${item.commute.intel_sc2.avg_min} min (${item.commute.intel_sc2.range || ''})` : 'N/A';

  // Appliance items
  const apps = item.amenities?.appliances || {};
  const appList = Object.entries(apps)
    .filter(([_, v]) => v)
    .map(([k, _]) => `<span class="badge badge-spec">✓ ${k.charAt(0).toUpperCase() + k.slice(1)}</span>`)
    .join(' ') || '<span style="color: var(--text-dim);">None specified</span>';

  // Utilities included
  const utils = item.amenities?.utilities_included || {};
  const utilList = Object.entries(utils)
    .filter(([_, v]) => v)
    .map(([k, _]) => `<span class="badge badge-spec" style="color: #34d399;">✓ ${k.charAt(0).toUpperCase() + k.slice(1)}</span>`)
    .join(' ') || '<span style="color: var(--text-dim);">Tenant pays all utilities</span>';

  container.innerHTML = `
    <div class="modal-header">
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">${item.title}</h2>
        <p style="font-size: 0.875rem; color: var(--text-muted);">${item.street_address}, ${item.city}, CA ${item.zip}</p>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <!-- Core Specs Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Monthly Rent</div>
        <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); color: #38bdf8;">${item.rent_display}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Layout / Size</div>
        <div style="font-weight: 700; font-size: 1rem;">${item.bedrooms} Bed / ${item.bathrooms} Bath</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.sqft ? `${item.sqft} sq ft` : ''}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Intel SC2 Commute</div>
        <div style="font-weight: 700; font-size: 1rem; color: #34d399;">⚡ ${commute}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">9:00 AM Arrival</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Superfund Site</div>
        <div style="font-weight: 700; font-size: 1rem; color: #f87171;">🛡️ ${sfDist} mi</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Nearest EPA Site</div>
      </div>
    </div>

    <!-- Detailed Amenities & Policies -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Amenities & Features</h4>
        <p><strong>Laundry:</strong> ${item.amenities?.laundry || 'Unspecified'} ${item.amenities?.laundry_note ? `(${item.amenities.laundry_note})` : ''}</p>
        <p style="margin-top: 0.25rem;"><strong>Cooling / AC:</strong> ${item.amenities?.cooling || 'None listed'}</p>
        <p style="margin-top: 0.25rem;"><strong>Heating:</strong> ${item.amenities?.heating || 'None listed'}</p>
        <p style="margin-top: 0.25rem;"><strong>Parking:</strong> ${item.amenities?.parking || 'Unspecified'}</p>
        <div style="margin-top: 0.5rem;">
          <strong>Appliances:</strong><br>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">${appList}</div>
        </div>
      </div>

      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Lease & Pet Policies</h4>
        <p><strong>Lease Terms:</strong> ${item.lease_length || 'Standard 12 months'}</p>
        <p style="margin-top: 0.25rem;"><strong>Pets:</strong> ${item.pets?.allowed ? 'Yes' : 'No'} ${item.pets?.note ? `• ${item.pets.note}` : ''}</p>
        <p style="margin-top: 0.25rem;"><strong>Pet Rent:</strong> ${item.pets?.monthly_fee || 'None'} • <strong>Deposit:</strong> ${item.pets?.deposit || 'None'}</p>
        <div style="margin-top: 0.5rem;">
          <strong>Utilities Included:</strong><br>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">${utilList}</div>
        </div>
      </div>
    </div>

    <!-- User Curation & Notes Form -->
    <div style="background: var(--bg-surface-2); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--primary-light);">
      <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>📝 Your Personal Curation & Visit Notes</span>
        <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 400;">(Saved locally instantly)</span>
      </h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Rating / Priority</label>
          <select id="edit-rating" class="btn-secondary" style="width: 100%; height: 36px; border-radius: var(--radius-sm);">
            <option value="" ${!annotation.rating ? 'selected' : ''}>Unrated</option>
            <option value="Top" ${annotation.rating === 'Top' ? 'selected' : ''}>⭐ Top Choice</option>
            <option value="1" ${annotation.rating === '1' ? 'selected' : ''}>1 (Strong contender)</option>
            <option value="2" ${annotation.rating === '2' ? 'selected' : ''}>2 (Backup)</option>
            <option value="3" ${annotation.rating === '3' ? 'selected' : ''}>3 (Low priority)</option>
            <option value="Pass" ${annotation.rating === 'Pass' ? 'selected' : ''}>✕ Pass</option>
          </select>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Visit Status</label>
          <select id="edit-visit-status" class="btn-secondary" style="width: 100%; height: 36px; border-radius: var(--radius-sm);">
            <option value="unvisited" ${annotation.visit_status === 'unvisited' ? 'selected' : ''}>Unvisited</option>
            <option value="interested" ${annotation.visit_status === 'interested' ? 'selected' : ''}>Interested</option>
            <option value="scheduled" ${annotation.visit_status === 'scheduled' ? 'selected' : ''}>Tour Scheduled</option>
            <option value="visited" ${annotation.visit_status === 'visited' ? 'selected' : ''}>✅ Visited</option>
            <option value="applied" ${annotation.visit_status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="rejected" ${annotation.visit_status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
        <div>
          <label style="font-size: 0.75rem; color: #34d399; display: block; margin-bottom: 0.25rem;">Highlights / Pros</label>
          <textarea id="edit-highlights" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;">${annotation.highlights || ''}</textarea>
        </div>
        <div>
          <label style="font-size: 0.75rem; color: #f87171; display: block; margin-bottom: 0.25rem;">Lowlights / Cons</label>
          <textarea id="edit-lowlights" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;">${annotation.lowlights || ''}</textarea>
        </div>
      </div>

      <div>
        <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Personal Notes</label>
        <textarea id="edit-notes" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;">${annotation.user_notes || ''}</textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
        <button id="save-annotation-btn" class="btn-primary">
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');
  container.classList.remove('hidden');

  const closeFn = () => {
    backdrop.classList.add('hidden');
    container.classList.add('hidden');
    onClose && onClose();
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', closeFn);
  backdrop.onclick = closeFn;

  document.getElementById('save-annotation-btn')?.addEventListener('click', () => {
    const rating = document.getElementById('edit-rating')?.value;
    const visit_status = document.getElementById('edit-visit-status')?.value;
    const highlights = document.getElementById('edit-highlights')?.value;
    const lowlights = document.getElementById('edit-lowlights')?.value;
    const user_notes = document.getElementById('edit-notes')?.value;

    onSaveAnnotation(item.id, { rating, visit_status, highlights, lowlights, user_notes });
    closeFn();
  });
}
