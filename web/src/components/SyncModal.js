/**
 * GitHub Cloud Sync Modal & Token Configuration Dialog.
 */

export function showSyncModal(gitHubSync, onTriggerSync, onClose) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  const currentToken = gitHubSync.getToken();
  const isConfigured = !!currentToken;

  container.innerHTML = `
    <div class="modal-header">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">☁️</span>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Sync Changes to GitHub</h2>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">
        Save all your mobile tour notes, visit statuses, and ratings directly to the 
        <a href="https://github.com/${gitHubSync.owner}/${gitHubSync.repo}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${gitHubSync.owner}/${gitHubSync.repo}</a> repository.
      </p>

      <div style="background: var(--bg-surface-2); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <label style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main);">GitHub Personal Access Token (PAT)</label>
          ${isConfigured ? '<span style="font-size: 0.75rem; color: #34d399; font-weight: 600;">✓ Connected</span>' : '<span style="font-size: 0.75rem; color: #f59e0b; font-weight: 600;">⚠️ Not Configured</span>'}
        </div>

        <input 
          type="password" 
          id="gh-token-input" 
          placeholder="ghp_xxxxxxxxxxxx or github_pat_xxxxxxxxxxxx" 
          value="${currentToken}" 
          style="width: 100%; height: 38px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.75rem; font-family: var(--font-mono); font-size: 0.8125rem;"
        >

        <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-dim); line-height: 1.4;">
          <strong>How to get a token:</strong>
          <ol style="margin-left: 1.25rem; margin-top: 0.25rem;">
            <li>Go to <a href="https://github.com/settings/tokens?type=beta" target="_blank" style="color: #38bdf8;">GitHub Developer Settings → Personal Access Tokens</a></li>
            <li>Generate a fine-grained token with Repository access for <code>${gitHubSync.repo}</code></li>
            <li>Grant <strong>"Contents"</strong> permission: <strong>Read and write</strong></li>
          </ol>
        </div>
      </div>

      <div id="sync-status-msg" class="hidden" style="padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.8125rem;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
        ${isConfigured ? `
          <button id="clear-token-btn" class="btn-secondary btn-sm" style="color: #f87171;">
            <span>Disconnect Token</span>
          </button>
        ` : '<div></div>'}
        <div style="display: flex; gap: 0.5rem;">
          <button id="save-token-only-btn" class="btn-secondary">Save Token</button>
          <button id="sync-now-btn" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0ea5e9);">
            <span>☁️ Sync & Commit Now</span>
          </button>
        </div>
      </div>
    </div>
  `;

  backdrop.classList.remove('hidden');
  container.classList.remove('hidden');

  const closeFn = () => {
    backdrop.classList.add('hidden');
    container.classList.add('hidden');
    onClose && onClose();
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', closeFn);
  backdrop.onclick = closeFn;

  document.getElementById('clear-token-btn')?.addEventListener('click', () => {
    gitHubSync.setToken('');
    showSyncModal(gitHubSync, onTriggerSync, onClose);
  });

  document.getElementById('save-token-only-btn')?.addEventListener('click', () => {
    const inputVal = document.getElementById('gh-token-input')?.value.trim();
    gitHubSync.setToken(inputVal);
    alert('GitHub Token saved locally on this device.');
    closeFn();
  });

  document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    const inputVal = document.getElementById('gh-token-input')?.value.trim();
    if (!inputVal) {
      alert('Please enter a GitHub Personal Access Token first.');
      return;
    }
    gitHubSync.setToken(inputVal);

    const statusEl = document.getElementById('sync-status-msg');
    const syncBtn = document.getElementById('sync-now-btn');
    
    if (statusEl && syncBtn) {
      statusEl.className = '';
      statusEl.classList.remove('hidden');
      statusEl.style.background = 'var(--bg-surface-2)';
      statusEl.style.color = '#38bdf8';
      statusEl.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> Committing changes to GitHub...';
      syncBtn.setAttribute('disabled', 'true');
    }

    try {
      await onTriggerSync();
      if (statusEl) {
        statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
        statusEl.style.color = '#34d399';
        statusEl.innerHTML = '✓ <strong>Committed successfully!</strong> GitHub Actions is rebuilding the live dashboard (~20s).';
      }
      setTimeout(() => closeFn(), 2000);
    } catch (err) {
      if (statusEl && syncBtn) {
        syncBtn.removeAttribute('disabled');
        statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
        statusEl.style.color = '#f87171';
        statusEl.innerHTML = `✕ <strong>Sync Failed:</strong> ${err.message}`;
      }
    }
  });
}
