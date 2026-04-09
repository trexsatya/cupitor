/**
 * github-utils.js
 * Browser-compatible utility for reading and updating files in a GitHub repository
 * via the GitHub REST API, using the browser's native fetch.
 *
 * Exposes window.GitHubUtils with:
 *   getGHToken()             - Prompt/cache a GitHub PAT in localStorage
 *   getFile(...)             - Fetch file content + current blob SHA
 *   putFile(...)             - Create or update a file (raw)
 *   putFileWithContent(...)  - Write specific content without a prior read
 *   updateFile(...)          - High-level: read → transform → commit
 */
(function (global) {
  const GITHUB_API = "https://api.github.com";

  // Token is kept only in memory for this page session.
  // It is intentionally NOT persisted to localStorage or any other
  // storage to reduce the risk of XSS token theft.
  let _cachedToken = null;

  function getGHToken() {
    if (!_cachedToken) {
      const token = prompt("Enter your GitHub personal access token (PAT) with repo scope:");
      if (token) _cachedToken = token.trim();
    }
    return _cachedToken;
  }

  function clearGHToken() {
    _cachedToken = null;
  }

  /** Set the token programmatically (e.g. injected by a native webview). */
  function setGHToken(token) {
    _cachedToken = token ? token.trim() : null;
  }

  function _b64encode(str) {
    // Handles UTF-8 characters (e.g. Swedish ä, ö, å)
    return btoa(unescape(encodeURIComponent(str)));
  }

  function _b64decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }

  async function _githubRequest(method, path, body, token) {
    // If running inside the Flutter webview, route through the GitHubProxy
    // JavaScriptChannel. The token is held in Flutter and injected server-side
    // so it is never present in the JS context.
    if (typeof GitHubProxy !== 'undefined') {
      return _githubRequestViaProxy(method, path, body);
    }

    // Fallback: direct fetch (browser / dev environment).
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = await res.json();
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${parsed.message}`);
    }
    return parsed;
  }

  /** Send a GitHub API request through the Flutter JavaScriptChannel proxy. */
  function _githubRequestViaProxy(method, path, body) {
    return new Promise((resolve, reject) => {
      const id = 'gh_' + Math.random().toString(36).slice(2);
      window._ghProxyHandlers = window._ghProxyHandlers || {};
      window._ghProxyHandlers[id] = (statusCode, responseText) => {
        let parsed;
        try { parsed = JSON.parse(responseText); } catch (_) { parsed = {}; }
        if (statusCode === 0 || statusCode >= 400) {
          reject(new Error(`GitHub API error ${statusCode}: ${parsed.message || responseText}`));
        } else {
          resolve(parsed);
        }
      };
      GitHubProxy.postMessage(JSON.stringify({
        id,
        method,
        path,
        body: body ? JSON.stringify(body) : undefined,
      }));
    });
  }

  /**
   * Fetches a file from GitHub. Returns { content, sha }.
   */
  async function getFile(owner, repo, filePath, token, branch) {
    const query = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const path = `/repos/${owner}/${repo}/contents/${filePath}${query}`;
    const response = await _githubRequest("GET", path, null, token);
    return { content: _b64decode(response.content), sha: response.sha };
  }

  /**
   * Creates or updates a file in a GitHub repository.
   */
  async function putFile(owner, repo, filePath, newContent, message, sha, token, branch) {
    const path = `/repos/${owner}/${repo}/contents/${filePath}`;
    const body = {
      message,
      content: _b64encode(newContent),
      ...(sha && { sha }),
      ...(branch && { branch }),
    };
    return _githubRequest("PUT", path, body, token);
  }

  /**
   * Write specific content directly, fetching the current SHA automatically.
   * @param {object} options
   * @param {string} options.owner
   * @param {string} options.repo
   * @param {string} options.filePath
   * @param {string} options.content      - New UTF-8 content to write
   * @param {string} options.commitMessage
   * @param {string} [options.branch]
   */
  async function putFileWithContent({ owner, repo, filePath, content, commitMessage, branch }) {
    const token = "";getGHToken();
    //if (!token) throw new Error("No GitHub token provided.");

    let sha;
    try {
      const existing = await getFile(owner, repo, filePath, token, branch);
      sha = existing.sha;
    } catch (_) {
      // File does not exist yet — omit sha to create it
    }

    return putFile(owner, repo, filePath, content, commitMessage, sha, token, branch);
  }

  /**
   * Read → transform → commit. No-op if the content is unchanged.
   * @param {object} options
   * @param {string} options.owner
   * @param {string} options.repo
   * @param {string} options.filePath
   * @param {string} options.token
   * @param {string} options.commitMessage
   * @param {(content: string) => string} options.transform
   * @param {string} [options.branch]
   */
  async function updateFile({ owner, repo, filePath, token, commitMessage, transform, branch }) {
    if (!owner || !repo || !filePath || !token || !commitMessage || typeof transform !== "function") {
      throw new Error("Missing required options.");
    }
    const { content, sha } = await getFile(owner, repo, filePath, token, branch);
    const updatedContent = transform(content);
    if (updatedContent === content) return null;
    return putFile(owner, repo, filePath, updatedContent, commitMessage, sha, token, branch);
  }

  global.GitHubUtils = { getGHToken, setGHToken, clearGHToken, getFile, putFile, putFileWithContent, updateFile };

})(window);
