/**
 * Local-First Annotation Manager.
 * Stores user ratings, visit statuses, and personal notes in browser localStorage,
 * overlays them onto campaign data, and provides one-click JSON export/import.
 */

export class AnnotationManager {
  constructor(campaignId = '2026-south-bay') {
    this.storageKey = `rental_annotations_${campaignId}`;
    this.annotations = this.loadLocal();
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

  saveLocal() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.annotations));
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
        custom_tags: localVal.custom_tags || serverVal.custom_tags || []
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
      custom_tags: []
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

  exportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.annotations, null, 2));
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
      this.annotations = { ...this.annotations, ...parsed };
      this.saveLocal();
      window.dispatchEvent(new CustomEvent('annotations-updated', { detail: { all: true } }));
      return true;
    } catch (e) {
      alert('Invalid annotations JSON format: ' + e.message);
      return false;
    }
  }
}
