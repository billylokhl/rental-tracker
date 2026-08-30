import { useContext } from 'preact/hooks';
import { AppContext } from '../context.js';

/**
 * App header with brand, campaign title, and action buttons.
 */
export function Header({ onAddListing, onSync, onExport, onImport, onToggleTheme }) {
  const { campaign } = useContext(AppContext);
  const regionTag = campaign.region || 'Search Area';
  const yearTag = campaign.year || '';

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          onImport(data);
        } catch {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">🏠</div>
        <div className="brand-text-block">
          <div className="brand-subtitle">{regionTag} {yearTag}</div>
          <h1 className="brand-title">{campaign.title || 'Rental Tracker'}</h1>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn-primary btn-sm" onClick={onAddListing} title="Add a new listing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span className="btn-label-desktop">Add Listing</span>
          <span className="btn-label-mobile">+</span>
        </button>
        <button className="btn-secondary btn-sm" onClick={onSync} title="Sync to GitHub">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M16 8s-1.5-2-4-2-4 2-4 2" /><path d="M8 16s1.5 2 4 2 4-2 4-2" /></svg>
          <span className="btn-label-desktop">Sync</span>
        </button>
        <button className="btn-secondary btn-sm desktop-only-action" onClick={onExport} title="Export annotations">
          ⬇
        </button>
        <button className="btn-secondary btn-sm desktop-only-action" onClick={handleImport} title="Import annotations">
          ⬆
        </button>
        <button className="btn-secondary btn-sm" onClick={onToggleTheme} title="Toggle theme">
          🌓
        </button>
      </div>
    </header>
  );
}
