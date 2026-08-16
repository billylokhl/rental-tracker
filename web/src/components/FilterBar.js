/**
 * Dynamic Filter and Sort Bar Component.
 */

export class FilterBar {
  constructor(container, onFilterChange) {
    this.container = container;
    this.onFilterChange = onFilterChange;
    this.state = {
      search: '',
      maxRent: 4500,
      maxCommute: 99,
      minSuperfundDist: 0,
      bedrooms: 'all',
      inUnitLaundry: false,
      hasAC: false,
      petFriendly: false,
      hasDishwasher: false,
      status: 'all',
      sortBy: 'rent_asc'
    };
    this.render();
  }

  getState() {
    return { ...this.state };
  }

  render() {
    this.container.innerHTML = `
      <div class="filter-primary-row">
        <!-- Keyword Search -->
        <div class="search-input-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="filter-search" placeholder="Search address, city, property name..." value="${this.state.search}">
        </div>

        <!-- Sort Select -->
        <select id="filter-sort" class="btn-secondary" style="height: 38px; padding: 0 0.75rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
          <option value="rent_asc" ${this.state.sortBy === 'rent_asc' ? 'selected' : ''}>Rent: Low to High</option>
          <option value="rent_desc" ${this.state.sortBy === 'rent_desc' ? 'selected' : ''}>Rent: High to Low</option>
          <option value="commute_asc" ${this.state.sortBy === 'commute_asc' ? 'selected' : ''}>Commute: Shortest</option>
          <option value="superfund_desc" ${this.state.sortBy === 'superfund_desc' ? 'selected' : ''}>Superfund: Furthest</option>
          <option value="sqft_desc" ${this.state.sortBy === 'sqft_desc' ? 'selected' : ''}>Sqft: Largest</option>
        </select>
      </div>

      <!-- Filter Quick Toggles Row -->
      <div class="filter-pills-row">
        <!-- Bed Count -->
        <button class="filter-pill-btn ${this.state.bedrooms === 'all' ? 'active' : ''}" data-bed="all">All Beds</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '0' ? 'active' : ''}" data-bed="0">Studio</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '1' ? 'active' : ''}" data-bed="1">1 Bed</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '2' ? 'active' : ''}" data-bed="2">2+ Bed</button>

        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Commute Limit -->
        <button class="filter-pill-btn ${this.state.maxCommute === 15 ? 'active' : ''}" data-commute="15">⚡ Commute &le; 15m</button>
        <button class="filter-pill-btn ${this.state.maxCommute === 25 ? 'active' : ''}" data-commute="25">🚗 Commute &le; 25m</button>

        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Amenities Toggles -->
        <button class="filter-pill-btn ${this.state.inUnitLaundry ? 'active' : ''}" id="toggle-laundry">🧺 In-Unit Laundry</button>
        <button class="filter-pill-btn ${this.state.hasAC ? 'active' : ''}" id="toggle-ac">❄️ A/C</button>
        <button class="filter-pill-btn ${this.state.petFriendly ? 'active' : ''}" id="toggle-pet">🐾 Pets OK</button>
        <button class="filter-pill-btn ${this.state.minSuperfundDist >= 1.0 ? 'active' : ''}" id="toggle-superfund">🛡️ Superfund &gt; 1.0 mi</button>
        
        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Status Filter -->
        <button class="filter-pill-btn ${this.state.status === 'shortlisted' ? 'active' : ''}" data-status="shortlisted">⭐ Shortlisted</button>
        <button class="filter-pill-btn ${this.state.status === 'visited' ? 'active' : ''}" data-status="visited">✅ Visited</button>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const searchInput = this.container.querySelector('#filter-search');
    searchInput?.addEventListener('input', (e) => {
      this.state.search = e.target.value;
      this.onFilterChange(this.getState());
    });

    const sortSelect = this.container.querySelector('#filter-sort');
    sortSelect?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.onFilterChange(this.getState());
    });

    // Bedroom buttons
    this.container.querySelectorAll('[data-bed]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.bedrooms = btn.getAttribute('data-bed');
        this.render();
        this.onFilterChange(this.getState());
      });
    });

    // Commute buttons
    this.container.querySelectorAll('[data-commute]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-commute'), 10);
        this.state.maxCommute = this.state.maxCommute === val ? 99 : val;
        this.render();
        this.onFilterChange(this.getState());
      });
    });

    // Amenity toggles
    this.container.querySelector('#toggle-laundry')?.addEventListener('click', () => {
      this.state.inUnitLaundry = !this.state.inUnitLaundry;
      this.render();
      this.onFilterChange(this.getState());
    });

    this.container.querySelector('#toggle-ac')?.addEventListener('click', () => {
      this.state.hasAC = !this.state.hasAC;
      this.render();
      this.onFilterChange(this.getState());
    });

    this.container.querySelector('#toggle-pet')?.addEventListener('click', () => {
      this.state.petFriendly = !this.state.petFriendly;
      this.render();
      this.onFilterChange(this.getState());
    });

    this.container.querySelector('#toggle-superfund')?.addEventListener('click', () => {
      this.state.minSuperfundDist = this.state.minSuperfundDist >= 1.0 ? 0 : 1.0;
      this.render();
      this.onFilterChange(this.getState());
    });

    // Status buttons
    this.container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        const st = btn.getAttribute('data-status');
        this.state.status = this.state.status === st ? 'all' : st;
        this.render();
        this.onFilterChange(this.getState());
      });
    });
  }
}
