/**
 * GitHub API client for syncing annotations and dispatching listing workflows.
 * Framework-agnostic — no DOM or component dependencies.
 */

const TOKEN_KEY = 'rental_tracker_gh_token';

export class GitHubSync {
  constructor() {
    this.owner = '';
    this.repo = '';
  }

  setRepoFromBundle(repoInfo) {
    if (repoInfo) {
      this.owner = repoInfo.owner || '';
      this.repo = repoInfo.name || '';
    }
  }

  getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch { return ''; }
  }

  setToken(token) {
    try {
      if (!token) localStorage.removeItem(TOKEN_KEY);
      else localStorage.setItem(TOKEN_KEY, token);
    } catch { /* ignore */ }
  }

  _headers() {
    return {
      Authorization: `token ${this.getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  async syncAnnotations(campaignId, state, onProgress) {
    if (!this.getToken()) throw new Error('GitHub token not configured');
    if (!this.owner || !this.repo) throw new Error('Repository not configured');

    const jsonStr = JSON.stringify(state);
    let payload_b64;
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      payload_b64 = btoa(binary);
    } else {
      payload_b64 = btoa(unescape(encodeURIComponent(jsonStr)));
    }

    // GitHub workflow_dispatch inputs are limited to 65,535 characters.
    // Base64 inflates JSON by ~33%, so payloads over ~49KB raw will hit this.
    if (payload_b64.length > 65000) {
      throw new Error(
        `Annotation payload is too large for workflow dispatch (${Math.round(payload_b64.length / 1024)} KB encoded). ` +
        `Please use the Export/Import feature to sync manually.`
      );
    }

    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/sync_annotations.yml/dispatches`;
    const inputs = { payload_b64, campaign: campaignId };

    const startTime = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ ref: 'main', inputs }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || `Dispatch error: ${resp.status}`);
    }

    return await this.pollWorkflowStatus('sync_annotations.yml', startTime, onProgress || (() => {}));
  }

  async triggerAddListing(listingUrl, campaignId, options = {}) {
    if (!this.getToken()) throw new Error('GitHub token not configured');
    if (!this.owner || !this.repo) throw new Error('Repository not configured');

    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/add_listing.yml/dispatches`;
    const inputs = { url: listingUrl, campaign: campaignId };
    if (options.unit) inputs.unit = String(options.unit);
    if (options.rent) inputs.rent = String(options.rent);
    if (options.beds != null) inputs.beds = String(options.beds);
    if (options.address) inputs.address = String(options.address);

    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ ref: 'main', inputs }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || `Dispatch error: ${resp.status}`);
    }
  }

  async pollWorkflowStatus(workflowFileName, startTime, onProgress) {
    const maxAttempts = 30;
    const intervalMs = 2500;
    let foundRunId = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, intervalMs));

      try {
        if (!foundRunId) {
          const url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowFileName}/runs?per_page=5&event=workflow_dispatch`;
          const resp = await fetch(url, { headers: this._headers() });
          if (!resp.ok) continue;
          const data = await resp.json();

          let oldestMatch = null;
          for (const run of (data.workflow_runs || [])) {
            const created = new Date(run.created_at).getTime();
            if (created >= startTime - 3000) {
              if (!oldestMatch || created < new Date(oldestMatch.created_at).getTime()) {
                oldestMatch = run;
              }
            }
          }
          if (oldestMatch) {
            foundRunId = oldestMatch.id;
          }
          if (!foundRunId) {
            onProgress?.({ status: 'waiting', message: 'Waiting for workflow to start...' });
            continue;
          }
        }

        const runUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${foundRunId}`;
        const runResp = await fetch(runUrl, { headers: this._headers() });
        if (!runResp.ok) continue;
        const runData = await runResp.json();

        onProgress?.({ status: runData.status, conclusion: runData.conclusion, message: `Run ${runData.status}` });

        if (runData.status === 'completed') {
          return { success: runData.conclusion === 'success', conclusion: runData.conclusion };
        }
      } catch {
        continue;
      }
    }

    return { success: false, conclusion: 'timeout' };
  }
}
