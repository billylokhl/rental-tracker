/**
 * Dynamic Filter and Sort Bar Component with Customizable Filter Values.
 */

export class FilterBar {
  constructor(container, onFilterChange) {
    this.container = container;
    this.onFilterChange = onFilterChange;
    this.state = {
      search: '',
      maxRent: 99999,
      maxCommute: 99,
      minSuperfundDist: 0,
      bedrooms: 'all',
      inUnitLaundry: false,
      hasAC: false,
      petFriendly: false,
      hasMedia: false,
      status: 'all',
      sortBy: 'rent_asc'
    };
    this.render();
  }

  getState() {
    return { ...this.state };
  }

  isFiltered() {
    return (
      this.state.search !== '' ||
      this.state.maxRent < 99999 ||
      this.state.maxCommute < 99 ||
      this.state.minSuperfundDist > 0 ||
      this.state.bedrooms !== 'all' ||
      this.state.inUnitLaundry ||
      this.state.hasAC ||
      this.state.petFriendly ||
      this.state.hasMedia ||
      this.state.status !== 'all'
    );
  }

  resetFilters() {
    this.state = {
      ...this.state,
      search: '',
      maxRent: 99999,
      maxCommute: 99,
      minSuperfundDist: 0,
      bedrooms: 'all',
      inUnitLaundry: false,
      hasAC: false,
      petFriendly: false,
      hasMedia: false,
      status: 'all'
    };
    this.render();
    this.onFilterChange(this.getState());
  }

  render() {
    const isCommuteActive = this.state.maxCommute < 99;
    const isRentActive = this.state.maxRent < 99999;
    const isSuperfundActive = this.state.minSuperfundDist > 0;
    const hasActiveFilters = this.isFiltered();

    this.container.innerHTML = `
      <div class="filter-primary-row">
        <!-- Keyword Search -->
        <div class="search-input-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="filter-search" placeholder="Search address, city, property name..." value="${this.state.search.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}">
        </div>

        <!-- Sort Select -->
        <select id="filter-sort" class="btn-secondary" style="height: 38px; padding: 0 0.75rem; border-radius: var(--radius-md); font-size: 0.8125rem;">
          <option value="rent_asc" ${this.state.sortBy === 'rent_asc' ? 'selected' : ''}>Rent: Low to High</option>
          <option value="newest" ${this.state.sortBy === 'newest' ? 'selected' : ''}>✨ Newly Added First</option>
          <option value="rent_desc" ${this.state.sortBy === 'rent_desc' ? 'selected' : ''}>Rent: High to Low</option>
          <option value="commute_asc" ${this.state.sortBy === 'commute_asc' ? 'selected' : ''}>Commute: Shortest</option>
          <option value="superfund_desc" ${this.state.sortBy === 'superfund_desc' ? 'selected' : ''}>Superfund: Furthest</option>
          <option value="sqft_desc" ${this.state.sortBy === 'sqft_desc' ? 'selected' : ''}>Sqft: Largest</option>
        </select>

        ${hasActiveFilters ? `
          <button id="clear-filters-btn" class="btn-secondary btn-sm" style="color: #f87171; height: 38px;" title="Reset all filters">
            <span>✕ Clear Filters</span>
          </button>
        ` : ''}
      </div>

      <!-- Filter Controls & Customizable Thresholds Row -->
      <div class="filter-pills-row">
        <!-- Customizable Commute Selector -->
        <div class="filter-dropdown-pill ${isCommuteActive ? 'active' : ''}">
          <span>⚡ Work Commute:</span>
          <select id="select-commute" class="pill-select">
            <option value="99" ${this.state.maxCommute >= 99 ? 'selected' : ''}>Any time</option>
            <option value="10" ${this.state.maxCommute === 10 ? 'selected' : ''}>≤ 10 min</option>
            <option value="15" ${this.state.maxCommute === 15 ? 'selected' : ''}>≤ 15 min</option>
            <option value="20" ${this.state.maxCommute === 20 ? 'selected' : ''}>≤ 20 min</option>
            <option value="25" ${this.state.maxCommute === 25 ? 'selected' : ''}>≤ 25 min</option>
            <option value="30" ${this.state.maxCommute === 30 ? 'selected' : ''}>≤ 30 min</option>
            <option value="35" ${this.state.maxCommute === 35 ? 'selected' : ''}>≤ 35 min</option>
            <option value="40" ${this.state.maxCommute === 40 ? 'selected' : ''}>≤ 40 min</option>
            <option value="50" ${this.state.maxCommute === 50 ? 'selected' : ''}>≤ 50 min</option>
          </select>
        </div>

        <!-- Customizable Max Rent Selector -->
        <div class="filter-dropdown-pill ${isRentActive ? 'active' : ''}">
          <span>💵 Max Rent:</span>
          <select id="select-rent" class="pill-select">
            <option value="99999" ${this.state.maxRent >= 99999 ? 'selected' : ''}>Any Rent</option>
            <option value="2800" ${this.state.maxRent === 2800 ? 'selected' : ''}>≤ $2,800</option>
            <option value="3000" ${this.state.maxRent === 3000 ? 'selected' : ''}>≤ $3,000</option>
            <option value="3200" ${this.state.maxRent === 3200 ? 'selected' : ''}>≤ $3,200</option>
            <option value="3400" ${this.state.maxRent === 3400 ? 'selected' : ''}>≤ $3,400</option>
            <option value="3600" ${this.state.maxRent === 3600 ? 'selected' : ''}>≤ $3,600</option>
            <option value="3800" ${this.state.maxRent === 3800 ? 'selected' : ''}>≤ $3,800</option>
            <option value="4000" ${this.state.maxRent === 4000 ? 'selected' : ''}>≤ $4,000</option>
          </select>
        </div>

        <!-- Customizable Superfund Buffer Selector -->
        <div class="filter-dropdown-pill ${isSuperfundActive ? 'active' : ''}">
          <span>🛡️ Superfund Buffer:</span>
          <select id="select-superfund" class="pill-select">
            <option value="0" ${this.state.minSuperfundDist === 0 ? 'selected' : ''}>Any Distance</option>
            <option value="0.5" ${this.state.minSuperfundDist === 0.5 ? 'selected' : ''}>≥ 0.5 mi</option>
            <option value="0.75" ${this.state.minSuperfundDist === 0.75 ? 'selected' : ''}>≥ 0.75 mi</option>
            <option value="1.0" ${this.state.minSuperfundDist === 1.0 ? 'selected' : ''}>≥ 1.0 mi</option>
            <option value="1.5" ${this.state.minSuperfundDist === 1.5 ? 'selected' : ''}>≥ 1.5 mi</option>
            <option value="2.0" ${this.state.minSuperfundDist === 2.0 ? 'selected' : ''}>≥ 2.0 mi</option>
            <option value="2.5" ${this.state.minSuperfundDist === 2.5 ? 'selected' : ''}>≥ 2.5 mi</option>
          </select>
        </div>

        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Bed Count Buttons -->
        <button class="filter-pill-btn ${this.state.bedrooms === 'all' ? 'active' : ''}" data-bed="all">All Beds</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '0' ? 'active' : ''}" data-bed="0">Studio</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '1' ? 'active' : ''}" data-bed="1">1 Bed</button>
        <button class="filter-pill-btn ${this.state.bedrooms === '2' ? 'active' : ''}" data-bed="2">2+ Bed</button>

        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Tour Media & Status -->
        <button class="filter-pill-btn ${this.state.hasMedia ? 'active' : ''}" id="toggle-media" style="${this.state.hasMedia ? 'background: #10b981; color: #fff; border-color: #10b981;' : ''}">📸 Has Tour Media</button>
        <button class="filter-pill-btn ${this.state.status === 'shortlisted' ? 'active' : ''}" data-status="shortlisted">⭐ Shortlisted</button>
        <button class="filter-pill-btn ${this.state.status === 'hidden' ? 'active' : ''}" data-status="hidden" style="${this.state.status === 'hidden' ? 'background: #64748b; color: #fff; border-color: #64748b;' : (this.hiddenCount > 0 ? 'border-color: rgba(148, 163, 184, 0.4); background: rgba(100, 116, 139, 0.15);' : '')}" title="View dismissed / hidden listings">
          <span>🚫 Hidden</span>
          ${this.hiddenCount > 0 ? `<span style="background: ${this.state.status === 'hidden' ? 'rgba(0,0,0,0.3)' : 'rgba(148, 163, 184, 0.25)'}; padding: 1px 6px; border-radius: 10px; font-size: 10.5px; font-weight: 700; margin-left: 2px;">${this.hiddenCount}</span>` : ''}
        </button>

        <span style="border-left: 1px solid var(--border-subtle); height: 20px; margin: 0 0.25rem;"></span>

        <!-- Amenities Toggles -->
        <button class="filter-pill-btn ${this.state.inUnitLaundry ? 'active' : ''}" id="toggle-laundry">🧺 In-Unit Laundry</button>
        <button class="filter-pill-btn ${this.state.hasAC ? 'active' : ''}" id="toggle-ac">❄️ A/C</button>
        <button class="filter-pill-btn ${this.state.petFriendly ? 'active' : ''}" id="toggle-pet">🐾 Pets OK</button>
      </div>
    `;

    this.bindEvents();
  }

