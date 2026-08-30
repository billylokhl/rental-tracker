/**
 * DetailModal — full listing detail view with inline spec editing,
 * curation/annotation form, photo gallery, and unit management.
 * Ported from the vanilla innerHTML-based DetailModal.js to Preact JSX.
 */

import { Fragment } from 'preact';
import { useState, useCallback, useContext } from 'preact/hooks';
import { AppContext } from '../context.js';
import {
  getListingUrl,
  parseMediaUrls,
  isSafeGrade,
  getCommute,
  getCommuteMins,
  formatUnitBadge,
} from '../lib/utils.js';

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function DetailModal({ item, onClose }) {
  const { annotationManager, primaryDestId } = useContext(AppContext);

  // Seed all form state from the annotation manager's current record for this
  // listing, once, on mount.
  const annotation = annotationManager.get(item.id);

  const [rating, setRating] = useState(annotation.rating || '');
  const [visitStatus, setVisitStatus] = useState(annotation.visit_status || 'unvisited');
  const [highlights, setHighlights] = useState(annotation.highlights || '');
  const [lowlights, setLowlights] = useState(annotation.lowlights || '');
  const [userNotes, setUserNotes] = useState(annotation.user_notes || '');
  const [mediaAlbumUrl, setMediaAlbumUrl] = useState(
    annotation.media_album_url || item.media_album_url || ''
  );
  const [hidden, setHidden] = useState(!!annotation.hidden);

  // Edit-specs accordion
  const [specsOpen, setSpecsOpen] = useState(false);
  const [rentEdit, setRentEdit] = useState(item.rent_min ?? '');
  const [sqftEdit, setSqftEdit] = useState(item.sqft ?? '');
  const [availEdit, setAvailEdit] = useState(item.available_date ?? '');
  const [bedsEdit, setBedsEdit] = useState(item.bedrooms !== undefined ? item.bedrooms : 1);
  const [bathsEdit, setBathsEdit] = useState(item.bathrooms !== undefined ? item.bathrooms : 1);
  const [unitEdit, setUnitEdit] = useState(item.unit_number ?? '');
  const [parkingEdit, setParkingEdit] = useState(item.amenities?.parking ?? '');
  const [appFeeEdit, setAppFeeEdit] = useState(item.application?.fee ?? '');
  const [depositEdit, setDepositEdit] = useState(item.deposit ?? '');

  const handleClose = useCallback(() => {
    onClose && onClose();
  }, [onClose]);

  const stopPropagation = useCallback((e) => {
    e.stopPropagation();
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm(`Are you sure you want to remove "${item.title}" from your dashboard? You can restore it anytime.`)) {
      annotationManager.deleteListing(item.id);
      handleClose();
    }
  }, [item, annotationManager, handleClose]);

  const handleSaveSpecs = useCallback(() => {
    // Inputs are prefilled from the (already override-merged) item, so:
    //  - unchanged value -> write nothing (an untouched prefill must NOT become an
    //    override, or refresh protection locks the field out of upstream sync);
    //  - changed value   -> write the override;
    //  - blanked value   -> write null, which setOverrides treats as an explicit
    //    deletion of any stored override (reverting to the scraped base value).
    const overrides = {};
    const setOrClear = (key, rawVal, parsedVal, currentVal) => {
      if (rawVal === '' || rawVal === undefined || Number.isNaN(parsedVal)) {
        overrides[key] = null;
      } else if (parsedVal !== currentVal) {
        overrides[key] = parsedVal;
      }
    };

    if (rentEdit === '' || rentEdit === undefined) {
      overrides.rent_min = null;
      overrides.rent_max = null;
      overrides.rent_display = null;
    } else {
      const rentNum = parseInt(rentEdit, 10);
      if (!Number.isNaN(rentNum) && rentNum !== item.rent_min) {
        overrides.rent_min = rentNum;
        overrides.rent_max = rentNum;
        overrides.rent_display = `$${rentNum.toLocaleString()}`;
      }
    }
    setOrClear('sqft', sqftEdit, sqftEdit !== '' ? parseInt(sqftEdit, 10) : NaN, item.sqft);
    setOrClear('available_date', String(availEdit).trim(), String(availEdit).trim(), item.available_date || '');
    setOrClear('bedrooms', bedsEdit, bedsEdit !== '' ? parseFloat(bedsEdit) : NaN, item.bedrooms);
    setOrClear('bathrooms', bathsEdit, bathsEdit !== '' ? parseFloat(bathsEdit) : NaN, item.bathrooms);
    setOrClear('unit_number', String(unitEdit).trim(), String(unitEdit).trim(), item.unit_number || '');
    setOrClear('parking', String(parkingEdit).trim(), String(parkingEdit).trim(), item.amenities?.parking || '');
    setOrClear('application_fee', String(appFeeEdit).trim(), String(appFeeEdit).trim(), item.application?.fee || '');
    setOrClear('deposit', String(depositEdit).trim(), String(depositEdit).trim(), item.deposit || '');

    annotationManager.setOverrides(item.id, overrides);
    alert('Listing specs saved! Your card and metrics will update immediately.');
    handleClose();
  }, [
    item, annotationManager, handleClose,
    rentEdit, sqftEdit, availEdit, bedsEdit, bathsEdit, unitEdit, parkingEdit, appFeeEdit, depositEdit,
  ]);

  const handleAddUnit = useCallback(() => {
    const unitName = prompt('Enter Unit Number / Floorplan Name (e.g. Unit 204 or Plan B):', 'Unit 2');
    if (!unitName) return;

    const rentInput = prompt(`Enter rent for ${unitName} ($/mo):`, item.rent_min ? String(item.rent_min) : '2600');
    const rentNum = rentInput ? parseInt(rentInput, 10) : null;

    annotationManager.addCustomUnit(item, {
      unit: unitName,
      rent: rentNum,
      beds: item.bedrooms,
    });

    alert(`Added separate listing card for ${unitName}!`);
    handleClose();
  }, [item, annotationManager, handleClose]);

  const handleSaveAnnotation = useCallback(() => {
    annotationManager.set(item.id, {
      rating,
      visit_status: visitStatus,
      media_album_url: mediaAlbumUrl.trim(),
      highlights,
      lowlights,
      user_notes: userNotes,
      hidden,
    });
    handleClose();
  }, [item, annotationManager, rating, visitStatus, mediaAlbumUrl, highlights, lowlights, userNotes, hidden, handleClose]);

  const sfDist = item.hazard_proximity?.superfund_mi ?? 'N/A';
  const commuteMins = getCommuteMins(item, primaryDestId);
  const commuteDisplay = commuteMins !== null ? getCommute(item, primaryDestId) : 'N/A';
  const listingUrl = getListingUrl(item);

  const mediaUrls = parseMediaUrls(mediaAlbumUrl);
  const photos = item.photos || [];

  const availDate = item.available_date || 'Available Now';
  const parkingStr = item.amenities?.parking || 'Unspecified';
  const appFee = item.application?.fee || 'None listed';
  const deposit = item.deposit || item.pets?.deposit || '1 Month or Contact';

  const applianceEntries = Object.entries(item.amenities?.appliances || {}).filter(([, v]) => v);
  const utilityEntries = Object.entries(item.amenities?.utilities_included || {}).filter(([, v]) => v);

  return (
    <Fragment>
      <div className="modal-backdrop" onClick={handleClose} />
      <div className="modal-container" onClick={stopPropagation}>
        <div className="modal-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">{item.title}</h2>
              {item.unit_number && (
                <span style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.4); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                  {formatUnitBadge(item)}
                </span>
              )}
              <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm" style="background: #0284c7; text-decoration: none; padding: 0.2rem 0.6rem;" title="Open listing on Zillow">
                <span>Zillow ↗</span>
              </a>
            </div>
            <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 2px;">
              {item.street_address ? `${item.street_address}, ` : ''}{item.city}{item.state ? `, ${item.state}` : ''} {item.zip}
            </p>
          </div>
          <button type="button" className="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;" onClick={handleClose}>&times;</button>
        </div>

        {/* Core Specs Grid */}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Monthly Rent</div>
            <div style="font-size: 1.25rem; font-weight: 800; font-family: var(--font-mono); color: #38bdf8;">{item.rent_display}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{item.rent_min && item.sqft ? `$${(item.rent_min / item.sqft).toFixed(2)}/sqft` : ''}</div>
          </div>
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Layout / Size</div>
            <div style="font-weight: 700; font-size: 1rem;">{item.bedrooms} Bed / {item.bathrooms} Bath</div>
            <div style="font-size: 0.75rem; color: #34d399; font-weight: 600;">{item.sqft ? `📐 ${item.sqft} sq ft` : 'Sqft not listed'}</div>
          </div>
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Availability</div>
            <div style="font-weight: 700; font-size: 1rem; color: #fbbf24;">📅 {availDate}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{item.lease_length || '12 months'}</div>
          </div>
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Parking</div>
            <div style="font-weight: 700; font-size: 0.875rem; color: #a78bfa;">🚗 {parkingStr}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">{item.parking_fee ? `Fee: ${item.parking_fee}` : 'Check policy'}</div>
          </div>
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Work Commute</div>
            <div style="font-weight: 700; font-size: 1rem; color: #34d399;">⚡ {commuteDisplay}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">9:00 AM Arrival</div>
          </div>
          <div style="background: var(--bg-surface-2); padding: 0.75rem; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-dim);">Superfund Site</div>
            <div style="font-weight: 700; font-size: 1rem; color: #f87171;">🛡️ {sfDist} mi</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Nearest EPA Site</div>
          </div>
        </div>

        {/* Neighborhood Safety & Crime Profile */}
        {item.crime_safety && (
          <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; font-size: 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
                🛡️ Neighborhood Safety & Crime Profile
                <span className={`badge ${isSafeGrade(item.crime_safety.overall_safety_grade) ? 'badge-safe' : 'badge-warn'}`}>{item.crime_safety.overall_safety_grade}</span>
              </h4>
              {item.location && (
                <a href={`https://www.crimemapping.com/map/ca/sanjose?lat=${item.location.lat}&lng=${item.location.lng}&zoom=15`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm" style="text-decoration: none;">🔍 View Live 0.5-mi Blotter</a>
              )}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.5rem;">
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">🚗 Property & Vehicle</div>
                <div style="font-weight: 600; font-size: 0.9rem;">{item.crime_safety.property_grade} <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">({item.crime_safety.property_crime_rate}/1k)</span></div>
              </div>
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">🚶 Violent & Personal</div>
                <div style="font-weight: 600; font-size: 0.9rem;">{item.crime_safety.violent_grade} <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: normal;">({item.crime_safety.violent_crime_rate}/1k)</span></div>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dim); font-style: italic;">"{item.crime_safety.highlights}"</div>
          </div>
        )}

        {/* Tour Photos & Walkthrough Videos */}
        {(photos.length > 0 || mediaUrls.length > 0) && (
          <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.35rem;">📸</span>
                <div>
                  <h3 style="color: #34d399; font-size: 1rem; font-weight: 800; margin: 0;">Tour Photos & Walkthrough Videos</h3>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">{photos.length} photo(s) captured • {mediaUrls.length} album link(s)</span>
                </div>
              </div>
            </div>

            {photos.length > 0 && (
              <div style="margin-bottom: 1.25rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem;">
                  {photos.map((imgUrl, idx) => (
                    <a key={imgUrl + idx} href={imgUrl} target="_blank" rel="noopener noreferrer" style="display: block; position: relative; height: 180px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-subtle); background: var(--bg-surface-2);" title="Click to view full resolution photo">
                      <img
                        src={imgUrl}
                        alt={`Tour photo ${idx + 1}`}
                        style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s ease;"
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                      />
                      <div style="position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px;">
                        🔍 Full Size
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              {mediaUrls.map((url, i) => (
                <a key={url + i} href={url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.85rem; border-radius: var(--radius-sm); box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
                  <span>🎬 Watch Walkthrough Videos & Photos in Google Photos {mediaUrls.length > 1 ? `(Album ${i + 1})` : ''} ↗</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Amenities & Policies */}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
            <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Amenities & Parking</h4>
            <p><strong>Parking:</strong> {parkingStr} {item.parking_fee ? `(${item.parking_fee})` : ''}</p>
            <p style="margin-top: 0.25rem;"><strong>Laundry:</strong> {item.amenities?.laundry || 'Unspecified'} {item.amenities?.laundry_note ? `(${item.amenities.laundry_note})` : ''}</p>
            <p style="margin-top: 0.25rem;"><strong>Cooling / AC:</strong> {item.amenities?.cooling || 'None listed'}</p>
            <p style="margin-top: 0.25rem;"><strong>Heating:</strong> {item.amenities?.heating || 'None listed'}</p>
            <div style="margin-top: 0.5rem;">
              <strong>Appliances:</strong><br />
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">
                {applianceEntries.length > 0
                  ? applianceEntries.map(([k]) => <span key={k} className="badge badge-spec">✓ {titleCase(k)}</span>)
                  : <span style="color: var(--text-dim);">None specified</span>}
              </div>
            </div>
          </div>

          <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
            <h4 style="font-size: 0.875rem; margin-bottom: 0.5rem; color: #38bdf8;">Costs, Fees & Policies</h4>
            <p><strong>Application Fee:</strong> {appFee}</p>
            <p style="margin-top: 0.25rem;"><strong>Security Deposit:</strong> {deposit}</p>
            <p style="margin-top: 0.25rem;"><strong>Pets:</strong> {item.pets?.allowed ? 'Yes' : 'No'} {item.pets?.note ? `• ${item.pets.note}` : ''}</p>
            <p style="margin-top: 0.25rem;"><strong>Pet Fee/Deposit:</strong> {item.pets?.monthly_fee || 'None'} / {item.pets?.deposit || 'None'}</p>
            <div style="margin-top: 0.5rem;">
              <strong>Utilities Included:</strong><br />
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.25rem;">
                {utilityEntries.length > 0
                  ? utilityEntries.map(([k]) => <span key={k} className="badge badge-spec" style="color: #34d399;">✓ {titleCase(k)}</span>)
                  : <span style="color: var(--text-dim);">Tenant pays all utilities</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Edit Property Details Accordion */}
        <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: 1.25rem; overflow: hidden;">
          <button
            type="button"
            style="width: 100%; padding: 0.85rem 1rem; background: var(--bg-surface-1); border: none; color: var(--text-main); font-weight: 700; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer;"
            onClick={() => setSpecsOpen((v) => !v)}
          >
            <span style="display: flex; align-items: center; gap: 0.5rem;">
              <span>✏️</span>
              <span>Edit Listing Specs & Pricing (Rent, Sqft, Parking, Fees)</span>
            </span>
            <span style="font-size: 0.75rem; color: var(--text-dim);">{specsOpen ? '▲ Click to collapse' : '▼ Click to expand'}</span>
          </button>

          {specsOpen && (
            <div style="padding: 1.25rem; border-top: 1px solid var(--border-subtle);">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-rent">Monthly Rent ($)</label>
                  <input type="number" id="spec-edit-rent" placeholder="e.g. 2650" value={rentEdit} onInput={(e) => setRentEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem; font-family: var(--font-mono);" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-sqft">Square Footage (sq ft)</label>
                  <input type="number" id="spec-edit-sqft" placeholder="e.g. 720" value={sqftEdit} onInput={(e) => setSqftEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem; font-family: var(--font-mono);" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-avail">Available Date</label>
                  <input type="text" id="spec-edit-avail" placeholder="e.g. Available Now or Sep 1" value={availEdit} onInput={(e) => setAvailEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-beds">Bedrooms</label>
                  <input type="number" step="0.5" id="spec-edit-beds" value={bedsEdit} onInput={(e) => setBedsEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-baths">Bathrooms</label>
                  <input type="number" step="0.5" id="spec-edit-baths" value={bathsEdit} onInput={(e) => setBathsEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-unit">Unit / Floorplan Name</label>
                  <input type="text" id="spec-edit-unit" placeholder="e.g. Unit 204 or Plan A" value={unitEdit} onInput={(e) => setUnitEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-parking">Parking Specs</label>
                  <input type="text" id="spec-edit-parking" placeholder="e.g. Covered Carport, Secure Garage" value={parkingEdit} onInput={(e) => setParkingEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-app-fee">Application Fee</label>
                  <input type="text" id="spec-edit-app-fee" placeholder="e.g. $45 / applicant" value={appFeeEdit} onInput={(e) => setAppFeeEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.25rem;" htmlFor="spec-edit-deposit">Security Deposit</label>
                  <input type="text" id="spec-edit-deposit" placeholder="e.g. $500 or 1 mo" value={depositEdit} onInput={(e) => setDepositEdit(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.5rem;" />
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <button type="button" className="btn-secondary btn-sm" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);" onClick={handleAddUnit}>
                  <span>+ Add Another Unit/Floorplan to This Building</span>
                </button>
                <button type="button" className="btn-primary btn-sm" style="background: #0284c7;" onClick={handleSaveSpecs}>
                  <span>Save Specs</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Curation & Notes Form */}
        <div style="background: var(--bg-surface-2); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--primary-light);">
          <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>📝 Your Personal Curation & Visit Notes</span>
            <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 400;">(Syncs to GitHub in 1-tap)</span>
          </h3>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;" htmlFor="edit-rating">Rating / Priority</label>
              <select id="edit-rating" className="btn-secondary" style="width: 100%; height: 36px; border-radius: var(--radius-sm);" value={rating} onInput={(e) => setRating(e.currentTarget.value)}>
                <option value="">Unrated</option>
                <option value="Top">⭐ Top Choice</option>
                <option value="1">1 (Strong contender)</option>
                <option value="2">2 (Backup)</option>
                <option value="3">3 (Low priority)</option>
                <option value="Pass">✕ Pass</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;" htmlFor="edit-visit-status">Visit Status</label>
              <select id="edit-visit-status" className="btn-secondary" style="width: 100%; height: 36px; border-radius: var(--radius-sm);" value={visitStatus} onInput={(e) => setVisitStatus(e.currentTarget.value)}>
                <option value="unvisited">Unvisited</option>
                <option value="interested">Interested</option>
                <option value="scheduled">Tour Scheduled</option>
                <option value="visited">✅ Visited</option>
                <option value="applied">Applied</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 0.75rem;">
            <label style="font-size: 0.75rem; color: #34d399; display: block; margin-bottom: 0.25rem;" htmlFor="edit-media-url">Google Photos Tour Album / Video Link(s)</label>
            <input type="text" id="edit-media-url" placeholder="https://photos.app.goo.gl/..." value={mediaAlbumUrl} onInput={(e) => setMediaAlbumUrl(e.currentTarget.value)} style="width: 100%; height: 36px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.75rem; font-family: inherit; font-size: 0.8125rem;" />
            <div style="margin-top: 0.4rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              {mediaUrls.map((u, i) => (
                <a key={u + i} href={u} target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #34d399; text-decoration: underline; font-weight: 700; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 3px;">
                  📸 Test Album Link {mediaUrls.length > 1 ? i + 1 : ''} ↗
                </a>
              ))}
            </div>
            <span style="font-size: 0.7rem; color: var(--text-dim); display: block; margin-top: 2px;">Paste one or multiple comma-separated Google Photos share links</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <label style="font-size: 0.75rem; color: #34d399; display: block; margin-bottom: 0.25rem;" htmlFor="edit-highlights">Highlights / Pros</label>
              <textarea id="edit-highlights" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;" value={highlights} onInput={(e) => setHighlights(e.currentTarget.value)} />
            </div>
            <div>
              <label style="font-size: 0.75rem; color: #f87171; display: block; margin-bottom: 0.25rem;" htmlFor="edit-lowlights">Lowlights / Cons</label>
              <textarea id="edit-lowlights" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;" value={lowlights} onInput={(e) => setLowlights(e.currentTarget.value)} />
            </div>
          </div>

          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;" htmlFor="edit-notes">Personal Notes</label>
            <textarea id="edit-notes" rows="2" style="width: 100%; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0.5rem; font-family: inherit; font-size: 0.8125rem;" value={userNotes} onInput={(e) => setUserNotes(e.currentTarget.value)} />
          </div>

          <div style={`margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: ${hidden ? 'rgba(56,189,248,0.1)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${hidden ? 'rgba(56,189,248,0.3)' : 'rgba(239,68,68,0.2)'}; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between;`}>
            <label style={`display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.8125rem; font-weight: 600; color: ${hidden ? '#38bdf8' : '#f87171'};`} htmlFor="edit-hidden">
              <input type="checkbox" id="edit-hidden" checked={hidden} onChange={(e) => setHidden(e.currentTarget.checked)} style="cursor: pointer;" />
              <span>🚫 Hide / Dismiss from Main Feed & Map</span>
            </label>
            <span style="font-size: 0.75rem; color: var(--text-dim);">{hidden ? 'Currently hidden' : 'Visible in main feed'}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <a href={listingUrl} target="_blank" rel="noopener noreferrer" style="font-size: 0.8125rem; color: #38bdf8; text-decoration: underline;">
                Open on Zillow ↗
              </a>
              <button type="button" className="btn-secondary btn-sm" style="color: #f87171; border-color: rgba(248, 113, 113, 0.4); height: 32px; padding: 0 0.6rem;" title="Delete this listing from your dashboard" onClick={handleDelete}>
                <span>🗑️ Delete Listing</span>
              </button>
            </div>
            <button type="button" className="btn-primary" style="background: linear-gradient(135deg, #10b981, #059669);" onClick={handleSaveAnnotation}>
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
