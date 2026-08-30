/**
 * Add Listing Modal Component with Live Status Tracker and Auto-Refresh.
 */

import { escapeHtml } from './utils.js?v=45';

export function showAddListingModal(gitHubSync, campaignId = '', onListingTriggered) {
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
      Paste any rental link (e.g. <strong>Zillow</strong>, <strong>Redfin</strong>, or apartment community pages). GitHub Actions will extract property info, calculate <strong>work commute</strong> and <strong>hazard safety</strong>, and deploy it live in ~25 seconds.
    </div>

    ${!hasToken ? `
      <!-- Token Warning Banner -->
      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 700; color: #fbbf24; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
          <span>⚠️</span>
          <span>GitHub Token Required</span>
        </div>
        <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">
          Enter your fine-grained GitHub Personal Access Token with <strong>Contents: Read and write</strong> and <strong>Actions: Read and write</strong> permissions:
        </p>
        <input type="password" id="add-listing-token-input" placeholder="github_pat_..." style="width: 100%; height: 36px; background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.75rem; font-family: monospace; font-size: 0.8125rem; margin-bottom: 0.5rem;">
        <button id="save-token-btn" class="btn-secondary btn-sm">Save Token</button>
      </div>
    ` : ''}

    <div id="add-listing-form-body">
      <div style="margin-bottom: 1.25rem;">
        <label style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main); display: block; margin-bottom: 0.35rem;">
          Candidate Listing URL <span style="color:#ef4444;">*</span>
        </label>
        <input type="url" id="new-listing-url" placeholder="https://www.zillow.com/homedetails/..." style="width: 100%; height: 42px; background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-main); padding: 0 0.85rem; font-size: 0.875rem; font-family: inherit;">
        <span style="font-size: 0.75rem; color: var(--text-dim); display: block; margin-top: 4px;">
          Paste any rental link (e.g. Zillow, Redfin, or community pages).
        </span>
      </div>

      <!-- Optional Overrides Accordion -->
      <details style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem;">
        <summary style="font-size: 0.8125rem; font-weight: 700; color: #38bdf8; cursor: pointer; user-select: none;">
          ⚙️ Optional Details (Unit #, Rent, Beds, Address)
        </summary>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem;">
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Unit # / Floorplan</label>
            <input type="text" id="new-listing-unit" placeholder="e.g. Unit 101 or 1-134" style="width: 100%; height: 34px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.6rem; font-size: 0.8125rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Monthly Rent ($)</label>
            <input type="number" id="new-listing-rent" placeholder="e.g. 2950" style="width: 100%; height: 34px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.6rem; font-size: 0.8125rem;">
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Bedrooms</label>
            <select id="new-listing-beds" style="width: 100%; height: 34px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.6rem; font-size: 0.8125rem;">
              <option value="">Auto-Detect</option>
              <option value="0">Studio (0 Bed)</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3+ Bedrooms</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">Street Address</label>
            <input type="text" id="new-listing-address" placeholder="e.g. 5560 Lexington Ave" style="width: 100%; height: 34px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: var(--text-main); padding: 0 0.6rem; font-size: 0.8125rem;">
          </div>
        </div>
      </details>

      <div id="add-listing-status" class="hidden" style="margin-bottom: 1.25rem; padding: 1rem; border-radius: var(--radius-md); font-size: 0.875rem;"></div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; align-items: center;">
        <button id="cancel-add-btn" class="btn-secondary">Cancel</button>
        <button id="submit-add-btn" class="btn-primary" style="background: linear-gradient(135deg, #10b981, #059669); font-weight: 700;">
          <span>🚀 Ingest & Enrich Listing</span>
        </button>
      </div>
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
    const unitVal = document.getElementById('new-listing-unit')?.value?.trim();
    const rentVal = document.getElementById('new-listing-rent')?.value?.trim();
    const bedsVal = document.getElementById('new-listing-beds')?.value?.trim();
    const addrVal = document.getElementById('new-listing-address')?.value?.trim();

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
    submitBtn.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span><span>Dispatching Cloud Worker...</span>';

    const dispatchTime = Date.now();

    try {
      await gitHubSync.triggerAddListing(urlInput, campaignId, {
        unit: unitVal,
        rent: rentVal,
        beds: bedsVal,
        address: addrVal
      });
      
      statusBox.className = '';
      statusBox.style.background = 'rgba(2, 132, 199, 0.12)';
      statusBox.style.border = '1px solid rgba(2, 132, 199, 0.4)';
      statusBox.style.color = '#38bdf8';
      statusBox.innerHTML = `
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
          <span class="spinner" style="width: 16px; height: 16px; display: inline-block; border-color: #38bdf8; border-top-color: transparent;"></span>
          <span id="live-progress-title">Cloud Worker Running (~20s)...</span>
        </div>
        <div id="live-progress-steps" style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8125rem; color: var(--text-muted);">
          <div>⚡ Step 1: Dispatched to GitHub Actions</div>
          <div>🤖 Step 2: Extracting listing & geocoding coordinates</div>
          <div>🚗 Step 3: Computing work commute & EPA hazard buffers</div>
          <div>🚀 Step 4: Deploying live dashboard</div>
        </div>
        <div style="margin-top: 0.75rem;">
          <a href="https://github.com/${gitHubSync.owner}/${gitHubSync.repo}/actions" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #38bdf8; text-decoration: underline;">
            View Live Workflow Runs on GitHub ↗
          </a>
        </div>
      `;

      submitBtn.classList.add('hidden');
      onListingTriggered && onListingTriggered(urlInput);

      // Start live polling of the workflow
      gitHubSync.pollWorkflowStatus('add_listing.yml', dispatchTime, (run) => {
        const titleEl = document.getElementById('live-progress-title');
        if (!titleEl) return;

        if (run.status === 'in_progress') {
          titleEl.textContent = 'Ingesting listing & deploying to GitHub Pages...';
        } else if (run.status === 'completed') {
          if (run.conclusion === 'success') {
            statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            statusBox.style.color = '#34d399';
            statusBox.innerHTML = `
              <div style="font-weight: 700; font-size: 1rem; margin-bottom: 0.35rem;">
                🎉 Listing Ingested & Deployed!
              </div>
              <p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Your new listing is now live. Reloading your dashboard in 3 seconds...
              </p>
              <button id="instant-reload-btn" class="btn-primary btn-sm" style="background: #10b981;">
                Reload Dashboard Now
              </button>
            `;
            document.getElementById('instant-reload-btn')?.addEventListener('click', () => {
              window.location.reload();
            });
            setTimeout(() => {
              window.location.reload();
            }, 3500);
          } else {
            statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
            statusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            statusBox.style.color = '#f87171';
            statusBox.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 0.25rem;">Ingestion Workflow Finished: ${run.conclusion}</div>
              <p style="font-size: 0.8125rem;">Check <a href="${run.html_url}" target="_blank" style="color: #38bdf8;">GitHub Action logs</a> for details.</p>
            `;
          }
        }
      });

    } catch (err) {
      statusBox.className = '';
      statusBox.style.background = 'rgba(239, 68, 68, 0.12)';
      statusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusBox.style.color = '#f87171';
      statusBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 0.25rem;">Dispatch Failed</div>
        <p style="font-size: 0.8125rem; margin-bottom: 0.5rem;">${escapeHtml(err.message)}</p>
        <div style="margin-top: 0.5rem; border-top: 1px solid rgba(239, 68, 68, 0.3); padding-top: 0.5rem;">
          <label style="font-size: 0.75rem; color: #fff; font-weight: 600; display: block; margin-bottom: 0.25rem;">Replace with New Token:</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="password" id="modal-replace-token" placeholder="github_pat_..." style="flex: 1; height: 34px; background: var(--bg-surface-1); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); color: #fff; padding: 0 0.5rem; font-family: monospace; font-size: 0.75rem;">
            <button id="modal-save-new-token-btn" class="btn-secondary btn-sm">Update Token</button>
          </div>
        </div>
      `;

      document.getElementById('modal-save-new-token-btn')?.addEventListener('click', () => {
        const val = document.getElementById('modal-replace-token')?.value?.trim();
        if (val) {
          gitHubSync.setToken(val);
          alert('Token updated! You can now retry ingestion.');
          statusBox.classList.add('hidden');
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>🚀 Ingest & Enrich Listing</span>';
        }
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀 Ingest & Enrich Listing</span>';
    }
  });
}
