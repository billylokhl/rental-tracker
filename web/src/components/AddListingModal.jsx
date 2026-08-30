import { useState, useCallback, useContext } from 'preact/hooks';
import { AppContext } from '../context.js';
import { Modal } from './Modal.jsx';

/**
 * Add listing modal — dispatches a GitHub Actions workflow to scrape and ingest a new listing.
 */
export function AddListingModal({ onClose }) {
  const { gitHubSync, campaignData } = useContext(AppContext);

  const [url, setUrl] = useState('');
  const [unit, setUnit] = useState('');
  const [rent, setRent] = useState('');
  const [beds, setBeds] = useState('');
  const [address, setAddress] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | dispatching | polling | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [token, setToken] = useState(gitHubSync.getToken());

  const campaignId = campaignData.campaign.id;

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) return;

    // Ensure token is saved
    if (token.trim() && token.trim() !== gitHubSync.getToken()) {
      gitHubSync.setToken(token.trim());
    }

    if (!gitHubSync.getToken()) {
      setStatus('error');
      setStatusMessage('Please enter a GitHub token first.');
      return;
    }

    setStatus('dispatching');
    setStatusMessage('Dispatching workflow...');

    try {
      const startTime = Date.now();
      await gitHubSync.triggerAddListing(url.trim(), campaignId, {
        unit: unit.trim() || undefined,
        rent: rent.trim() || undefined,
        beds: beds.trim() || undefined,
        address: address.trim() || undefined,
      });

      setStatus('polling');
      setStatusMessage('Workflow dispatched. Polling for status...');

      const result = await gitHubSync.pollWorkflowStatus('add_listing.yml', startTime, (progress) => {
        setStatusMessage(`${progress.message || 'Waiting...'}${progress.conclusion ? ` (${progress.conclusion})` : ''}`);
      });

      if (result.success) {
        setStatus('success');
        setStatusMessage('✅ Listing added successfully! Refresh the page to see it.');
      } else {
        setStatus('error');
        setStatusMessage(`Workflow finished with: ${result.conclusion}. Check GitHub Actions for details.`);
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(`Error: ${err.message}`);
    }
  }, [url, unit, rent, beds, address, token, gitHubSync, campaignId]);

  const isSubmitting = status === 'dispatching' || status === 'polling';

  return (
    <Modal title="Add New Listing" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Token field (if not set) */}
        {!gitHubSync.getToken() && (
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
              GitHub Token
            </label>
            <input
              type="password"
              value={token}
              onInput={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
            Listing URL
          </label>
          <input
            type="url"
            value={url}
            onInput={(e) => setUrl(e.target.value)}
            placeholder="https://www.zillow.com/homedetails/..."
            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', fontSize: '0.875rem' }}
            disabled={isSubmitting}
          />
        </div>

        <button
          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾' : '▸'} Advanced Options (unit, rent, beds, address overrides)
        </button>

        {showAdvanced && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <InputField label="Unit" value={unit} onChange={setUnit} placeholder="e.g. Unit 204" disabled={isSubmitting} />
            <InputField label="Rent Override" value={rent} onChange={setRent} placeholder="e.g. 2950" disabled={isSubmitting} />
            <InputField label="Beds Override" value={beds} onChange={setBeds} placeholder="e.g. 1" disabled={isSubmitting} />
            <InputField label="Address Override" value={address} onChange={setAddress} placeholder="123 Main St" disabled={isSubmitting} />
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !url.trim()}
          style={{ opacity: isSubmitting ? 0.6 : 1 }}
        >
          {isSubmitting ? '⏳ Processing...' : '🏠 Add Listing'}
        </button>

        {statusMessage && (
          <div style={{
            padding: '0.75rem',
            background: status === 'success' ? 'var(--success-light)' : status === 'error' ? 'var(--danger-light)' : 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            color: 'var(--text-main)',
          }}>
            {statusMessage}
          </div>
        )}
      </div>
    </Modal>
  );
}

function InputField({ label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onInput={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', fontSize: '0.8rem' }}
      />
    </div>
  );
}
