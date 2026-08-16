/**
 * Direct GitHub API Sync Engine.
 * Allows committing annotations directly from mobile or desktop browsers to the Git repository.
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
}
