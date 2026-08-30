import { useState, useCallback, useRef, useEffect } from 'preact/hooks';

const DEFAULT_STATE = {
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
  sortBy: 'rent_asc',
};

/**
 * Filter bar with search, filter pills, and sort controls.
 */
export function FilterBar({ filterState, onChange, hiddenCount }) {
  const [localSearch, setLocalSearch] = useState(filterState.search || '');
  const debounceRef = useRef(null);

  // Sync local search with external state changes
  useEffect(() => {
    setLocalSearch(filterState.search || '');
  }, [filterState.search]);

  const update = useCallback((patch) => {
    onChange({ ...filterState, ...patch });
  }, [filterState, onChange]);

  const handleSearch = useCallback((e) => {
    const val = e.target.value;
    setLocalSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update({ search: val });
    }, 200);
  }, [update]);

  const togglePill = (key) => update({ [key]: !filterState[key] });

  const isActive = (key) => !!filterState[key];

  return (
    <div className="filter-wrapper">
      <div className="filter-primary-row">
        <div className="search-input-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search properties, notes, amenities..."
            value={localSearch}
            onInput={handleSearch}
          />
        </div>

        <div className={`filter-dropdown-pill ${filterState.sortBy !== 'rent_asc' ? 'active' : ''}`}>
          <span>↕</span>
          <select
            className="pill-select"
            value={filterState.sortBy}
            onChange={(e) => update({ sortBy: e.target.value })}
          >
            <option value="rent_asc">Rent ↑</option>
            <option value="rent_desc">Rent ↓</option>
            <option value="commute_asc">Commute ↑</option>
            <option value="superfund_desc">Safety ↑</option>
            <option value="sqft_desc">Size ↓</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="filter-pills-row">
        {/* Max Rent */}
        <div className={`filter-dropdown-pill ${filterState.maxRent < 99999 ? 'active' : ''}`}>
          <span>💰</span>
          <select
            className="pill-select"
            value={filterState.maxRent}
            onChange={(e) => update({ maxRent: Number(e.target.value) })}
          >
            <option value="99999">Max Rent</option>
            <option value="2500">≤ $2,500</option>
            <option value="3000">≤ $3,000</option>
            <option value="3500">≤ $3,500</option>
            <option value="4000">≤ $4,000</option>
            <option value="4500">≤ $4,500</option>
            <option value="5000">≤ $5,000</option>
          </select>
        </div>

        {/* Max Commute */}
        <div className={`filter-dropdown-pill ${filterState.maxCommute < 99 ? 'active' : ''}`}>
          <span>🚗</span>
          <select
            className="pill-select"
            value={filterState.maxCommute}
            onChange={(e) => update({ maxCommute: Number(e.target.value) })}
          >
            <option value="99">Commute</option>
            <option value="15">≤ 15 min</option>
            <option value="20">≤ 20 min</option>
            <option value="25">≤ 25 min</option>
            <option value="30">≤ 30 min</option>
            <option value="40">≤ 40 min</option>
          </select>
        </div>

        {/* Bedrooms */}
        <div className={`filter-dropdown-pill ${filterState.bedrooms !== 'all' ? 'active' : ''}`}>
          <span>🛏️</span>
          <select
            className="pill-select"
            value={filterState.bedrooms}
            onChange={(e) => update({ bedrooms: e.target.value })}
          >
            <option value="all">Beds</option>
            <option value="0">Studio</option>
            <option value="1">1 BR</option>
            <option value="2">2+ BR</option>
          </select>
        </div>

        {/* Min Superfund Distance */}
        <div className={`filter-dropdown-pill ${filterState.minSuperfundDist > 0 ? 'active' : ''}`}>
          <span>☢️</span>
          <select
            className="pill-select"
            value={filterState.minSuperfundDist}
            onChange={(e) => update({ minSuperfundDist: Number(e.target.value) })}
          >
            <option value="0">Superfund</option>
            <option value="1">≥ 1.0 mi</option>
            <option value="1.5">≥ 1.5 mi</option>
            <option value="2">≥ 2.0 mi</option>
            <option value="3">≥ 3.0 mi</option>
          </select>
        </div>

        {/* Toggle Pills */}
        <button
          className={`filter-pill-btn ${isActive('inUnitLaundry') ? 'active' : ''}`}
          onClick={() => togglePill('inUnitLaundry')}
        >
          🧺 In-Unit W/D
        </button>

        <button
          className={`filter-pill-btn ${isActive('hasAC') ? 'active' : ''}`}
          onClick={() => togglePill('hasAC')}
        >
          ❄️ A/C
        </button>

        <button
          className={`filter-pill-btn ${isActive('petFriendly') ? 'active' : ''}`}
          onClick={() => togglePill('petFriendly')}
        >
          🐾 Pets
        </button>

        <button
          className={`filter-pill-btn ${isActive('hasMedia') ? 'active' : ''}`}
          onClick={() => togglePill('hasMedia')}
        >
          📸 Media
        </button>

        {/* Status */}
        <div className={`filter-dropdown-pill ${filterState.status !== 'all' ? 'active' : ''}`}>
          <span>📋</span>
          <select
            className="pill-select"
            value={filterState.status}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="all">All Active</option>
            <option value="shortlisted">⭐ Shortlisted</option>
            <option value="visited">✅ Visited</option>
            <option value="hidden">🚫 Hidden ({hiddenCount})</option>
          </select>
        </div>
      </div>
    </div>
  );
}

FilterBar.defaultState = DEFAULT_STATE;
