/**
 * Add Listing Modal Component.
 * Allows users on mobile or desktop to paste a Zillow URL and trigger automated cloud ingestion & deployment.
 */

export function showAddListingModal(gitHubSync, campaignId = '2026-south-bay', onListingTriggered) {
  const container = document.getElementById('modal-container');
  const backdrop = document.getElementById('modal-backdrop');
  if (!container || !backdrop) return;

  const hasToken = gitHubSync.hasToken();

  container.innerHTML = `
    <div class="modal-header">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">➕</span>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">Add Candidate Listing</h2>
      </div>
      <button id="modal-close-btn" class="btn-icon" style="font-size: 1.5rem; width: 36px; height: 36px;">&times;</button>
    </div>

    <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.5;">
      Paste any rental listing link (e.g. from <strong>Zillow</strong>, <strong>Redfin</strong>, or apartment community websites). Our cloud worker will automatically scrape the unit details, calculate commute time to <strong>Intel SC2</strong>, compute <strong>Superfund hazard safety</strong>, and deploy it to your dashboard in ~25 seconds.
    </div>

    ${!hasToken ? `
      <!-- Token Warning Banner -->
      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 700; color: #fbbf24; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
          <span>⚠️</span>
          <span>GitHub Token Required</span>
        </div>
        <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          To trigger cloud ingestion from your browser, enter your fine-grained GitHub Personal Access Token once below:
        </p>
        <input type="password" id="add-listing-token-input" placeholder="github_pat_..." style="width: 100%; height: 36px; background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.75rem; font-family: monospace; font-size: 0.8125rem; margin-bottom: 0.5rem;">
        <button id="save-token-btn" class="btn-secondary btn-sm">Save Token</button>
      </div>
    ` : ''}

    <div style="margin-bottom: 1.25rem;">
      <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.35rem;">
        Candidate Listing URL
      </label>
      <input type="url" id="new-listing-url" placeholder="https://www.zillow.com/homedetails/..." style="width: 100%; height: 42px; background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-main); padding: 0 0.85rem; font-size: 0.875rem; font-family: inherit;">
      <span style="font-size: 0.75rem; color: var(--text-dim); display: block; margin-top: 4px;">
        Example: https://www.zillow.com/homedetails/123-Main-St-Milpitas-CA-95035/12345_zpid/
      </span>
    </div>

    <div id="add-listing-status" class="hidden" style="margin-bottom: 1.25rem; padding: 1rem; border-radius: var(--radius-md); font-size: 0.875rem;"></div>

    <div style="display: flex; justify-content: flex-end; gap: 0.75rem; align-items: center;">
      <button id="cancel-add-btn" class="btn-secondary">Cancel</button>
      <button id="submit-add-btn" class="btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700;">
        <span>🚀 Ingest & Enrich Listing</span>
      </button>
    </div>
  `;

  backdrop.classList.remove('hidden');
  container.classList.remove('hidden');

  const closeFn = () => {
    backdrop.classList.add('hidden');
    container.classList.add('hidden');
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', closeFn);
  document.getElementById('cancel-add-btn')?.addEventListener('click', closeFn);
  backdrop.onclick = closeFn;

  // Save Token Handler
  document.getElementById('save-token-btn')?.addEventListener('click', () => {
    const tVal = document.getElementById('add-listing-token-input')?.value?.trim();
    if (tVal) {
      gitHubSync.setToken(tVal);
      showAddListingModal(gitHubSync, campaignId, onListingTriggered);
    }
  });

  // Submit Handler
  document.getElementById('submit-add-btn')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('new-listing-url')?.value?.trim();
    const statusBox = document.getElementById('add-listing-status');
    const submitBtn = document.getElementById('submit-add-btn');

    if (!urlInput || (!urlInput.startsWith('http://') && !urlInput.startsWith('https://'))) {
      alert('Please enter a valid listing URL starting with https://');
      return;
    }

    if (!gitHubSync.hasToken()) {
      alert('Please configure your GitHub token first to trigger ingestion.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Dispatching Cloud Worker...</span>';

    try {
      await gitHubSync.triggerAddListing(urlInput, campaignId);
      
      statusBox.className = '';
      statusBox.style.background = 'rgba(16, 185, 129, 0.12)';
      statusBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      statusBox.style.color = '#34d399';
      statusBox.innerHTML = `
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem;">
          🎉 Cloud Ingestion Started!
        </div>
        <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          GitHub Actions has spun up a cloud worker to scrape the listing, compute Intel SC2 commute & EPA hazard distances, and deploy the updated dataset.
        </p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <a href="https://github.com/billylokhl/rental-tracker/actions" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="color: #38bdf8; text-decoration: none;">
            View Live Workflow on GitHub ↗
          </a>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 0.5rem;">
          Your dashboard will automatically reflect the new listing in ~25 seconds upon refresh.
        </div>
      `;

      submitBtn.classList.add('hidden');
      onListingTriggered && onListingTriggered(urlInput);
    } catch (err) {
      statusBox.className = '';
      statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
      statusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusBox.style.color = '#f87171';
      statusBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 0.25rem;">Dispatch Failed</div>
        <p style="font-size: 0.8125rem;">${err.message}</p>
      `;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀 Ingest & Enrich Listing</span>';
    }
  });
}
