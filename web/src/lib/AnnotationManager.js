/**
 * Local-first annotation state manager.
 * Merges server-side annotations with localStorage, manages overrides,
 * custom units, and deleted IDs. Framework-agnostic.
 *
 * Callers must provide an onChange callback (replaces the old CustomEvent pattern).
 */

export class AnnotationManager {
  constructor(campaignId, onChange = () => {}) {
    this.campaignId = campaignId;
    this.subscribers = new Set();
    if (onChange) this.subscribers.add(onChange);
    this.annotations = {};
    this.customUnits = [];
    this.deletedIds = new Set();

    this._loadLocal();
  }

  // --- Subscription Model ---
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    for (const callback of this.subscribers) {
      callback();
    }
  }

  // --- localStorage persistence ---

  _storageKey(suffix) {
    return `rental_${suffix}_${this.campaignId}`;
  }

  _loadLocal() {
    try {
      const raw = localStorage.getItem(this._storageKey('annotations'));
      if (raw) this.annotations = JSON.parse(raw);
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(this._storageKey('custom_units'));
      if (raw) this.customUnits = JSON.parse(raw);
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(this._storageKey('deleted_ids'));
      if (raw) this.deletedIds = new Set(JSON.parse(raw));
    } catch { /* ignore */ }
  }

  _saveLocal() {
    try {
      localStorage.setItem(this._storageKey('annotations'), JSON.stringify(this.annotations));
      localStorage.setItem(this._storageKey('custom_units'), JSON.stringify(this.customUnits));
      localStorage.setItem(this._storageKey('deleted_ids'), JSON.stringify([...this.deletedIds]));
    } catch { /* storage full or blocked */ }
  }

  // --- Public API ---

  /** Merge server-side annotations into the local store (server wins on conflict). */
  mergeInitial(serverAnnotations) {
    if (!serverAnnotations || typeof serverAnnotations !== 'object') return;

    for (const [id, serverAnn] of Object.entries(serverAnnotations)) {
      const local = this.annotations[id] || {};
      // Server values fill in missing local fields; local user edits are preserved
      this.annotations[id] = { ...serverAnn, ...local };
    }
    this._saveLocal();
  }

  /** Get annotation for a listing (returns empty object if none). */
  get(listingId) {
    return this.annotations[listingId] || {};
  }

  /** Set annotation fields for a listing. */
  set(listingId, data) {
    this.annotations[listingId] = { ...(this.annotations[listingId] || {}), ...data };
    this._saveLocal();
    this.notify();
  }

  /** Set custom_overrides for a listing's spec fields. */
  setOverrides(listingId, overrides) {
    const ann = this.annotations[listingId] || {};
    ann.custom_overrides = { ...(ann.custom_overrides || {}), ...overrides };
    this.annotations[listingId] = ann;
    this._saveLocal();
    this.notify();
  }

  /** Toggle the hidden flag on a listing. Returns the new hidden state. */
  toggleHidden(listingId) {
    const ann = this.annotations[listingId] || {};
    const newHidden = !ann.hidden;
    ann.hidden = newHidden;
    this.annotations[listingId] = ann;
    this._saveLocal();
    this.notify();
    return newHidden;
  }

  /** Get count of hidden listings. */
  getHiddenCount() {
    return Object.values(this.annotations).filter(a => a.hidden).length;
  }

  /** Restore all hidden listings. Returns count restored. */
  restoreAllHidden() {
    let count = 0;
    for (const ann of Object.values(this.annotations)) {
      if (ann.hidden) { ann.hidden = false; count++; }
    }
    this._saveLocal();
    this.notify();
    return count;
  }

  /** Add a custom unit variant for a parent listing. */
  addCustomUnit(parentItem, unitSpecs) {
    const unitId = `${parentItem.id}_custom_${Date.now()}`;
    const unit = {
      ...parentItem,
      id: unitId,
      parent_listing_id: parentItem.id,
      unit_number: unitSpecs.unit || '',
      rent_min: unitSpecs.rent || parentItem.rent_min,
      rent_max: unitSpecs.rent || parentItem.rent_max,
      rent_display: unitSpecs.rent ? `$${Number(unitSpecs.rent).toLocaleString()}` : parentItem.rent_display,
      bedrooms: unitSpecs.beds != null ? unitSpecs.beds : parentItem.bedrooms,
      is_custom_unit: true,
    };
    this.customUnits.push(unit);
    this._saveLocal();
    this.notify();
    return unit;
  }

  /** Soft-delete a listing by marking its ID as deleted. */
  deleteListing(listingId) {
    this.deletedIds.add(listingId);
    this._saveLocal();
    this.notify();
  }

  /** Restore a soft-deleted listing. */
  restoreListing(listingId) {
    this.deletedIds.delete(listingId);
    this._saveLocal();
    this.notify();
  }

  /**
   * Apply annotation overrides and custom units to the raw listings array.
   * Returns a new array with overrides applied and custom units appended.
   */
  applyOverridesAndUnits(rawListings) {
    const result = [];

    for (const item of rawListings) {
      if (this.deletedIds.has(item.id)) continue;

      const ann = this.annotations[item.id];
      if (ann?.custom_overrides) {
        const merged = { ...item };
        const ov = ann.custom_overrides;
        if (ov.title) merged.title = ov.title;
        if (ov.property_name) merged.property_name = ov.property_name;
        if (ov.rent != null) {
          merged.rent_min = Number(ov.rent);
          merged.rent_max = Number(ov.rent);
          merged.rent_display = `$${Number(ov.rent).toLocaleString()}`;
        }
        if (ov.beds != null) merged.bedrooms = Number(ov.beds);
        if (ov.baths != null) merged.bathrooms = Number(ov.baths);
        if (ov.sqft != null) merged.sqft = Number(ov.sqft);
        if (ov.available_date) merged.available_date = ov.available_date;
        if (ov.deposit != null) merged.deposit = ov.deposit;
        if (ov.application_fee != null) merged.application_fee = ov.application_fee;
        if (ov.parking != null) merged.parking = ov.parking;
        if (ov.parking_fee != null) merged.parking_fee = ov.parking_fee;
        result.push(merged);
      } else {
        result.push(item);
      }
    }

    // Append custom units that aren't deleted
    for (const unit of this.customUnits) {
      if (!this.deletedIds.has(unit.id)) {
        result.push(unit);
      }
    }

    return result;
  }

  /** Export all local state as a JSON object suitable for server import. */
  exportJson() {
    const blob = new Blob([JSON.stringify({
      annotations: this.annotations,
      custom_units: this.customUnits,
      deleted_ids: [...this.deletedIds],
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${this.campaignId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import annotations from a JSON object (exported format). */
  importJson(imported) {
    if (!imported || typeof imported !== 'object') return;

    let annotations = imported;
    if (imported.annotations && typeof imported.annotations === 'object') {
      annotations = imported.annotations;
      if (Array.isArray(imported.custom_units)) {
        for (const unit of imported.custom_units) {
          if (!this.customUnits.find(u => u.id === unit.id)) {
            this.customUnits.push(unit);
          }
        }
      }
      if (Array.isArray(imported.deleted_ids)) {
        for (const id of imported.deleted_ids) {
          this.deletedIds.add(id);
        }
      }
    }

    for (const [id, ann] of Object.entries(annotations)) {
      this.annotations[id] = { ...(this.annotations[id] || {}), ...ann };
    }

    this._saveLocal();
    this.notify();
  }
}
