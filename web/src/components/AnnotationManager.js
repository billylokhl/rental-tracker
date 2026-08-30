/**
 * Local-First Annotation & Property Overrides Manager.
 * Stores user ratings, visit notes, manual listing edits, custom floorplans, and deleted listings in browser localStorage,
 * overlays them onto campaign data, and syncs directly to GitHub.
 */

export class AnnotationManager {
  constructor(campaignId = '2026-south-bay') {
    this.campaignId = campaignId;
    this.storageKey = `rental_annotations_${campaignId}`;
    this.unitsKey = `rental_custom_units_${campaignId}`;
    this.deletedKey = `rental_deleted_ids_${campaignId}`;
    this.annotations = this.loadLocal();
    this.customUnits = this.loadCustomUnits();
    this.deletedIds = this.loadDeletedIds();
  }

  loadLocal() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('Could not read localStorage annotations:', e);
      return {};
    }
  }

  loadCustomUnits() {
    try {
      const raw = localStorage.getItem(this.unitsKey);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  loadDeletedIds() {
    try {
      const raw = localStorage.getItem(this.deletedKey);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  saveLocal() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.annotations));
      localStorage.setItem(this.unitsKey, JSON.stringify(this.customUnits));
      localStorage.setItem(this.deletedKey, JSON.stringify(Array.from(this.deletedIds)));
    } catch (e) {
      console.warn('Could not save annotations to localStorage:', e);
    }
  }

  mergeInitial(serverAnnotations = {}) {
    const merged = {};
    const allKeys = new Set([...Object.keys(serverAnnotations), ...Object.keys(this.annotations)]);
    
    for (const key of allKeys) {
      const serverVal = serverAnnotations[key] || {};
      const localVal = this.annotations[key] || {};
      
      merged[key] = {
        rating: localVal.rating !== undefined && localVal.rating !== '' ? localVal.rating : (serverVal.rating || ''),
        visit_status: localVal.visit_status && localVal.visit_status !== 'unvisited' ? localVal.visit_status : (serverVal.visit_status || 'unvisited'),
        highlights: localVal.highlights || serverVal.highlights || '',
        lowlights: localVal.lowlights || serverVal.lowlights || '',
        user_notes: localVal.user_notes || serverVal.user_notes || '',
        media_album_url: localVal.media_album_url || serverVal.media_album_url || '',
        custom_tags: localVal.custom_tags || serverVal.custom_tags || [],
        hidden: localVal.hidden !== undefined ? !!localVal.hidden : (serverVal.hidden !== undefined ? !!serverVal.hidden : false),
        custom_overrides: { ...(serverVal.custom_overrides || {}), ...(localVal.custom_overrides || {}) }
      };
    }
    this.annotations = merged;
    this.saveLocal();
    return this.annotations;
  }

  get(listingId) {
    return this.annotations[listingId] || {
      rating: '',
      visit_status: 'unvisited',
      highlights: '',
      lowlights: '',
      user_notes: '',
      media_album_url: '',
      custom_tags: [],
      hidden: false,
      custom_overrides: {}
    };
  }

  set(listingId, data) {
    const current = this.get(listingId);
    this.annotations[listingId] = {
      ...current,
      ...data,
      updated_at: new Date().toISOString()
    };
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { listingId, data: this.annotations[listingId] } }));
  }

  toggleHidden(listingId) {
    const current = this.get(listingId);
    const newHidden = !current.hidden;
    this.set(listingId, { hidden: newHidden });
    return newHidden;
  }

  setHidden(listingId, hidden = true) {
    this.set(listingId, { hidden: !!hidden });
  }

  getHiddenCount() {
    return Object.values(this.annotations).filter(a => !!a.hidden).length;
  }

  restoreAllHidden() {
    let restoredCount = 0;
    for (const [id, ann] of Object.entries(this.annotations)) {
      if (ann.hidden) {
        this.annotations[id] = {
          ...ann,
          hidden: false,
          updated_at: new Date().toISOString()
        };
        restoredCount++;
      }
    }
    if (restoredCount > 0) {
      this.saveLocal();
      window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { action: 'restore-all-hidden', count: restoredCount } }));
    }
    return restoredCount;
  }

  setOverrides(listingId, overrides) {
    const current = this.get(listingId);
    // A null value is an explicit deletion: it removes the stored override so the
    // listing's base (scraped) value shows again and refresh protection lifts.
    const updatedOverrides = { ...(current.custom_overrides || {}) };
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) {
        delete updatedOverrides[key];
      } else {
        updatedOverrides[key] = value;
      }
    }
    this.annotations[listingId] = {
      ...current,
      custom_overrides: updatedOverrides,
      updated_at: new Date().toISOString()
    };
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { listingId, overrides: updatedOverrides } }));
  }

  deleteListing(listingId) {
    this.deletedIds.add(listingId);
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { deletedId: listingId } }));
  }

  restoreListing(listingId) {
    this.deletedIds.delete(listingId);
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { restoredId: listingId } }));
  }

  isDeleted(listingId) {
    return this.deletedIds.has(listingId);
  }

  addCustomUnit(parentListing, unitSpecs) {
    const unitId = `${parentListing.id}_unit_${Date.now().toString().slice(-4)}`;
    const newUnit = {
      ...parentListing,
      id: unitId,
      parent_id: parentListing.id,
      title: `${parentListing.property_name || parentListing.street_address} (${unitSpecs.unit_name || 'Unit'})`,
      unit_number: unitSpecs.unit_name || '',
      rent_min: unitSpecs.rent_min || parentListing.rent_min,
      rent_max: unitSpecs.rent_max || parentListing.rent_max,
      rent_display: unitSpecs.rent_display || (unitSpecs.rent_min ? `$${unitSpecs.rent_min.toLocaleString()}` : parentListing.rent_display),
      bedrooms: unitSpecs.bedrooms !== undefined ? unitSpecs.bedrooms : parentListing.bedrooms,
      bathrooms: unitSpecs.bathrooms !== undefined ? unitSpecs.bathrooms : parentListing.bathrooms,
      sqft: unitSpecs.sqft || parentListing.sqft,
      available_date: unitSpecs.available_date || parentListing.available_date || 'Available Now',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.customUnits.push(newUnit);
    this.saveLocal();
    window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { newUnit } }));
    return newUnit;
  }

  applyOverridesAndUnits(rawListings = [], includeDeleted = false) {
    const listMap = new Map();

    // 1. Process base listings with overrides
    for (const item of rawListings) {
      if (!includeDeleted && this.deletedIds.has(item.id)) {
        continue;
      }
      const copy = { ...item };
      const ann = this.get(item.id);
      const ov = ann.custom_overrides || {};

      if (ov.title !== undefined) copy.title = ov.title;
      if (ov.property_name !== undefined) copy.property_name = ov.property_name;
      if (ov.rent_min !== undefined) copy.rent_min = ov.rent_min;
      if (ov.rent_max !== undefined) copy.rent_max = ov.rent_max;
      if (ov.rent_display !== undefined) copy.rent_display = ov.rent_display;
      if (ov.bedrooms !== undefined) copy.bedrooms = ov.bedrooms;
      if (ov.bathrooms !== undefined) copy.bathrooms = ov.bathrooms;
      if (ov.sqft !== undefined) copy.sqft = ov.sqft;
      if (ov.available_date !== undefined) copy.available_date = ov.available_date;
      if (ov.deposit !== undefined) copy.deposit = ov.deposit;
      if (ov.application_fee !== undefined) {
        copy.application = { ...(copy.application || {}), fee: ov.application_fee };
      }
      if (ov.parking !== undefined) {
        copy.amenities = { ...(copy.amenities || {}), parking: ov.parking };
      }
      if (ov.parking_fee !== undefined) copy.parking_fee = ov.parking_fee;

      listMap.set(copy.id, copy);
    }

    // 2. Append any custom added multi-units
    for (const customUnit of this.customUnits) {
      if (!includeDeleted && this.deletedIds.has(customUnit.id)) {
        continue;
      }
      listMap.set(customUnit.id, customUnit);
    }

    return Array.from(listMap.values());
  }

  exportJson() {
    const payload = {
      annotations: this.annotations,
      custom_units: this.customUnits,
      deleted_ids: Array.from(this.deletedIds)
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `annotations_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importJson(jsonData) {
    try {
      const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (parsed.annotations) {
        this.annotations = { ...this.annotations, ...parsed.annotations };
      } else {
        this.annotations = { ...this.annotations, ...parsed };
      }
      if (parsed.custom_units && Array.isArray(parsed.custom_units)) {
        this.customUnits = [...this.customUnits, ...parsed.custom_units];
      }
      if (parsed.deleted_ids && Array.isArray(parsed.deleted_ids)) {
        this.deletedIds = new Set([...this.deletedIds, ...parsed.deleted_ids]);
      }
      this.saveLocal();
      window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { all: true } }));
      return true;
    } catch (e) {
      alert('Invalid annotations JSON format: ' + e.message);
      return false;
    }
  }
}
