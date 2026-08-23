import { formatUnitBadge } from './ListingCard.js?v=15';

export function showDetailModal(item, annotation, onSaveAnnotation, onSaveOverrides, onAddUnit, onDeleteListing, onClose) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  const sfDist = item.hazard_proximity?.superfund_mi ?? 'N/A';
  const commute = item.commute?.intel_sc2?.avg_min ? `${item.commute.intel_sc2.avg_min} min (${item.commute.intel_sc2.range || ''})` : 'N/A';
  const listingUrl = item.url || `https://www.zillow.com/homes/${encodeURIComponent(item.street_address + ' ' + item.city + ' CA ' + item.zip)}_rb/`;

  // Media Album URLs & Extracted Photos
  const mediaStr = annotation.media_album_url || item.media_album_url || '';
  const mediaUrls = mediaStr.split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
  const photos = item.photos || [];

  // Core specs
  const availDate = item.available_date || 'Available Now';
  const parkingStr = item.amenities?.parking || 'Unspecified';
  const appFee = item.application?.fee || 'None listed';
  const deposit = item.deposit || item.pets?.deposit || '1 Month or Contact';

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

  // Media Album Action Buttons
  const mediaLinksHtml = mediaUrls.map((url, i) => `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.85rem; border-radius: var(--radius-sm); box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
      <span>🎬 Watch Walkthrough Videos & Photos in Google Photos ${mediaUrls.length > 1 ? `(Album ${i+1})` : ''} ↗</span>
    </a>
  `).join(' ');

  // Photo Gallery Grid HTML
  const photosGridHtml = photos.length > 0 ? `
    <div style="margin-bottom: 1.25rem;">
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
        ${photos.map((imgUrl, idx) => `
          <a href="${imgUrl}" target="_blank" rel="noopener noreferrer" style="display: block; position: relative; height: 180px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-subtle); background: var(--bg-surface-2);" title="Click to view full resolution photo">
            <img src="${imgUrl}" alt="Tour photo ${idx+1}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px;">
              🔍 Full Size
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="modal-header">
      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">${item.title}</h2>
          ${item.unit_number ? `<span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.4); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${formatUnitBadge(item.unit_number)}</span>` : ''}
          <a href="${listingUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm" style="background: #0284c7; text-decoration: none; padding: 0.2rem 0.6rem;" title="Open listing on Zillow">
            <span>Zillow ↗</span>
          </a>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 2px;">${item.street_address ? `${item.street_address}, ` : ''}${item.city}, CA ${item.zip}</p>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <!-- Core Specs Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Monthly Rent</div>
        <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); color: #38bdf8;">${item.rent_display}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.rent_min && item.sqft ? `$${(item.rent_min/item.sqft).toFixed(2)}/sqft` : ''}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Layout / Size</div>
        <div style="font-weight: 700; font-size: 1rem;">${item.bedrooms} Bed / ${item.bathrooms} Bath</div>
        <div style="font-size: 0.75rem; color: #34d399; font-weight: 600;">${item.sqft ? `📐 ${item.sqft} sq ft` : 'Sqft not listed'}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Availability</div>
        <div style="font-weight: 700; font-size: 1rem; color: #fbbf24;">📅 ${availDate}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.lease_length || '12 months'}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Parking</div>
        <div style="font-weight: 700; font-size: 0.875rem; color: #a78bfa;">🚗 ${parkingStr}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.parking_fee ? `Fee: ${item.parking_fee}` : 'Check policy'}</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Work Commute</div>
        <div style="font-weight: 700; font-size: 1rem; color: #34d399;">⚡ ${commute}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">9:00 AM Arrival</div>
      </div>
      <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
        <div style="font-size: 0.75rem; color: var(--text-dim);">Superfund Site</div>
        <div style="font-weight: 700; font-size: 1rem; color: #f87171;">🛡️ ${sfDist} mi</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">Nearest EPA Site</div>
      </div>
    </div>

    <!-- Neighborhood Safety & Crime Profile -->
    ${item.crime_safety ? `
    <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
          🛡️ Neighborhood Safety & Crime Profile
          <span class="badge ${['A','A+','A-','B','B+'].includes(item.crime_safety.overall_safety_grade) ? 'badge-safe' : 'badge-warn'}">${item.crime_safety.overall_safety_grade}</span>
        </h4>
        <a href="https://www.crimemapping.com/map/ca/sanjose?lat=${item.location.lat}&lng=${item.location.lng}&zoom=15" target="_blank" class="btn-secondary btn-sm" style="text-decoration: none;">🔍 View Live 0.5-mi Blotter</a>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">🚗 Property & Vehicle</div>
          <div style="font-weight: 600; font-size: 0.9rem;">${item.crime_safety.property_grade} <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">(${item.crime_safety.property_crime_rate}/1k)</span></div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">🚶 Violent & Personal</div>
          <div style="font-weight: 600; font-size: 0.9rem;">${item.crime_safety.violent_grade} <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">(${item.crime_safety.violent_crime_rate}/1k)</span></div>
        </div>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-dim); font-style: italic;">"${item.crime_safety.highlights}"</div>
    </div>
    ` : ''}

    ${(photos.length > 0 || mediaUrls.length > 0) ? `
      <!-- Visual Tour Photos & Walkthrough Video Section -->
      <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.35rem;">📸</span>
            <div>
              <h3 style="color: #34d399; font-size: 1rem; font-weight: 800; margin: 0;">Tour Photos & Walkthrough Videos</h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${photos.length} photo(s) captured • ${mediaUrls.length} album link(s)</span>
            </div>
          </div>
        </div>

        ${photosGridHtml}

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${mediaLinksHtml}
        </div>
      </div>
    ` : ''}

    <!-- Detailed Amenities & Policies -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Amenities & Parking</h4>
        <p><strong>Parking:</strong> ${parkingStr} ${item.parking_fee ? `(${item.parking_fee})` : ''}</p>
        <p style="margin-top: 0.25rem;"><strong>Laundry:</strong> ${item.amenities?.laundry || 'Unspecified'} ${item.amenities?.laundry_note ? `(${item.amenities.laundry_note})` : ''}</p>
        <p style="margin-top: 0.25rem;"><strong>Cooling / AC:</strong> ${item.amenities?.cooling || 'None listed'}</p>
        <p style="margin-top: 0.25rem;"><strong>Heating:</strong> ${item.amenities?.heating || 'None listed'}</p>
        <div style="margin-top: 0.5rem;">
          <strong>Appliances:</strong><br>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">${appList}</div>
        </div>
      </div>

      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
        <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Costs, Fees & Policies</h4>
        <p><strong>Application Fee:</strong> ${appFee}</p>
        <p style="margin-top: 0.25rem;"><strong>Security Deposit:</strong> ${deposit}</p>
        <p style="margin-top: 0.25rem;"><strong>Pets:</strong> ${item.pets?.allowed ? 'Yes' : 'No'} ${item.pets?.note ? `• ${item.pets.note}` : ''}</p>
        <p style="margin-top: 0.25rem;"><strong>Pet Fee/Deposit:</strong> ${item.pets?.monthly_fee || 'None'} / ${item.pets?.deposit || 'None'}</p>
        <div style="margin-top: 0.5rem;">
          <strong>Utilities Included:</strong><br>
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">${utilList}</div>
        </div>
      </div>
    </div>

    <!-- Collapsible Edit Property Details Accordion -->
    <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: 1.25rem; overflow: hidden;">
      <button id="toggle-edit-specs-btn" style="width: 100%; padding: 0.85rem 1rem; background: var(--bg-surface-1); border: none; color: var(--text-main); font-weight: 700; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <span style="display: flex; align-items: center; gap: 0.5rem;">
          <span>✏️</span>
          <span>Edit Listing Specs & Pricing (Rent, Sqft, Parking, Fees)</span>
        </span>
        <span id="edit-specs-arrow" style="font-size: 0.75rem; color: var(--text-dim);">▼ Click to expand</span>
      </button>

      <div id="edit-specs-body" class="hidden" style="padding: 1.25rem; border-top: 1px solid var(--border-subtle);">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Monthly Rent ($)</label>
            <input type="number" id="spec-edit-rent" placeholder="e.g. 2650" value="${item.rent_min || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem; font-family: var(--font-mono);">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Square Footage (sq ft)</label>
            <input type="number" id="spec-edit-sqft" placeholder="e.g. 720" value="${item.sqft || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem; font-family: var(--font-mono);">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Available Date</label>
            <input type="text" id="spec-edit-avail" placeholder="e.g. Available Now or Sep 1" value="${item.available_date || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Bedrooms</label>
            <input type="number" step="0.5" id="spec-edit-beds" value="${item.bedrooms !== undefined ? item.bedrooms : 1}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Bathrooms</label>
            <input type="number" step="0.5" id="spec-edit-baths" value="${item.bathrooms !== undefined ? item.bathrooms : 1}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Unit / Floorplan Name</label>
            <input type="text" id="spec-edit-unit" placeholder="e.g. Unit 204 or Plan A" value="${item.unit_number || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Parking Specs</label>
            <input type="text" id="spec-edit-parking" placeholder="e.g. Covered Carport, Secure Garage" value="${item.amenities?.parking || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Application Fee</label>
            <input type="text" id="spec-edit-app-fee" placeholder="e.g. $45 / applicant" value="${item.application?.fee || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;">Security Deposit</label>
            <input type="text" id="spec-edit-deposit" placeholder="e.g. $500 or 1 mo" value="${item.deposit || ''}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;">
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <button id="add-another-unit-btn" class="btn-secondary btn-sm" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);">
            <span>+ Add Another Unit/Floorplan to This Building</span>
          </button>
          <button id="save-specs-btn" class="btn-primary btn-sm" style="background: #0284c7;">
            <span>Save Specs</span>
          </button>
        </div>
      </div>
    </div>

    <!-- User Curation & Notes Form -->
    <div style="background: var(--bg-surface-2); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--primary-light);">
      <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>📝 Your Personal Curation & Visit Notes</span>
        <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 400;">(Syncs to GitHub in 1-tap)</span>
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

      <div style="margin-bottom: 0.75rem;">
        <label style="font-size: 0.75rem; color: #34d399; display: block; margin-bottom: 0.25rem;">Google Photos Tour Album / Video Link(s)</label>
        <input type="text" id="edit-media-url" placeholder="https://photos.app.goo.gl/..." value="${mediaStr}" style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.75rem; font-family: inherit; font-size: 0.8125rem;">
        <div id="media-live-preview-links" style="margin-top: 0.4rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${mediaUrls.map((u, i) => `
            <a href="${u}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #34d399; text-decoration: underline; font-weight: 700; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 3px;">
              📸 Test Album Link ${mediaUrls.length > 1 ? (i + 1) : ''} ↗
            </a>
          `).join(' ')}
        </div>
        <span style="font-size: 0.7rem; color: var(--text-dim); display: block; margin-top: 2px;">Paste one or multiple comma-separated Google Photos share links</span>
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

      <div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: ${annotation.hidden ? 'rgba(56,189,248,0.1)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${annotation.hidden ? 'rgba(56,189,248,0.3)' : 'rgba(239,68,68,0.2)'}; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.8125rem; font-weight: 600; color: ${annotation.hidden ? '#38bdf8' : '#f87171'};">
          <input type="checkbox" id="edit-hidden" ${annotation.hidden ? 'checked' : ''} style="cursor: pointer;">
          <span>🚫 Hide / Dismiss from Main Feed & Map</span>
        </label>
        <span style="font-size: 0.75rem; color: var(--text-dim);">${annotation.hidden ? 'Currently hidden' : 'Visible in main feed'}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <a href="${listingUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8125rem; color: #38bdf8; text-decoration: underline;">
            Open on Zillow ↗
          </a>
          <button id="delete-listing-btn" class="btn-secondary btn-sm" style="color: #f87171; border-color: rgba(248, 113, 113, 0.4); height: 32px; padding: 0 0.6rem;" title="Delete this listing from your dashboard">
            <span>🗑️ Delete Listing</span>
          </button>
        </div>
        <button id="save-annotation-btn" class="btn-primary" style="background: linear-gradient(135deg, #10b981, #059669);">
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

  // Delete Listing Handler
  document.getElementById('delete-listing-btn')?.addEventListener('click', () => {
    if (confirm(`Are you sure you want to remove "${item.title}" from your dashboard? You can restore it anytime.`)) {
      onDeleteListing && onDeleteListing(item.id);
      closeFn();
    }
  });

  // Toggle Edit Specs Accordion
  const toggleBtn = document.getElementById('toggle-edit-specs-btn');
  const specsBody = document.getElementById('edit-specs-body');
  const arrow = document.getElementById('edit-specs-arrow');
  toggleBtn?.addEventListener('click', () => {
    const isHidden = specsBody.classList.toggle('hidden');
    arrow.textContent = isHidden ? '▼ Click to expand' : '▲ Click to collapse';
  });

  // Save Specs Overrides Handler
  document.getElementById('save-specs-btn')?.addEventListener('click', () => {
    const rentVal = document.getElementById('spec-edit-rent')?.value;
    const sqftVal = document.getElementById('spec-edit-sqft')?.value;
    const availVal = document.getElementById('spec-edit-avail')?.value?.trim();
    const bedsVal = document.getElementById('spec-edit-beds')?.value;
    const bathsVal = document.getElementById('spec-edit-baths')?.value;
    const unitVal = document.getElementById('spec-edit-unit')?.value?.trim();
    const parkingVal = document.getElementById('spec-edit-parking')?.value?.trim();
    const appFeeVal = document.getElementById('spec-edit-app-fee')?.value?.trim();
    const depositVal = document.getElementById('spec-edit-deposit')?.value?.trim();

    const rentNum = rentVal ? parseInt(rentVal, 10) : null;
    const sqftNum = sqftVal ? parseInt(sqftVal, 10) : null;
    const bedsNum = bedsVal ? parseFloat(bedsVal) : 1;
    const bathsNum = bathsVal ? parseFloat(bathsVal) : 1;

    const overrides = {
      rent_min: rentNum,
      rent_max: rentNum,
      rent_display: rentNum ? `$${rentNum.toLocaleString()}` : item.rent_display,
      sqft: sqftNum,
      available_date: availVal || item.available_date || 'Available Now',
      bedrooms: bedsNum,
      bathrooms: bathsNum,
      unit_number: unitVal,
      parking: parkingVal,
      application_fee: appFeeVal,
      deposit: depositVal
    };

    onSaveOverrides && onSaveOverrides(item.id, overrides);
    alert('Listing specs saved! Your card and metrics will update immediately.');
    closeFn();
  });

  // Add Another Unit Handler
  document.getElementById('add-another-unit-btn')?.addEventListener('click', () => {
    const unitName = prompt('Enter Unit Number / Floorplan Name (e.g. Unit 204 or Plan B):', 'Unit 2');
    if (!unitName) return;

    const rentInput = prompt(`Enter rent for ${unitName} ($/mo):`, item.rent_min ? String(item.rent_min) : '2600');
    const sqftInput = prompt(`Enter square footage for ${unitName} (sq ft):`, item.sqft ? String(item.sqft) : '700');

    const rentNum = rentInput ? parseInt(rentInput, 10) : null;
    const sqftNum = sqftInput ? parseInt(sqftInput, 10) : null;

    onAddUnit && onAddUnit(item, {
      unit_name: unitName,
      rent_min: rentNum,
      rent_max: rentNum,
      rent_display: rentNum ? `$${rentNum.toLocaleString()}` : 'Contact for price',
      sqft: sqftNum,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      available_date: item.available_date
    });

    alert(`Added separate listing card for ${unitName}!`);
    closeFn();
  });

  // Live media preview
  const mediaInput = document.getElementById('edit-media-url');
  const previewBox = document.getElementById('media-live-preview-links');
  mediaInput?.addEventListener('input', (e) => {
    const urls = e.target.value.split(/[,\n]/).map(u => u.trim()).filter(u => u.startsWith('http'));
    if (previewBox) {
      previewBox.innerHTML = urls.map((u, i) => `
        <a href="${u}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #34d399; text-decoration: underline; font-weight: 700; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 3px;">
          📸 Test Album Link ${urls.length > 1 ? (i + 1) : ''} ↗
        </a>
      `).join(' ');
    }
  });

  // Save Annotations Handler
  document.getElementById('save-annotation-btn')?.addEventListener('click', () => {
    const rating = document.getElementById('edit-rating')?.value;
    const visit_status = document.getElementById('edit-visit-status')?.value;
    const media_album_url = document.getElementById('edit-media-url')?.value?.trim();
    const highlights = document.getElementById('edit-highlights')?.value;
    const lowlights = document.getElementById('edit-lowlights')?.value;
    const user_notes = document.getElementById('edit-notes')?.value;
    const hidden = document.getElementById('edit-hidden')?.checked || false;

    onSaveAnnotation(item.id, { rating, visit_status, media_album_url, highlights, lowlights, user_notes, hidden });
    closeFn();
  });
}
