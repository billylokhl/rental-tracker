import { useState, useCallback, useContext } from 'preact/hooks';
import { AppContext } from '../context.js';
import { Modal } from './Modal.jsx';

/**
 * GitHub sync modal — configure token and trigger annotation sync.
 */
export function SyncModal({ onClose }) {
  const { gitHubSync, annotationManager, campaignData } = useContext(AppContext);

  const [token, setToken] = useState(gitHubSync.getToken());
  const [status, setStatus] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSaveToken = useCallback(() => {
    gitHubSync.setToken(token.trim());
    setStatus('Token saved.');
  }, [token, gitHubSync]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setStatus('Syncing...');
    try {
      const campaignId = campaignData.campaign.id;
      await gitHubSync.syncAnnotations(campaignId, annotationManager.annotations);
      setStatus('✅ Sync successful! Annotations pushed to GitHub.');
    } catch (err) {
      setStatus(`❌ Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [gitHubSync, annotationManager, campaignData]);

  return (
    <Modal title="Sync to GitHub" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
            GitHub Personal Access Token
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Requires <code>contents:write</code> scope to push annotation updates.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              value={token}
              onInput={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            />
            <button className="btn-secondary btn-sm" onClick={handleSaveToken}>Save</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Repo: <strong style={{ color: 'var(--text-main)' }}>{gitHubSync.owner}/{gitHubSync.repo}</strong>
          </span>
        </div>

        <button
          className="btn-primary"
          onClick={handleSync}
          disabled={syncing || !token.trim()}
          style={{ opacity: syncing ? 0.6 : 1 }}
        >
          {syncing ? '⏳ Syncing...' : '🔄 Push Annotations to GitHub'}
        </button>

        {status && (
          <div style={{
            padding: '0.75rem',
            background: status.startsWith('✅') ? 'var(--success-light)' : status.startsWith('❌') ? 'var(--danger-light)' : 'var(--bg-surface-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            color: 'var(--text-main)',
          }}>
            {status}
          </div>
        )}
      </div>
    </Modal>
  );
}