  setHiddenCount(count) {
    if (this.hiddenCount !== count) {
      this.hiddenCount = count;
      this.render();
    }
  }

  bindEvents() {
    // Debounce search: every filter change tears down and rebuilds all cards and
    // map markers, which is far too heavy to run on each keystroke.
    const searchInput = this.container.querySelector('#filter-search');
    searchInput?.addEventListener('input', (e) => {
      this.state.search = e.target.value;
      clearTimeout(this._searchDebounce);
      this._searchDebounce = setTimeout(() => {
        this.onFilterChange(this.getState());
      }, 200);
    });

    const sortSelect = this.container.querySelector('#filter-sort');
    sortSelect?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.onFilterChange(this.getState());
    });

    const clearBtn = this.container.querySelector('#clear-filters-btn');
    clearBtn?.addEventListener('click', () => this.resetFilters());

    // Commute dropdown
    const commuteSelect = this.container.querySelector('#select-commute');
    commuteSelect?.addEventListener('change', (e) => {
      this.state.maxCommute = parseInt(e.target.value, 10);
      this.render();
      this.onFilterChange(this.getState());
    });

    // Rent dropdown
    const rentSelect = this.container.querySelector('#select-rent');
    rentSelect?.addEventListener('change', (e) => {
      this.state.maxRent = parseInt(e.target.value, 10);
      this.render();
      this.onFilterChange(this.getState());
    });

    // Superfund buffer dropdown
    const sfSelect = this.container.querySelector('#select-superfund');
    sfSelect?.addEventListener('change', (e) => {
      this.state.minSuperfundDist = parseFloat(e.target.value);
      this.render();
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

    // Tour Media toggle
    this.container.querySelector('#toggle-media')?.addEventListener('click', () => {
      this.state.hasMedia = !this.state.hasMedia;
      this.render();
      this.onFilterChange(this.getState());
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
