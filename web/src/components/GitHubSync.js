/**
 * Direct GitHub API Sync & Workflow Dispatch Engine.
 * Allows committing annotations and triggering cloud listing ingestion directly from mobile or desktop browsers.
 */

export class GitHubSync {
  constructor(owner = 'billylokhl', repo = 'rental-tracker') {
    this.owner = owner;
    this.repo = repo;
    this.tokenKey = 'rental_tracker_gh_token';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey) || '';
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token.trim());
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  hasToken() {
    return !!this.getToken();
  }

  async syncAnnotations(campaignId, annotations) {
    const token = this.getToken();
    if (!token) {
      throw new Error('MISSING_TOKEN');
    }

    const filePath = `campaigns/${campaignId}/annotations.json`;
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}`;

    // 1. Get current file SHA from GitHub
    let sha = null;
    try {
      const getResp = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (getResp.ok) {
        const fileData = await getResp.json();
        sha = fileData.sha;
      }
    } catch (e) {
      console.warn('Could not fetch existing file SHA, will attempt creation:', e);
    }

    // 2. Base64 encode the new annotations JSON (UTF-8 safe)
    const jsonStr = JSON.stringify(annotations, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binaryStr = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryStr += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binaryStr);

    // 3. Commit update to GitHub via PUT /contents/
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const bodyPayload = {
      message: `update(mobile): Sync visit notes & ratings (${nowStr})`,
      content: base64Content,
      branch: 'main'
    };
    if (sha) {
      bodyPayload.sha = sha;
    }

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!putResp.ok) {
      const errData = await putResp.json().catch(() => ({}));
      if (putResp.status === 401 || putResp.status === 403) {
        throw new Error('INVALID_TOKEN: Token expired or lacks "Contents: Read and write" permission.');
      }
      throw new Error(errData.message || `GitHub API error: HTTP ${putResp.status}`);
    }

    return await putResp.json();
  }

  async triggerAddListing(url, campaignId = '2026-south-bay', options = {}) {
    const token = this.getToken();
    if (!token) {
      throw new Error('MISSING_TOKEN');
    }

    const workflowId = 'add_listing.yml';
    const apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`;

    const inputs = {
      url: url.trim(),
      campaign: campaignId
    };
    if (options.unit) inputs.unit = options.unit.trim();
    if (options.rent) inputs.rent = options.rent.trim();
    if (options.beds) inputs.beds = options.beds.trim();
    if (options.address) inputs.address = options.address.trim();

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      if (resp.status === 401 || resp.status === 403) {
        throw new Error('INVALID_TOKEN: Token lacks "Actions: Read and write" or "Contents: Read and write" permission.');
      }
      throw new Error(errData.message || `GitHub Actions dispatch failed: HTTP ${resp.status}`);
    }

    return true;
  }

  async pollWorkflowStatus(workflowFileName, startTime, onProgress) {
    const token = this.getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const listUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowFileName}/runs?per_page=10`;

    // workflow_dispatch returns no run id, so identify our run as the oldest
    // dispatch-triggered run created around/after the dispatch, then track it by id.
    // The small grace window absorbs client/server clock skew and GitHub's
    // whole-second created_at truncation (a strict >= startTime can permanently
    // exclude a run created in the same wall-clock second as the dispatch);
    // the run-id latch is what prevents tracking a pre-existing run's outcome.
    const GRACE_MS = 3000;
    let targetRunId = null;
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2500));
      try {
        let matchingRun = null;
        if (targetRunId) {
          // Poll the latched run directly: one small payload, and immune to the
          // run falling off the first page of the list on a busy day.
          const resp = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${targetRunId}`, { headers });
          if (resp.ok) matchingRun = await resp.json();
        } else {
          const resp = await fetch(listUrl, { headers });
          if (resp.ok) {
            const data = await resp.json();
            const runs = data.workflow_runs || [];
            const candidates = runs.filter(r =>
              r.event === 'workflow_dispatch' && new Date(r.created_at).getTime() >= startTime - GRACE_MS
            );
            // Runs are sorted newest first; the oldest candidate is the one
            // created soonest after our dispatch.
            matchingRun = candidates[candidates.length - 1] || null;
            if (matchingRun) targetRunId = matchingRun.id;
          }
        }
        if (matchingRun) {
          onProgress && onProgress(matchingRun);
          if (matchingRun.status === 'completed') {
            return matchingRun;
          }
        }
      } catch (e) {
        console.warn('Polling error:', e);
      }
    }
    return null;
  }
}
